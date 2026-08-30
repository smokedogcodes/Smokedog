"use client";

import { getSocket } from "@/lib/socket/client";
import { ensurePlayerId } from "@/lib/profile";

const sentKeys = new Set<string>();

/**
 * Lightweight page-view beacon over the game socket.
 * Counts only when connected; server attaches CF country when available.
 * Dedupes per path per tab session (refresh / new session still counts).
 */
export function emitPageView(opts: {
  path: string;
  roomId?: string;
  gameId?: string;
  onceKey?: string;
}) {
  if (typeof window === "undefined") return;
  const key = opts.onceKey ?? opts.path;
  if (sentKeys.has(key)) return;
  sentKeys.add(key);

  const playerId = ensurePlayerId();
  const socket = getSocket(playerId);
  const payload = {
    path: opts.path,
    playerId,
    ...(opts.roomId ? { roomId: opts.roomId } : {}),
    ...(opts.gameId ? { gameId: opts.gameId } : {}),
  };

  const send = () => socket.emit("analytics:pageView", payload);
  if (socket.connected) send();
  else socket.once("connect", send);
}
