/* Copyright (c) 2026 Sheixo. SPDX-License-Identifier: GPL-3.0-or-later */
import { randomUUID } from "node:crypto";
export type Keybind = { id: string; key: string; action: string; actionLabel: string; enabled: boolean; selected: boolean };
export type ConnectorState = { type: "state"; protocolVersion: 2; session: string; bridgeVersion: string;
    ready: boolean; disabled: boolean; revision: number; error: string; keybinds: Keybind[] };
export type View = { connected: boolean; disabled: boolean; busy: boolean; revision: number; session: string;
    bridgeVersion: string; error: string; keybinds: Keybind[] };
export interface Socket {
    readyState: number; send(data: string, callback?: (error?: Error) => void): void; terminate(): void; ping(): void;
    on(event: string, callback: (...args: any[]) => void): unknown;
}
type Client = { socket: Socket; hello: string; state: ConnectorState | null; order: number; alive: boolean;
    lastStateAt: number; waitingAt: number | null; confirmed: boolean; legacy: boolean };
type Mutation = { command: "setDisabled"; value: boolean } | { command: "selection"; ids: string[]; selected: boolean; baseRevision: number };
function record(value: unknown): value is Record<string, unknown> { return !!value && typeof value === "object" && !Array.isArray(value); }
function text(value: unknown, max: number): value is string { return typeof value === "string" && value.length <= max; }
export function validState(value: unknown): value is ConnectorState {
    if (!record(value) || value.type !== "state" || value.protocolVersion !== 2 || !text(value.session, 100) || !value.session
        || !text(value.bridgeVersion, 30) || typeof value.ready !== "boolean" || typeof value.disabled !== "boolean"
        || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !text(value.error, 400)
        || !Array.isArray(value.keybinds) || value.keybinds.length > 200) return false;
    const ids = new Set<string>();
    return value.keybinds.every(keybind => {
        if (!record(keybind) || !text(keybind.id, 16) || !/^\d+$/.test(keybind.id) || ids.has(keybind.id)
            || !text(keybind.key, 100) || !text(keybind.action, 80) || !text(keybind.actionLabel, 120)
            || typeof keybind.enabled !== "boolean" || typeof keybind.selected !== "boolean") return false;
        ids.add(keybind.id); return true;
    });
}
export class ShortcutHub {
    private clients = new Map<Socket, Client>();
    private listeners = new Set<() => void>();
    private active: Client | null = null;
    private sequence = 0;
    private error = "";
    private previousDisabled = false;
    private signature = "";
    private pending: { id: string; client: Client; timer: ReturnType<typeof setTimeout>; resolve: (ok: boolean) => void } | null = null;
    constructor(private now: () => number = Date.now, private timeout = 2500) {}
    getView(): View {
        const state = this.active?.state;
        const connected = !!state?.ready && !!this.active?.confirmed;
        const legacy = [...this.clients.values()].some(client => client.legacy);
        return { connected, disabled: state?.disabled ?? this.previousDisabled, busy: this.pending !== null,
            revision: state?.revision ?? 0, session: state?.session ?? "", bridgeVersion: state?.bridgeVersion ?? "",
            keybinds: state ? structuredClone(state.keybinds) : [],
            error: this.error || (state && !state.ready ? state.error : !connected ? legacy
                ? "Mets à jour le connecteur Discord vers la version 0.3.0." : "Ouvre Discord avec son connecteur ShortcutToggle." : "") };
    }
    subscribe(listener: () => void) { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; }
    private emit() {
        const signature = JSON.stringify(this.getView());
        if (signature === this.signature) return;
        this.signature = signature;
        for (const listener of this.listeners) { try { listener(); } catch {} }
    }
    attach(socket: Socket) {
        if (this.clients.size >= 4) { socket.terminate(); return; }
        const client: Client = { socket, hello: "", state: null, order: ++this.sequence, alive: true,
            lastStateAt: this.now(), waitingAt: this.now(), confirmed: false, legacy: false };
        this.clients.set(socket, client);
        socket.on("message", raw => this.receive(client, String(raw)));
        socket.on("pong", () => { if (this.clients.has(socket)) client.alive = true; });
        socket.on("close", () => this.drop(client)); socket.on("error", () => this.drop(client));
        this.send(client, { type: "getState" });
    }
    private send(client: Client, payload: object): boolean {
        if (!this.clients.has(client.socket) || client.socket.readyState !== 1) return false;
        try { client.socket.send(JSON.stringify(payload), error => { if (error) this.drop(client); }); return this.clients.has(client.socket); }
        catch { this.drop(client); return false; }
    }
    private receive(client: Client, raw: string) {
        if (!this.clients.has(client.socket) || raw.length > 65536) return;
        let message: unknown; try { message = JSON.parse(raw); } catch { return; }
        if (!record(message)) return;
        if (message.type === "hello") {
            if (message.protocolVersion === 2 && message.role === "control" && text(message.session, 100) && message.session) {
                if (client.hello && client.hello !== message.session) { this.drop(client); return; }
                client.hello = message.session; client.alive = true;
            } else { client.legacy = true; this.emit(); }
        } else if (message.type === "state") this.acceptState(client, message);
        else if (message.type === "ack" && message.protocolVersion === 2 && typeof message.ok === "boolean"
            && text(message.error, 400) && validState(message.state) && message.state.session === client.hello) {
            this.acceptState(client, message.state);
            if (this.pending?.client === client && message.requestId === this.pending.id) {
                const pending = this.pending; this.pending = null; clearTimeout(pending.timer);
                this.error = message.ok ? "" : message.error;
                pending.resolve(message.ok); this.emit();
            }
        }
    }
    private acceptState(client: Client, state: unknown) {
        if (!validState(state) || !client.hello || state.session !== client.hello) return;
        if (client.state && state.revision < client.state.revision) return;
        client.state = structuredClone(state); client.alive = true; client.lastStateAt = this.now();
        client.waitingAt = null; client.confirmed = true;
        if (!this.active) { this.active = client; this.error = ""; }
        if (this.active === client) this.previousDisabled = state.disabled;
        this.emit();
    }
    private drop(client: Client) {
        if (!this.clients.delete(client.socket)) return;
        if (this.pending?.client === client) this.finishPending(false);
        if (this.active === client) {
            this.active = [...this.clients.values()].filter(other => other.state && other.confirmed).sort((a,b) => b.order-a.order)[0] ?? null;
        }
        try { client.socket.terminate(); } catch {}
        this.emit();
    }
    private finishPending(ok: boolean) {
        const pending = this.pending; this.pending = null;
        if (pending) { clearTimeout(pending.timer); pending.resolve(ok); }
    }
    tick() {
        for (const client of [...this.clients.values()]) {
            if (!client.alive || (client.waitingAt !== null && this.now() - client.waitingAt >= 5000)) { this.drop(client); continue; }
            client.alive = false;
            try { client.socket.ping(); } catch { this.drop(client); continue; }
            if (client.waitingAt === null && this.now() - client.lastStateAt >= 2000) {
                client.waitingAt = this.now(); this.send(client, { type: "getState" });
            }
        }
    }
    toggle(): Promise<boolean> {
        return this.mutate({ command: "setDisabled", value: !this.getView().disabled });
    }
    select(ids: unknown, selected: unknown, baseRevision: unknown): Promise<boolean> {
        const view = this.getView();
        if (!Array.isArray(ids) || ids.length > 200 || typeof selected !== "boolean" || baseRevision !== view.revision
            || !ids.every(id => typeof id === "string" && view.keybinds.some(keybind => keybind.id === id))) {
            this.error = "La liste a changé. Réessaie sur la liste actualisée."; this.emit(); return Promise.resolve(false);
        }
        return this.mutate({ command: "selection", ids: [...new Set<string>(ids)], selected, baseRevision: view.revision });
    }
    private mutate(mutation: Mutation): Promise<boolean> {
        if (!this.getView().connected || !this.active || this.pending) return Promise.resolve(false);
        const client = this.active;
        return new Promise(resolve => {
            const id = randomUUID();
            const timer = setTimeout(() => {
                if (this.pending?.id !== id) return;
                this.finishPending(false); client.confirmed = false; client.waitingAt = this.now();
                this.error = "Modification non confirmée. Elle ne sera pas répétée automatiquement.";
                this.send(client, { type: "getState" }); this.emit();
            }, this.timeout);
            this.pending = { id, timer, client, resolve }; this.error = "";
            if (!this.send(client, { type: "command", protocolVersion: 2, requestId: id, session: client.hello, ...mutation })) this.finishPending(false);
            this.emit();
        });
    }
    disconnectAll(message: string) {
        this.error = message; for (const client of [...this.clients.values()]) this.drop(client); this.emit();
    }
    stop() { this.disconnectAll("Connexion arrêtée."); this.listeners.clear(); }
}
