"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let socketUrl: string | null = null;

/** Map UI worker host → game worker host (Cloudflare workers.dev). */
function gameServerUrlFromUiHost(hostname: string): string | null {
  const workersDev = hostname.match(/^(?:sd|smokedog)\.(.+)\.workers\.dev$/);
  if (workersDev) {
    const prefix = hostname.startsWith("sd.") ? "sd-game" : "smokedog-game";
    return `https://${prefix}.${workersDev[1]}.workers.dev`;
  }
  return null;
}

export function getSocketUrl(): string {
  const env = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (env && env.trim()) return env.trim();
  if (typeof window !== "undefined") {
    const mapped = gameServerUrlFromUiHost(window.location.hostname);
    if (mapped) return mapped;
    return window.location.origin;
  }
  return "http://localhost:3000";
}

/** Drop cached socket (e.g. after URL / deploy changes). */
export function resetSocket() {
  if (!socket) return;
  socket.removeAllListeners();
  socket.disconnect();
  socket = null;
  socketUrl = null;
}

export function getSocket(playerId: string): GameSocket {
  const url = getSocketUrl();
  if (socket && socketUrl === url) {
    if (!socket.connected && !socket.active) {
      socket.auth = { playerId };
      socket.connect();
    }
    return socket;
  }

  resetSocket();
  socketUrl = url;
  socket = io(url, {
    autoConnect: true,
    // Cloudflare game worker is websocket-only (polling returns 400).
    transports: ["websocket"],
    auth: { playerId },
    reconnection: true,
    reconnectionAttempts: 8,
    reconnectionDelay: 500,
    timeout: 12_000,
  });
  return socket;
}
