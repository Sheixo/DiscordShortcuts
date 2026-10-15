/*
 * ShortcutToggle — Copyright (c) 2026 Ethan / Sheixo
 * SPDX-License-Identifier: GPL-3.0-or-later
 * Native keybind engine retained from ShortcutToggle 0.2.7.
 */
import { definePluginSettings } from "@api/Settings";
import definePlugin, { OptionType } from "@utils/types";
import { findByProps } from "@webpack";

const BRIDGE_VERSION = "0.3.0";
const settings = definePluginSettings({
    selectedKeybindIds: { type: OptionType.CUSTOM, description: "Raccourcis contrôlés depuis Stream Deck", default: [] as string[], hidden: true,
        onChange: scheduleSelectedKeybindRefresh },
    selectionInitialized: { type: OptionType.BOOLEAN, description: "Sélection initialisée", default: false, hidden: true },
    streamDeckManagedMode: { type: OptionType.BOOLEAN, description: "Gestion depuis Stream Deck", default: false, hidden: true }
});
function recordingInputSuppressed() { return false; }
function notifyState() { sendSnapshot(); }
function notifyKeybindList() { sendSnapshot(); }


type CapturedKeybind = {
    id: number;
    shortcut: any[];
    callback: (isDown: boolean) => unknown;
    guardedCallback: (isDown: boolean) => unknown;
    options: any;
    signature: string | null;
    custom: boolean;
    registered: boolean;
    held: boolean;
};

const TOGGLE_ID = 1396921420;

function nativeShortcutSignature(shortcut: unknown): string | null {
    if (!Array.isArray(shortcut) || !shortcut.length)
        return null;
    const keys = new Set<string>();
    for (const key of shortcut) {
        if (!Array.isArray(key) || (key.length !== 2 && key.length !== 3)
            || key.slice(0, 2).some(value => typeof value !== "number" && (typeof value !== "string" || !value.trim()))
            || (key.length === 3 && typeof key[2] !== "string"))
            return null;
        const [type, code] = key.map(Number);
        if (!Number.isInteger(type) || type < 0 || !Number.isInteger(code) || code <= 0)
            return null;
        keys.add(`${type}:${code}`);
    }
    return [...keys].sort().join("|");
}

function getDiscordShortcutBindings(): any[] {
    return Object.values(getDiscordState()).filter(keybind => keybind
        && Number.isFinite(Number(keybind.id)) && Number(keybind.id) !== TOGGLE_ID
        && typeof keybind.action === "string" && keybind.action !== "UNASSIGNED"
        && nativeShortcutSignature(keybind.shortcut) !== null);
}

let observedConflictSnapshot = "";

function setKeybindSelection(ids: string[], checked: boolean) {
    const selection = getSelectedIds();
    for (const id of ids) {
        if (checked)
            selection.add(id);
        else
            selection.delete(id);
    }
    settings.store.selectedKeybindIds = [...selection];
    scheduleSelectedKeybindRefresh();
}

function keyCodeName(type: number, code: number) {
    /*
     * Les raccourcis souris personnalisés de Discord
     * sont enregistrés avec le type 1.
     */
    if (type === 1) {
        return `MOUSE${code}`;
    }
    const names: Record<number, string> = {
        8: "BACKSPACE",
        9: "TAB",
        13: "ENTER",
        27: "ESC",
        32: "SPACE",
        33: "PAGE UP",
        34: "PAGE DOWN",
        35: "END",
        36: "HOME",
        37: "LEFT",
        38: "UP",
        39: "RIGHT",
        40: "DOWN",
        45: "INSERT",
        46: "DELETE",
        112: "F1",
        113: "F2",
        114: "F3",
        115: "F4",
        116: "F5",
        117: "F6",
        118: "F7",
        119: "F8",
        120: "F9",
        121: "F10",
        122: "F11",
        123: "F12",
        124: "F13",
        125: "F14",
        126: "F15",
        127: "F16",
        128: "F17",
        129: "F18",
        130: "F19",
        131: "F20",
        132: "F21",
        133: "F22",
        134: "F23",
        135: "F24",
        160: "SHIFT",
        161: "RSHIFT",
        162: "CTRL",
        163: "RCTRL",
        164: "ALT",
        165: "RALT"
    };
    if (names[code]) {
        return names[code];
    }
    /*
     * Lettres A-Z et chiffres 0-9.
     */
    if ((code >= 48 && code <= 57)
        ||
            (code >= 65 && code <= 90)) {
        return String.fromCharCode(code);
    }
    return `KEY ${code}`;
}

function formatShortcut(shortcut: any[]) {
    if (!Array.isArray(shortcut)) {
        return "?";
    }
    return shortcut
        .map(key => {
        if (!Array.isArray(key)) {
            return "?";
        }
        return keyCodeName(Number(key[0]), Number(key[1]));
    })
        .join(" + ");
}

function formatAction(action: string) {
    const names: Record<string, string> = {
        PUSH_TO_MUTE: "Appuyer-pour-rendre-muet",
        PUSH_TO_TALK: "Appuyer-pour-parler",
        TOGGLE_MUTE: "Activer/désactiver le micro",
        TOGGLE_DEAFEN: "Activer/désactiver le son",
        DISCONNECT: "Déconnexion du vocal"
    };
    return names[action]
        ?? action
            .replaceAll("_", " ")
            .toLowerCase();
}

function getCustomDiscordKeybinds(): any[] {
    if (!KeybindStore)
        resolveModules();
    return Object.values(getDiscordState()).filter(keybind => isCustomKeybind(keybind)
        && typeof keybind.action === "string" && keybind.action !== "UNASSIGNED"
        && Array.isArray(keybind.shortcut) && keybind.shortcut.length > 0);
}

let KeybindStore: any = null;

let KeybindActions: any = null;

let NativeInput: any = null;

const captured = new Map<number, CapturedKeybind>();
// Discord can register before publishing its store change. During our synchronous
// recapture transaction, the callback belongs to this exact restored keybind.
const recaptureExpected = new Map<number, { signature: string; shortcut: string }>();

const pendingReleases = new Set<CapturedKeybind>();

const observedKeybinds = new Map<string, string>();

let disabled = false;

let running = false;

let generation = 0;

let selectionRefreshTimer: ReturnType<typeof setTimeout> | null = null;

let refreshTask: Promise<void> | null = null;

let refreshQueued = false;

let baselineReady = false;

let originalRegister: any = null;

let originalUnregister: any = null;

let registerHook: any = null;

let unregisterHook: any = null;

const recaptureAttempts = new Map<number, {
    signature: string;
    time: number;
}>();

function resolveModules() {
    try {
        KeybindStore ??=
            findByProps("getKeybindForAction", "hasKeybind", "getUserAgnosticState");
        KeybindActions ??=
            findByProps("addKeybind", "setKeybind", "deleteKeybind", "enableAll");
        NativeInput ??=
            findByProps("inputEventRegister", "inputEventUnregister", "setFocused");
        return Boolean(KeybindStore
            &&
                KeybindActions
            &&
                NativeInput);
    }
    catch (error) {
        console.error("[ShortcutToggle] Modules Discord introuvables", error);
        return false;
    }
}

function isCustomKeybind(keybind: any): boolean {
    return Boolean(keybind && !keybind.managed
        && Number.isFinite(Number(keybind.id))
        && Number(keybind.id) !== TOGGLE_ID);
}

function isUsableKeybind(keybind: any): boolean {
    return isCustomKeybind(keybind) && Boolean(keybind.enabled)
        && typeof keybind.action === "string" && keybind.action !== "UNASSIGNED"
        && Array.isArray(keybind.shortcut) && keybind.shortcut.length > 0;
}

function getDiscordState(): Record<string, any> {
    return KeybindStore?.getUserAgnosticState?.() ?? {};
}

function getDiscordKeybind(id: number): any {
    const state = getDiscordState();
    return state[String(id)] ?? Object.values(state).find(keybind => Number(keybind?.id) === id);
}

function keybindSignature(keybind: any): string {
    // Include action parameters as well as the key, action and enabled flag.
    return JSON.stringify(keybind, (_key, value) => {
        if (value && typeof value === "object" && !Array.isArray(value)) {
            return Object.fromEntries(Object.keys(value).sort().map(key => [key, value[key]]));
        }
        return value;
    });
}

function getSelectedIds(): Set<string> {
    return new Set((settings.store.selectedKeybindIds ?? []).map(String));
}

function isControlled(id: number): boolean {
    const key = String(id);
    // Protect a new registration even before the deferred store listener runs.
    return getSelectedIds().has(key) || (baselineReady && !observedKeybinds.has(key));
}

function getTargetKeybinds(): any[] {
    return Object.values(getDiscordState()).filter(keybind => isUsableKeybind(keybind) && isControlled(Number(keybind.id)));
}

function initialiseDefaultSelection() {
    if (settings.store.selectionInitialized)
        return;
    settings.store.selectedKeybindIds = getCustomDiscordKeybinds().map(keybind => String(keybind.id));
    settings.store.selectionInitialized = true;
}

function updateKeybindSnapshot() {
    const current = new Map<string, string>();
    for (const keybind of Object.values(getDiscordState())) {
        if (isCustomKeybind(keybind))
            current.set(String(keybind.id), keybindSignature(keybind));
    }
    const selection = getSelectedIds();
    let selectionChanged = false;
    const conflictSnapshot = JSON.stringify(getDiscordShortcutBindings().map(keybind => [
        String(keybind.id), nativeShortcutSignature(keybind.shortcut), keybind.action, Boolean(keybind.enabled)
    ]).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
    let listChanged = !baselineReady || conflictSnapshot !== observedConflictSnapshot;
    observedConflictSnapshot = conflictSnapshot;
    if (baselineReady) {
        for (const [id, signature] of current) {
            if (!observedKeybinds.has(id)) {
                selection.add(id);
                selectionChanged = true;
            }
            if (observedKeybinds.get(id) !== signature)
                listChanged = true;
        }
        for (const id of observedKeybinds.keys()) {
            if (!current.has(id)) {
                if (selection.delete(id))
                    selectionChanged = true;
                listChanged = true;
            }
        }
    }
    observedKeybinds.clear();
    for (const [id, signature] of current)
        observedKeybinds.set(id, signature);
    baselineReady = true;
    if (selectionChanged)
        settings.store.selectedKeybindIds = [...selection];
    if (listChanged)
        notifyKeybindList();
}

function releaseHeld(item: CapturedKeybind) {
    if (!item.held)
        return;
    item.held = false;
    try {
        item.callback(false);
    }
    catch (error) {
        console.error("[ShortcutToggle] Impossible de libérer le raccourci", item.id, error);
    }
}

function queueHeldRelease(item: CapturedKeybind) {
    if (!item.held)
        return;
    item.held = false;
    pendingReleases.add(item);
}

function flushHeldReleases() {
    for (const item of pendingReleases) {
        pendingReleases.delete(item);
        try {
            item.callback(false);
        }
        catch (error) {
            console.error("[ShortcutToggle] Impossible de libérer le raccourci", item.id, error);
        }
    }
}

function registrationMatches(item: CapturedKeybind, keybind: any): boolean {
    return isUsableKeybind(keybind) && item.signature === keybindSignature(keybind)
        && JSON.stringify(item.shortcut) === JSON.stringify(keybind.shortcut);
}

function releaseBlockedKeybinds() {
    for (const item of captured.values()) {
        const current = getDiscordKeybind(item.id);
        if ((item.custom || isCustomKeybind(current))
            && (!registrationMatches(item, current) || recordingInputSuppressed() || (disabled && isControlled(item.id)))) {
            releaseHeld(item);
        }
    }
}

function installNativeHooks() {
    if (registerHook)
        return;
    const input = NativeInput;
    originalRegister = input.inputEventRegister;
    originalUnregister = input.inputEventUnregister;
    const register = originalRegister;
    const unregister = originalUnregister;
    const token = generation;
    registerHook = function (this: any, eventId: number, shortcut: any[], callback: (down: boolean) => unknown, options: any) {
        const id = Number(eventId);
        if (!running || generation !== token || id === TOGGLE_ID || !Number.isFinite(id)) {
            return register.apply(this, arguments);
        }
        const current = getDiscordKeybind(id);
        const expected = recaptureExpected.get(id);
        const previous = captured.get(id);
        if (previous)
            queueHeldRelease(previous);
        const item: CapturedKeybind = {
            id, shortcut: structuredClone(shortcut), callback, options,
            signature: expected?.shortcut === JSON.stringify(shortcut) ? expected.signature
                : isCustomKeybind(current) ? keybindSignature(current) : null,
            custom: isCustomKeybind(current), registered: true, held: false,
            guardedCallback: () => { }
        };
        item.guardedCallback = (isDown: boolean) => {
            if (!running || generation !== token)
                return callback(isDown);
            // Ignore obsolete callbacks, including a delayed key-up after replacement.
            if (!item.registered || captured.get(id) !== item)
                return;
            const latest = getDiscordKeybind(id);
            const custom = item.custom || isCustomKeybind(latest);
            if (custom && (!registrationMatches(item, latest) || recordingInputSuppressed() || (disabled && isControlled(id)))) {
                releaseHeld(item);
                return;
            }
            if (!custom)
                return callback(isDown);
            // A release belonging to a press blocked on OFF must not trigger an action on ON.
            if (!isDown && !item.held)
                return;
            item.held = isDown;
            return callback(isDown);
        };
        captured.set(id, item);
        try {
            return register.call(this, eventId, shortcut, item.guardedCallback, options);
        }
        catch (error) {
            item.registered = false;
            if (previous)
                captured.set(id, previous);
            else
                captured.delete(id);
            throw error;
        }
        finally {
            enqueueKeybindRefresh();
        }
    };
    unregisterHook = function (this: any, eventId: number) {
        if (running && generation === token && Number(eventId) !== TOGGLE_ID) {
            const item = captured.get(Number(eventId));
            if (item) {
                queueHeldRelease(item);
                item.registered = false;
            }
            // An external unregister is respected: OFF/ON will never replay it.
            enqueueKeybindRefresh();
        }
        return unregister.apply(this, arguments);
    };
    input.inputEventRegister = registerHook;
    input.inputEventUnregister = unregisterHook;
}

function removeNativeHooks() {
    if (!NativeInput || !registerHook)
        return;
    const input = NativeInput;
    if (input.inputEventRegister === registerHook)
        input.inputEventRegister = originalRegister;
    if (input.inputEventUnregister === unregisterHook)
        input.inputEventUnregister = originalUnregister;
    // Remove callback guards using only registrations Discord still considers current.
    for (const item of captured.values()) {
        if (!item.registered)
            continue;
        const current = getDiscordKeybind(item.id);
        try {
            if ((item.custom || isCustomKeybind(current)) && !registrationMatches(item, current)) {
                originalUnregister.call(input, item.id);
            }
            else {
                originalRegister.call(input, item.id, item.shortcut, item.callback, item.options);
            }
        }
        catch (error) {
            console.error("[ShortcutToggle] Nettoyage du raccourci impossible", item.id, error);
        }
    }
    registerHook = null;
    unregisterHook = null;
    originalRegister = null;
    originalUnregister = null;
}

function scheduleSelectedKeybindRefresh() {
    if (!running || !NativeInput || !registerHook)
        return;
    // This check is synchronous, including changes made outside our selector.
    releaseBlockedKeybinds();
    enqueueKeybindRefresh();
}

function enqueueKeybindRefresh() {
    if (!running || !NativeInput || !registerHook)
        return;
    if (refreshTask) {
        refreshQueued = true;
        return;
    }
    if (selectionRefreshTimer)
        return;
    selectionRefreshTimer = setTimeout(() => {
        selectionRefreshTimer = null;
        void refreshSelectedKeybinds();
    }, 0);
}

async function recaptureKeybind(current: any) {
    const id = Number(current.id);
    const paused = { ...current, enabled: false };
    const pausedSignature = keybindSignature(paused);
    let pauseResult: unknown;
    let restoreResult: unknown;
    try {
        // Discord skips native registration for an identical setKeybind call.
        // Both dispatches run in this same turn, with no await between them.
        pauseResult = KeybindActions.setKeybind(paused);
    } finally {
        const latest = getDiscordKeybind(id);
        // Do not resurrect a deleted entry or overwrite a synchronous external edit.
        if (latest && keybindSignature(latest) === pausedSignature) {
            const restored = { ...latest, enabled: current.enabled };
            recaptureExpected.set(id, { signature: keybindSignature(restored), shortcut: JSON.stringify(restored.shortcut) });
            try { restoreResult = KeybindActions.setKeybind(restored); }
            finally { recaptureExpected.delete(id); }
        }
    }
    await Promise.all([pauseResult, restoreResult]);
}

async function reconcileKeybinds(token: number) {
    flushHeldReleases();
    updateKeybindSnapshot();
    releaseBlockedKeybinds();
    // Remove deleted registrations and their callbacks; never restore them on ON.
    for (const [id, item] of captured) {
        const current = getDiscordKeybind(id);
        if (item.custom && !isCustomKeybind(current)) {
            if (item.registered)
                NativeInput.inputEventUnregister(id);
            captured.delete(id);
            recaptureAttempts.delete(id);
        }
    }
    // Capture all custom keys, so selecting an existing key while OFF takes effect immediately.
    const ids = Object.values(getDiscordState()).filter(isUsableKeybind).map(keybind => Number(keybind.id));
    for (const id of ids) {
        if (!running || generation !== token)
            return;
        const current = getDiscordKeybind(id);
        if (!isUsableKeybind(current))
            continue;
        const item = captured.get(id);
        if (item && registrationMatches(item, current)) {
            recaptureAttempts.delete(id);
            continue;
        }
        const signature = keybindSignature(current);
        const attempt = recaptureAttempts.get(id);
        // A failed capture is retried without flooding Discord or blocking the hotkey.
        if (attempt?.signature === signature && Date.now() - attempt.time < 2000)
            continue;
        recaptureAttempts.set(id, { signature, time: Date.now() });
        try {
            // Read immediately before dispatch; retain Discord's own enabled flag and options.
            await recaptureKeybind(current);
            if (!running || generation !== token)
                return;
            const latest = captured.get(id);
            if (latest && registrationMatches(latest, getDiscordKeybind(id)))
                recaptureAttempts.delete(id);
        }
        catch (error) {
            console.error("[ShortcutToggle] Capture du raccourci impossible", id, error);
        }
    }
}

function refreshSelectedKeybinds(): Promise<void> {
    if (!running || !registerHook)
        return Promise.resolve();
    if (refreshTask) {
        refreshQueued = true;
        return refreshTask;
    }
    const token = generation;
    // Defer to the next microtask, so even synchronous registrations see the assigned task.
    const task = Promise.resolve().then(async () => {
        do {
            refreshQueued = false;
            if (!running || generation !== token)
                return;
            await reconcileKeybinds(token);
        } while (refreshQueued && running && generation === token);
    }).catch(error => {
        console.error("[ShortcutToggle] Synchronisation des raccourcis impossible", error);
    }).finally(() => {
        if (refreshTask === task) { refreshTask = null; notifyState(); }
    });
    refreshTask = task;
    return task;
}


type WireKeybind = { id: string; key: string; action: string; actionLabel: string; enabled: boolean; selected: boolean };
type WireState = { type: "state"; protocolVersion: 2; bridgeVersion: string; session: string; ready: boolean;
    disabled: boolean; revision: number; error: string; keybinds: WireKeybind[] };
let initialized = false;
let initializing = false;
let initTimer: ReturnType<typeof setInterval> | null = null;
let watchTimer: ReturnType<typeof setInterval> | null = null;
let subscribedStore: any = null;
let socket: WebSocket | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let connectTimer: ReturnType<typeof setTimeout> | null = null;
let session = "";
let revision = 0;
let lastSignature = "";
let startupError = "Initialisation du connecteur Discord…";
const commandReplies = new Map<string, { ok: boolean; error: string }>();

function protectionReady(): boolean {
    return initialized && getTargetKeybinds().every(keybind => {
        const item = captured.get(Number(keybind.id));
        return Boolean(item && registrationMatches(item, keybind));
    });
}
function snapshot(): WireState {
    const selected = getSelectedIds();
    const ready = protectionReady();
    const keybinds = Object.values(getDiscordState()).filter(isCustomKeybind).map(keybind => ({
        id: String(keybind.id), key: formatShortcut(keybind.shortcut).slice(0, 100),
        action: String(keybind.action ?? "UNASSIGNED").slice(0, 80),
        actionLabel: formatAction(String(keybind.action ?? "UNASSIGNED")).slice(0, 120),
        enabled: Boolean(keybind.enabled), selected: selected.has(String(keybind.id))
    })).sort((left, right) => Number(left.id) - Number(right.id)).slice(0, 200);
    const pending = getTargetKeybinds().filter(keybind => {
        const item = captured.get(Number(keybind.id));
        return !item || !registrationMatches(item, keybind);
    });
    const error = ready ? "" : initialized ? ("Synchronisation en attente : " + pending.slice(0, 8).map(keybind => {
        return formatShortcut(keybind.shortcut);
    }).join(", ")).slice(0, 400) : startupError;
    const signature = JSON.stringify({ ready, disabled, keybinds, error });
    if (signature !== lastSignature) { lastSignature = signature; revision++; }
    return { type: "state", protocolVersion: 2, bridgeVersion: BRIDGE_VERSION, session,
        ready, disabled, revision, error, keybinds };
}
function send(message: unknown) {
    if (!running || socket?.readyState !== WebSocket.OPEN) return;
    try { socket.send(JSON.stringify(message)); } catch { closeSocket(); scheduleReconnect(); }
}
function sendSnapshot() { if (running) send(snapshot()); }
function acknowledge(requestId: string, ok: boolean, error: string) {
    commandReplies.set(requestId, { ok, error });
    if (commandReplies.size > 64) commandReplies.delete(commandReplies.keys().next().value!);
    send({ type: "ack", protocolVersion: 2, requestId, ok, error, state: snapshot() });
}
function receive(data: unknown) {
    if (typeof data !== "string" || data.length > 65536) return;
    let message: any;
    try { message = JSON.parse(data); } catch { return; }
    if (!message || typeof message !== "object" || Array.isArray(message)) return;
    if (message.type === "getState") { sendSnapshot(); return; }
    if (message.type !== "command" || message.protocolVersion !== 2 || typeof message.requestId !== "string"
        || !/^[A-Za-z0-9-]{1,80}$/.test(message.requestId)) return;
    const requestId = message.requestId;
    if (message.session !== session) { acknowledge(requestId, false, "La session Discord a changé. Réessaie."); return; }
    const previous = commandReplies.get(requestId);
    if (previous) { send({ type: "ack", protocolVersion: 2, requestId, ...previous, state: snapshot() }); return; }
    if (!protectionReady()) { acknowledge(requestId, false, snapshot().error); return; }
    try {
        if (message.command === "setDisabled" && typeof message.value === "boolean") {
            disabled = message.value;
            releaseBlockedKeybinds();
            scheduleSelectedKeybindRefresh();
        } else if (message.command === "selection" && Array.isArray(message.ids) && message.ids.length <= 200
            && typeof message.selected === "boolean") {
            const current = snapshot();
            if (message.baseRevision !== current.revision) {
                acknowledge(requestId, false, "La liste a changé dans Discord. Elle vient d’être actualisée."); return;
            }
            const known = new Set(current.keybinds.map(keybind => keybind.id));
            if (!message.ids.every((id: unknown) => typeof id === "string" && known.has(id))) {
                acknowledge(requestId, false, "Ce raccourci n’existe plus dans Discord."); return;
            }
            setKeybindSelection([...new Set<string>(message.ids)], message.selected);
        } else { acknowledge(requestId, false, "Commande inconnue ou invalide."); return; }
        sendSnapshot();
        acknowledge(requestId, true, "");
    } catch {
        acknowledge(requestId, false, "Discord n’a pas confirmé la modification.");
    }
}
function closeSocket() {
    if (connectTimer) clearTimeout(connectTimer);
    connectTimer = null;
    const current = socket; socket = null;
    if (!current) return;
    current.onopen = current.onclose = current.onerror = current.onmessage = null;
    try { current.close(); } catch {}
}
function scheduleReconnect() {
    if (!running || reconnectTimer) return;
    reconnectTimer = setTimeout(() => { reconnectTimer = null; connect(); }, 2000);
}
function connect() {
    if (!running || socket) return;
    const token = generation;
    try {
        const current = new WebSocket("ws://127.0.0.1:45873"); socket = current;
        const active = () => running && generation === token && socket === current;
        const lost = () => { if (active()) { closeSocket(); scheduleReconnect(); } };
        connectTimer = setTimeout(lost, 5000);
        current.onopen = () => {
            if (!active()) return;
            if (connectTimer) clearTimeout(connectTimer); connectTimer = null;
            send({ type: "hello", protocolVersion: 2, role: "control", session }); sendSnapshot();
        };
        current.onmessage = event => { if (active()) receive(event.data); };
        current.onclose = lost; current.onerror = lost;
    } catch { closeSocket(); scheduleReconnect(); }
}
function onDiscordChange() { enqueueKeybindRefresh(); }
async function initialize() {
    if (!running || initialized || initializing) return;
    if (!resolveModules()) return;
    initializing = true;
    const token = generation;
    try {
        if (!settings.store.streamDeckManagedMode) {
            // First migration into Stream Deck management: control every custom keybind by default.
            settings.store.selectedKeybindIds = Object.values(getDiscordState()).filter(isCustomKeybind).map(keybind => String(keybind.id));
            settings.store.selectionInitialized = true;
            settings.store.streamDeckManagedMode = true;
        }
        initialiseDefaultSelection(); updateKeybindSnapshot(); installNativeHooks();
        if (!subscribedStore && typeof KeybindStore.addChangeListener === "function") {
            KeybindStore.addChangeListener(onDiscordChange); subscribedStore = KeybindStore;
        }
        await refreshSelectedKeybinds();
        if (!running || generation !== token) return;
        initialized = true; startupError = ""; sendSnapshot();
    } catch { startupError = "Le connecteur ne peut pas accéder aux raccourcis natifs de Discord."; }
    finally { if (generation === token) initializing = false; }
}
export default definePlugin({
    name: "ShortcutToggle",
    description: "Connecteur Discord de Discord Shortcuts. Les réglages se trouvent dans Stream Deck.",
    authors: [{ name: "Sheixo", id: 942412303800893440n }],
    settings,
    start() {
        if (running) return;
        running = true; generation++; disabled = false;
        session = Date.now().toString(36) + "-" + Math.random().toString(36).slice(2);
        revision = 0; lastSignature = ""; commandReplies.clear();
        startupError = "Initialisation du connecteur Discord…";
        connect();
        if (!IS_DISCORD_DESKTOP) { startupError = "Ce connecteur nécessite Discord officiel avec Vencord sous Windows."; sendSnapshot(); return; }
        initTimer = setInterval(() => { if (!initialized) void initialize(); }, 500);
        watchTimer = setInterval(() => {
            if (!running || !initialized) return;
            scheduleSelectedKeybindRefresh(); sendSnapshot();
        }, 500);
        void initialize();
    },
    stop() {
        running = false; generation++;
        if (initTimer) clearInterval(initTimer); if (watchTimer) clearInterval(watchTimer);
        if (selectionRefreshTimer) clearTimeout(selectionRefreshTimer);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        initTimer = watchTimer = selectionRefreshTimer = null; reconnectTimer = null;
        closeSocket();
        if (subscribedStore) { try { subscribedStore.removeChangeListener(onDiscordChange); } catch {} }
        subscribedStore = null;
        for (const item of captured.values()) releaseHeld(item);
        flushHeldReleases(); removeNativeHooks(); captured.clear(); recaptureExpected.clear(); pendingReleases.clear(); observedKeybinds.clear(); recaptureAttempts.clear();
        baselineReady = false; observedConflictSnapshot = ""; initialized = false; initializing = false;
        refreshQueued = false; refreshTask = null; disabled = false;
        KeybindStore = KeybindActions = NativeInput = null;
    }
});
