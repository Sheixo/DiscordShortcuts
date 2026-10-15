/* Copyright (c) 2026 Sheixo. SPDX-License-Identifier: GPL-3.0-or-later */
import streamDeck from "@elgato/streamdeck";
import { WebSocketServer } from "ws";
import { ShortcutHub, type View } from "./hub";
export type BridgeState = View;
export const hub = new ShortcutHub();
let server: WebSocketServer | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let stopped = false;
function start() {
    if (stopped || server) return;
    try {
        const current = new WebSocketServer({ host: "127.0.0.1", port: 45873, maxPayload: 65536,
            verifyClient: (info: { origin: string }) => info.origin === "https://discord.com" });
        server = current;
        current.on("connection", socket => { if (server === current && !stopped) hub.attach(socket); else socket.terminate(); });
        const failed = () => {
            if (server !== current) return;
            server = null; hub.disconnectAll("Connexion locale indisponible. Vérifie qu’une autre version du plugin n’est pas lancée.");
            try { current.close(); } catch {}
            if (!stopped && !retry) retry = setTimeout(() => { retry = null; start(); }, 2000);
        };
        current.on("error", failed); current.on("close", failed);
        current.on("listening", () => streamDeck.logger.info("[Discord Shortcuts] Connecteur local prêt"));
    } catch {
        hub.disconnectAll("Connexion locale indisponible.");
        if (!stopped && !retry) retry = setTimeout(() => { retry = null; start(); }, 2000);
    }
}
const heartbeat = setInterval(() => hub.tick(), 2000);
export const getState = () => hub.getView();
export const subscribe = (listener: (state: View) => void) => {
    const unsubscribe = hub.subscribe(() => listener(getState())); listener(getState()); return unsubscribe;
};
export const toggle = () => hub.toggle();
export function stopBridge() {
    stopped = true; clearInterval(heartbeat); if (retry) clearTimeout(retry); retry = null;
    hub.stop(); try { server?.close(); } catch {} server = null;
}
process.once("exit", stopBridge);
start();
