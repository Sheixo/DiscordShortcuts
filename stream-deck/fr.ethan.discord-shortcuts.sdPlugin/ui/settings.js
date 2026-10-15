/* Copyright (c) 2026 Sheixo. SPDX-License-Identifier: GPL-3.0-or-later */
(() => {
    "use strict";
    const UUID = "fr.ethan.discord-shortcuts.toggle";
    const PLUGIN = "fr.ethan.discord-shortcuts";
    const el = id => document.getElementById(id);
    let socket = null, context = "", reconnect = null, registration = null, pending = false, waiting = null;
    let current = { connected: false, disabled: false, busy: false, keybinds: [], revision: 0, error: "" };
    const normalize = value => String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    function filtered(keybinds, query) {
        const tokens = normalize(query).trim().split(/\s+/).filter(Boolean);
        return keybinds.filter(keybind => tokens.every(token => normalize(keybind.key + " " + keybind.actionLabel + " " + keybind.action).includes(token)));
    }
    function send(payload) {
        if (socket?.readyState !== WebSocket.OPEN) return false;
        // Stream Deck validates the sender against the inspector registration UUID,
        // then forwards the message with the action instance context to the plugin.
        socket.send(JSON.stringify({ event: "sendToPlugin", action: UUID, context: registration.uuid, payload })); return true;
    }
    function mutate(payload) {
        if (pending || current.busy || !current.connected) return;
        if (!send(payload)) return;
        pending = true; render();
        clearTimeout(waiting); waiting = setTimeout(() => {
            pending = false; current.error = "La modification n’a pas été confirmée. Actualise avant de réessayer."; render();
        }, 4000);
    }
    function render() {
        const blocked = pending || current.busy || !current.connected;
        const badge = el("state-badge");
        badge.textContent = !current.connected ? "Hors ligne" : current.disabled ? "OFF" : "ON";
        badge.className = "badge" + (current.connected ? current.disabled ? " off" : " on" : "");
        el("connection-label").textContent = current.connected ? "Discord connecté" : "Discord déconnecté";
        el("connection-label").className = "connection" + (current.connected ? " connected" : "");
        el("status-title").textContent = !current.connected ? "En attente de Discord" : current.disabled ? "Raccourcis suspendus" : "Raccourcis activés";
        el("status-description").textContent = !current.connected ? "En attente du connecteur Discord." : current.disabled
            ? "Les actions des raccourcis cochés sont suspendues." : "Les raccourcis cochés peuvent fonctionner.";
        const toggle = el("toggle"); toggle.disabled = blocked;
        toggle.textContent = pending || current.busy ? "Application…" : !current.connected ? "En attente de Discord"
            : current.disabled ? "Réactiver les raccourcis" : "Désactiver les raccourcis";
        toggle.classList.toggle("off", current.disabled);
        el("error").textContent = current.error || ""; el("error").hidden = !current.error;
        const query = el("search").value;
        const visible = filtered(current.keybinds, query);
        el("count").textContent = current.keybinds.filter(keybind => keybind.selected).length + " / " + current.keybinds.length;
        el("select-all").textContent = query.trim() ? "Cocher les résultats" : "Tout cocher";
        el("select-none").textContent = query.trim() ? "Décocher les résultats" : "Tout décocher";
        el("select-all").disabled = el("select-none").disabled = blocked || !visible.length;
        const list = el("keybinds"); list.replaceChildren();
        for (const keybind of visible) {
            const row = document.createElement("label"); row.className = "keybind" + (keybind.selected ? " selected" : "");
            const box = document.createElement("input"); box.type = "checkbox"; box.checked = keybind.selected; box.disabled = blocked;
            box.addEventListener("change", () => mutate({ type: "selection", ids: [keybind.id], selected: box.checked, revision: current.revision }));
            const content = document.createElement("span");
            const action = document.createElement("span"); action.className = "action"; action.textContent = keybind.actionLabel;
            const key = document.createElement("span"); key.className = "chord"; key.textContent = keybind.key || "Aucune touche";
            content.append(action, key);
            if (!keybind.enabled) { const note = document.createElement("span"); note.className = "disabled-note"; note.textContent = "Désactivé dans Discord"; content.append(note); }
            row.append(box, content); list.append(row);
        }
        el("empty").hidden = visible.length > 0;
        el("empty").textContent = !current.connected ? "La liste apparaîtra quand Discord sera connecté." : current.keybinds.length
            ? "Aucun raccourci ne correspond à cette recherche." : "Ajoute ton premier raccourci dans les paramètres Discord.";
        el("connector-version").textContent = current.bridgeVersion ? "Connecteur Discord " + current.bridgeVersion : "Connecteur requis : 0.3.0";
    }
    function receive(message) {
        if (!message || message.event !== "sendToPropertyInspector" || (message.action !== undefined && message.action !== UUID) || message.context !== context
            || !message.payload || message.payload.type !== "managedSettings") return;
        const payload = message.payload;
        const state = payload.state;
        if (!state || typeof state.connected !== "boolean" || typeof state.disabled !== "boolean" || !Array.isArray(state.keybinds)) return;
        current = state;
        if (!state.busy) { pending = false; clearTimeout(waiting); }
        const update = payload.updates;
        if (update) {
            el("version").textContent = update.installedVersion;
            el("automatic").checked = update.automaticChecks === true;
            el("automatic").disabled = !update.initialized;
            el("check-update").disabled = update.status === "checking";
            el("update-status").textContent = update.message || "";
            el("download").hidden = update.status !== "available";
        }
        render();
    }
    function open() {
        if (!registration) return;
        clearTimeout(reconnect); reconnect = null; clearTimeout(waiting); pending = false;
        if (socket) { socket.onclose = null; socket.close(); }
        const currentSocket = new WebSocket("ws://127.0.0.1:" + registration.port); socket = currentSocket;
        currentSocket.onopen = () => {
            if (socket !== currentSocket) return;
            currentSocket.send(JSON.stringify({ event: registration.event, uuid: registration.uuid }));
            send({ type: "getManagedSettings" });
        };
        currentSocket.onmessage = event => { if (socket === currentSocket) { try { receive(JSON.parse(event.data)); } catch {} } };
        currentSocket.onerror = () => currentSocket.close();
        currentSocket.onclose = () => {
            if (socket !== currentSocket) return;
            pending = false; clearTimeout(waiting); current = { ...current, connected: false, error: "Connexion à Stream Deck interrompue." }; render();
            clearTimeout(reconnect); reconnect = setTimeout(open, 1500);
        };
    }
    window.connectElgatoStreamDeckSocket = (port, uuid, event, info, actionInfo) => {
        try {
            const app = JSON.parse(info), action = JSON.parse(actionInfo);
            if (!/^\d{1,5}$/.test(String(port)) || Number(port) < 1 || Number(port) > 65535 || typeof uuid !== "string" || !uuid || uuid.length > 200
                || event !== "registerPropertyInspector" || action.action !== UUID || typeof action.context !== "string" || !action.context || action.context.length > 200
                || (app.plugin?.uuid && app.plugin.uuid !== PLUGIN)) return;
            context = action.context; registration = { port: Number(port), event, uuid }; open();
        } catch {}
    };
    el("search").addEventListener("input", render);
    el("toggle").addEventListener("click", () => mutate({ type: "toggle" }));
    const bulk = selected => mutate({ type: "selection", ids: filtered(current.keybinds, el("search").value).map(keybind => keybind.id), selected, revision: current.revision });
    el("select-all").addEventListener("click", () => bulk(true)); el("select-none").addEventListener("click", () => bulk(false));
    el("refresh").addEventListener("click", () => send({ type: "getManagedSettings" }));
    el("check-update").addEventListener("click", () => send({ type: "checkCompanionUpdates" }));
    el("automatic").addEventListener("change", () => send({ type: "setAutomaticChecks", enabled: el("automatic").checked }));
    for (const link of ["github", "support", "download"]) el(link).addEventListener("click", () => send({ type: "openLink", link }));
    render();
})();
