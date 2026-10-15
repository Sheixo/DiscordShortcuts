/* Copyright (c) 2026 Sheixo. SPDX-License-Identifier: GPL-3.0-or-later */
import streamDeck from "@elgato/streamdeck";
import { getState, hub, subscribe, toggle } from "./bridge";
import { CompanionUpdates, REPOSITORY_URL } from "./updates";
const ACTION_UUID = "fr.ethan.discord-shortcuts.toggle";
let updates: CompanionUpdates | null = null;
export function initializeInspector() {
    updates = new CompanionUpdates(streamDeck.info.plugin.version, {
        readSettings: () => streamDeck.settings.getGlobalSettings(),
        writeSettings: value => streamDeck.settings.setGlobalSettings(value as Parameters<typeof streamDeck.settings.setGlobalSettings>[0]),
        request: fetch
    });
    const refresh = async () => {
        if (streamDeck.ui.action?.manifestId !== ACTION_UUID) return;
        try { await streamDeck.ui.sendToPropertyInspector({ type: "managedSettings", state: getState(), updates: updates!.getView() }); }
        catch { streamDeck.logger.warn("[Discord Shortcuts] Réglages indisponibles"); }
    };
    updates.subscribe(() => { void refresh(); }); subscribe(() => { void refresh(); });
    streamDeck.ui.onDidAppear(ev => { if (ev.action.manifestId === ACTION_UUID) void refresh(); });
    streamDeck.ui.onSendToPlugin(ev => {
        if (ev.action.manifestId !== ACTION_UUID || !ev.payload || typeof ev.payload !== "object" || Array.isArray(ev.payload)) return;
        const message = ev.payload;
        void (async () => {
            if (message.type === "getManagedSettings") { await updates!.initialize(); await refresh(); }
            else if (message.type === "toggle") { await toggle(); await refresh(); }
            else if (message.type === "selection") { await hub.select(message.ids, message.selected, message.revision); await refresh(); }
            else if (message.type === "checkCompanionUpdates") { await updates!.check(); await refresh(); }
            else if (message.type === "setAutomaticChecks" && typeof message.enabled === "boolean") {
                await updates!.setAutomaticChecks(message.enabled); await refresh();
            } else if (message.type === "openLink") {
                const links = { github: REPOSITORY_URL, support: `${REPOSITORY_URL}/blob/main/docs/INSTALLATION.fr.md`,
                    download: updates!.getView().downloadUrl, release: updates!.getView().releaseUrl };
                if (typeof message.link === "string" && Object.hasOwn(links, message.link)) {
                    const url = links[message.link as keyof typeof links];
                    if (url) await streamDeck.system.openUrl(url);
                }
            }
        })().catch(() => { streamDeck.logger.warn("[Discord Shortcuts] Modification indisponible"); void refresh(); });
    });
    process.once("exit", () => updates?.stop());
}
export async function startCompanionUpdates() { await updates?.initialize(); }
