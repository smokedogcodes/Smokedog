"use client";

import { io, type Socket } from "socket.io-client";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/types";

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

let socket: GameSocket | null = null;
let socketUrl: string | null = null;

export function getSocketUrl(): string {
  const env = process.env.NEXT_PUBLIC_SOCKET_URL;
  if (env && env.trim()) return env.trim();
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    // Cloudflare hosted frontends (Workers/Pages) connect to the persistent Oracle game server
    if (
      host.endsWith(".workers.dev") ||
      host.endsWith(".pages.dev") ||
      host === "sd.smokedog.workers.dev" ||
      host === "smokedog.duckdns.org"
    ) {
      return "https://smokedog.duckdns.org";
    }
    return window.location.origin;
  }
  return "https://smokedog.duckdns.org";
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
