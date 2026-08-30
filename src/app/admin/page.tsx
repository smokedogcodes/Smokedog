"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSocket, getSocketUrl } from "@/lib/socket/client";
import { ensurePlayerId } from "@/lib/profile";
import { gameLabel } from "@/lib/games/labels";
import type { ServerToClientEvents } from "@/lib/types";

type Snapshot = ServerToClientEvents["admin:snapshot"] extends (
  payload: infer P
) => void
  ? P
  : never;

type RoomLookup = ServerToClientEvents["admin:roomLookup"] extends (
  payload: infer P
) => void
  ? P
  : never;

type Analytics = ServerToClientEvents["admin:analytics"] extends (
  payload: infer P
) => void
  ? P
  : never;

const TOKEN_KEY = "smokedog.admin.token";
const POLL_MS = 3000;

function readToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

function writeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

function formatCloseReason(reason: string | null, closedAt: number | null) {
  if (!closedAt) return "Still open (live)";
  switch (reason) {
    case "host_afk":
      return "Host socket offline 5+ min in lobby";
    case "host_quit":
      return "Host left while alone in lobby";
    case "empty":
      return "All players left (lobby)";
    case "ended_empty":
      return "All players left (mid-game)";
    case "server_lost":
      return "Lost from live server memory (redeploy / DO restart)";
    default:
      return reason ? `Closed — ${reason}` : "Closed (reason unknown)";
  }
}

function formatPhase(phase: string) {
  return phase.replace(/_/g, " ");
}

function ago(ts: number) {
  const s = Math.max(0, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

function formatDuration(ms: number | null) {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return "—";
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m` : `${h}h`;
}

function countryLabel(code: string) {
  if (!code || code === "??") return "Unknown";
  try {
    const dn = new Intl.DisplayNames(["en"], { type: "region" });
    return dn.of(code) ?? code;
  } catch {
    return code;
  }
}

function BarRows({
  rows,
  max,
}: {
  rows: Array<{ label: string; value: number; sub?: string }>;
  max: number;
}) {
  const ceiling = Math.max(1, max);
  return (
    <div className="space-y-2">
      {rows.length === 0 && (
        <p className="text-sm text-ink-steel">No data in this range yet.</p>
      )}
      {rows.map((r) => (
        <div key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate">{r.label}</span>
            <span className="shrink-0 font-mono text-xs text-ink-steel">
              {r.value}
              {r.sub ? ` · ${r.sub}` : ""}
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-sm bg-crimson/10">
            <div
              className="h-full rounded-sm bg-crimson/70"
              style={{ width: `${Math.max(2, (r.value / ceiling) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function SeriesChart({
  series,
  metric,
}: {
  series: Analytics["series"];
  metric: "visits" | "rooms" | "games" | "joins";
}) {
  const values = series.map((s) => s[metric]);
  const max = Math.max(1, ...values);
  const w = Math.max(320, series.length * 28);
  const h = 120;
  const pad = 8;
  const barW = Math.max(4, (w - pad * 2) / series.length - 4);

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="h-32 w-full min-w-[20rem]"
        role="img"
        aria-label={`${metric} over time`}
      >
        {series.map((s, i) => {
          const v = s[metric];
          const barH = (v / max) * (h - pad * 2 - 16);
          const x = pad + i * ((w - pad * 2) / series.length);
          const y = h - pad - 14 - barH;
          return (
            <g key={s.day}>
              <rect
                x={x}
                y={y}
                width={barW}
                height={Math.max(v > 0 ? 2 : 0, barH)}
                fill="currentColor"
                className="text-crimson"
                opacity={0.75}
              />
              {series.length <= 14 && (
                <text
                  x={x + barW / 2}
                  y={h - 2}
                  textAnchor="middle"
                  className="fill-current text-[8px] text-ink-steel"
                >
                  {s.day.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

export default function AdminPage() {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [authed, setAuthed] = useState(false);
  const [resuming, setResuming] = useState(() => !!readToken());
  const [tab, setTab] = useState<
    "live" | "history" | "logs" | "lookup" | "analytics"
  >("live");
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [lookupCode, setLookupCode] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookup, setLookup] = useState<RoomLookup | null>(null);
  const [analyticsRange, setAnalyticsRange] = useState<
    "day" | "week" | "month"
  >("week");
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsMetric, setAnalyticsMetric] = useState<
    "visits" | "rooms" | "games" | "joins"
  >("visits");
  const [lastPollAt, setLastPollAt] = useState<number | null>(null);
  const [socketUrl] = useState(() =>
    typeof window !== "undefined" ? getSocketUrl() : ""
  );
  const authEpochRef = useRef(0);

  const refresh = useCallback(() => {
    const socket = getSocket(ensurePlayerId());
    const token = readToken() ?? undefined;
    socket.emit("admin:snapshot", token ? { token } : undefined);
  }, []);

  const refreshAnalytics = useCallback(
    (range: "day" | "week" | "month" = analyticsRange) => {
      const socket = getSocket(ensurePlayerId());
      const token = readToken() ?? undefined;
      setAnalyticsLoading(true);
      socket.emit("admin:analytics", {
        range,
        ...(token ? { token } : {}),
      });
    },
    [analyticsRange]
  );

  useEffect(() => {
    const socket = getSocket(ensurePlayerId());

    const onAuth = (payload: {
      ok: boolean;
      message?: string;
      token?: string;
    }) => {
      setResuming(false);
      if (!payload.ok) {
        setAuthed(false);
        setError(payload.message ?? "Unauthorized");
        clearToken();
        return;
      }
      setAuthed(true);
      setError(null);
      if (payload.token) writeToken(payload.token);
      const token = payload.token ?? readToken() ?? undefined;
      socket.emit("admin:snapshot", token ? { token } : undefined);
    };

    const listenAuthOnce = () => {
      const epoch = authEpochRef.current;
      socket.once("admin:auth", (payload) => {
        if (epoch !== authEpochRef.current) return;
        onAuth(payload);
      });
    };

    const onSnap = (payload: Snapshot) => {
      setAuthed(true);
      setResuming(false);
      setSnap(payload);
      setLastPollAt(Date.now());
    };

    const onLookup: ServerToClientEvents["admin:roomLookup"] = (payload) => {
      setLookupLoading(false);
      setLookup(payload);
    };

    const onAnalytics: ServerToClientEvents["admin:analytics"] = (payload) => {
      setAnalyticsLoading(false);
      setAnalytics(payload);
    };

    socket.on("admin:snapshot", onSnap);
    socket.on("admin:roomLookup", onLookup);
    socket.on("admin:analytics", onAnalytics);

    const tryResume = () => {
      const token = readToken();
      if (!token) {
        setResuming(false);
        return;
      }
      setResuming(true);
      authEpochRef.current += 1;
      listenAuthOnce();
      socket.emit("admin:resume", { token });
    };

    if (socket.connected) tryResume();
    else socket.once("connect", tryResume);

    return () => {
      authEpochRef.current += 1;
      socket.off("admin:snapshot", onSnap);
      socket.off("admin:roomLookup", onLookup);
      socket.off("admin:analytics", onAnalytics);
    };
  }, []);

  useEffect(() => {
    if (!authed) return;
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [authed, refresh]);

  useEffect(() => {
    if (!authed || tab !== "analytics") return;
    refreshAnalytics(analyticsRange);
  }, [authed, tab, analyticsRange, refreshAnalytics]);

  const login = () => {
    setError(null);
    setResuming(false);
    clearToken();
    authEpochRef.current += 1;
    const socket = getSocket(ensurePlayerId());
    const epoch = authEpochRef.current;
    const send = () => {
      socket.once("admin:auth", (payload) => {
        if (epoch !== authEpochRef.current) return;
        setResuming(false);
        if (!payload.ok) {
          setAuthed(false);
          setError(payload.message ?? "Invalid credentials");
          clearToken();
          return;
        }
        setAuthed(true);
        setError(null);
        if (payload.token) writeToken(payload.token);
        const token = payload.token ?? readToken() ?? undefined;
        socket.emit("admin:snapshot", token ? { token } : undefined);
      });
      socket.emit("admin:login", { user, password });
    };
    if (socket.connected) send();
    else socket.once("connect", send);
  };

  const runLookup = () => {
    const code = lookupCode.trim().toUpperCase();
    if (!code) return;
    setLookupCode(code);
    setLookupLoading(true);
    setLookup(null);
    const socket = getSocket(ensurePlayerId());
    const token = readToken() ?? undefined;
    const send = () =>
      socket.emit("admin:roomLookup", {
        code,
        ...(token ? { token } : {}),
      });
    if (socket.connected) send();
    else socket.once("connect", send);
  };

  if (!authed) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6">
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-crimson-glow">
          Restricted
        </p>
        <h1 className="mt-2 font-display text-3xl font-bold">Admin</h1>
        {resuming ? (
          <p className="mt-6 font-mono text-xs uppercase tracking-widest text-ink-steel">
            Restoring session…
          </p>
        ) : (
          <>
            <label className="mt-6 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
              User ID
            </label>
            <input
              value={user}
              onChange={(e) => setUser(e.target.value)}
              autoComplete="username"
              className="mt-1 border-b border-crimson/30 bg-transparent py-2 outline-none"
            />
            <label className="mt-4 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="mt-1 border-b border-crimson/30 bg-transparent py-2 outline-none"
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            {error && <p className="mt-3 text-sm text-crimson">{error}</p>}
            <button
              type="button"
              onClick={login}
              className="mt-6 rounded-sm border border-crimson bg-crimson py-3 font-mono text-xs uppercase tracking-widest text-manila"
            >
              Sign in
            </button>
          </>
        )}
        <Link href="/" className="mt-4 text-center text-sm text-ink-steel">
          Back to Game Hub
        </Link>
      </div>
    );
  }

  const tabs = [
    { id: "live" as const, label: "Live rooms" },
    { id: "history" as const, label: "Room history" },
    { id: "logs" as const, label: "Game logs" },
    { id: "lookup" as const, label: "Room lookup" },
    { id: "analytics" as const, label: "Analytics" },
  ];

  return (
    <div className="mx-auto min-h-screen max-w-5xl px-4 py-8 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-crimson-glow">
            Ops
          </p>
          <h1 className="font-display text-3xl font-bold">Admin panel</h1>
          <p className="mt-1 text-sm text-ink-steel">
            Live socket:{" "}
            <span className="font-mono text-xs text-crimson">
              {snap?.health.socketHost
                ? `https://${snap.health.socketHost}`
                : socketUrl || "—"}
            </span>
            {" · "}poll every {POLL_MS / 1000}s
            {lastPollAt ? ` · updated ${ago(lastPollAt)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="rounded-sm border border-crimson bg-crimson px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-manila"
          >
            Game Hub
          </Link>
          <button
            type="button"
            onClick={refresh}
            className="rounded-sm border border-crimson/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest"
          >
            Refresh now
          </button>
          <button
            type="button"
            onClick={() => {
              setAuthed(false);
              clearToken();
            }}
            className="rounded-sm border border-crimson/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest"
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="mt-6 flex flex-wrap gap-2 border-b border-crimson/20">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 font-mono text-[10px] uppercase tracking-widest ${
              tab === t.id
                ? "border-b-2 border-crimson text-crimson"
                : "text-ink-steel"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "live" && (
        <div className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-sm border border-crimson/20 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Live rooms now
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {snap?.health.roomCount ?? "—"}
              </p>
              <p className="text-xs text-ink-steel">
                In Socket.io memory right now
              </p>
            </div>
            <div className="rounded-sm border border-crimson/20 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Room history rows
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {snap?.health.storedRoomEvents ?? "—"}
              </p>
              <p className="text-xs text-ink-steel">
                Open + closed records in SQLite
              </p>
            </div>
            <div className="rounded-sm border border-crimson/20 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Game log lines
              </p>
              <p className="mt-1 font-display text-2xl font-bold">
                {snap?.health.storedGameLogs ?? "—"}
              </p>
              <p className="text-xs text-ink-steel">Stored play / system logs</p>
            </div>
          </div>

          <p className="text-sm text-ink-steel">
            This table is the source of truth for{" "}
            <span className="font-semibold text-ink">currently playable</span>{" "}
            rooms. History can lag; orphans are auto-closed on each poll.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                  <th className="py-2 pr-3" title="6-letter room code">
                    Room code
                  </th>
                  <th className="pr-3" title="Which game is running">
                    Game
                  </th>
                  <th className="pr-3" title="Lobby / turn / bomb / etc.">
                    Phase
                  </th>
                  <th className="pr-3" title="Human seats (connected / total)">
                    Humans
                  </th>
                  <th className="pr-3" title="AI seats">
                    Bots
                  </th>
                  <th className="pr-3">Host</th>
                  <th className="pr-3" title="When the room was created">
                    Created
                  </th>
                  <th title="Host paused the match">Paused</th>
                </tr>
              </thead>
              <tbody>
                {(snap?.roomsOpen ?? []).length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-6 text-ink-steel">
                      No live rooms in Socket.io memory right now.
                    </td>
                  </tr>
                )}
                {(snap?.roomsOpen ?? []).map((r) => (
                  <tr key={r.code} className="border-t border-crimson/10">
                    <td className="py-2 pr-3 font-mono font-bold">{r.code}</td>
                    <td className="pr-3">{gameLabel(r.gameId)}</td>
                    <td className="pr-3">{formatPhase(r.phase)}</td>
                    <td className="pr-3">
                      {r.connected ?? "—"}/{r.players} connected
                    </td>
                    <td className="pr-3">{r.bots ?? 0}</td>
                    <td className="pr-3">{r.host ?? "—"}</td>
                    <td className="pr-3">
                      {new Date(r.createdAt).toLocaleString()}
                    </td>
                    <td>{r.paused ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "history" && (
        <div className="mt-6 space-y-3">
          <p className="text-sm text-ink-steel">
            Every room that was created, plus how / when it closed.{" "}
            <span className="font-semibold text-ink">Status</span> is derived
            from live memory + close reason.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                  <th className="py-2 pr-3">Room code</th>
                  <th className="pr-3">Host name</th>
                  <th className="pr-3">Game</th>
                  <th className="pr-3">Opened at</th>
                  <th className="pr-3">Closed at</th>
                  <th title="Why the room stopped existing">
                    Why it closed
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...(snap?.roomEvents ?? [])].reverse().map((e) => {
                  const live = (snap?.roomsOpen ?? []).some(
                    (r) => r.code.toUpperCase() === e.code.toUpperCase()
                  );
                  const closedAt = e.closedAt;
                  const reason = e.reason;
                  return (
                    <tr key={e.id} className="border-t border-crimson/10">
                      <td className="py-2 pr-3 font-mono">{e.code}</td>
                      <td className="pr-3">{e.hostName}</td>
                      <td className="pr-3">{gameLabel(e.gameId)}</td>
                      <td className="pr-3">
                        {new Date(e.openedAt).toLocaleString()}
                      </td>
                      <td className="pr-3">
                        {closedAt
                          ? new Date(closedAt).toLocaleString()
                          : live
                            ? "— (live)"
                            : "—"}
                      </td>
                      <td>
                        {live && !closedAt
                          ? "Live now"
                          : formatCloseReason(reason, closedAt)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "logs" && (
        <div className="mt-6 max-h-[70vh] space-y-2 overflow-y-auto font-mono text-xs">
          <p className="mb-3 font-sans text-sm text-ink-steel">
            Chronological play + system messages (newest first).
          </p>
          {[...(snap?.gameLogs ?? [])].reverse().map((l) => (
            <div
              key={l.id}
              className={`rounded-sm border px-3 py-2 ${
                l.level === "error" || l.level === "exception"
                  ? "border-crimson/40 bg-crimson/5"
                  : "border-crimson/15"
              }`}
            >
              <span className="text-ink-steel">
                {new Date(l.at).toLocaleString()} [{l.level}]
                {l.roomId ? ` room ${l.roomId}` : ""}
              </span>{" "}
              {l.message}
            </div>
          ))}
        </div>
      )}

      {tab === "lookup" && (
        <div className="mt-6 space-y-4">
          <p className="text-sm text-ink-steel">
            Look up one room code against live Socket.io state + SQLite history.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem] flex-1">
              <label className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Room code
              </label>
              <input
                value={lookupCode}
                maxLength={6}
                onChange={(e) => setLookupCode(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === "Enter" && runLookup()}
                placeholder="e.g. 37DU5J"
                className="mt-1 w-full border-b border-crimson/30 bg-transparent py-2 font-mono tracking-[0.2em] outline-none"
              />
            </div>
            <button
              type="button"
              onClick={runLookup}
              disabled={lookupLoading || lookupCode.trim().length < 4}
              className="rounded-sm border border-crimson bg-crimson px-4 py-2.5 font-mono text-[10px] uppercase tracking-widest text-manila disabled:opacity-40"
            >
              {lookupLoading ? "Looking up…" : "Lookup"}
            </button>
          </div>

          {lookup && !lookup.found && (
            <p className="text-sm text-ink-steel">
              No history or live room for{" "}
              <span className="font-mono">{lookup.code || lookupCode}</span>.
            </p>
          )}

          {lookup?.live && (
            <div className="rounded-sm border border-crimson/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-crimson-glow">
                Live in Socket.io now
              </p>
              <p className="mt-2 text-sm">
                <span className="font-mono font-bold">{lookup.live.code}</span> ·{" "}
                {gameLabel(lookup.live.gameId)} ·{" "}
                {formatPhase(lookup.live.phase)}
                {lookup.live.paused ? " · paused" : ""}
              </p>
              <p className="mt-1 text-sm text-ink-steel">
                Host: {lookup.live.host ?? "—"} · Opened{" "}
                {new Date(lookup.live.createdAt).toLocaleString()}
                {lookup.live.lobbyIdleDeadlineAt
                  ? ` · lobby idle deadline ${new Date(lookup.live.lobbyIdleDeadlineAt).toLocaleString()}`
                  : ""}
              </p>
              <ul className="mt-3 space-y-1 text-sm">
                {lookup.live.players.map((p) => (
                  <li key={p.id}>
                    {p.name}
                    {p.isHost ? " (host)" : ""}
                    {p.isBot ? " (bot)" : ""}
                    {!p.alive ? " · eliminated" : ""}
                    {!p.connected ? " · disconnected" : " · connected"}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {lookup && lookup.found && !lookup.live && (
            <div className="rounded-sm border border-crimson/30 bg-crimson/5 p-4 text-sm text-crimson">
              Not live in Socket.io memory. Use history below for the close
              reason (often &quot;Lost from live server memory&quot; after a
              redeploy).
            </div>
          )}

          {lookup && lookup.roomEvents.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Open / close history
              </p>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                      <th className="py-2 pr-3">Opened at</th>
                      <th className="pr-3">Closed at</th>
                      <th className="pr-3">Host</th>
                      <th className="pr-3">Game</th>
                      <th>Why it closed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lookup.roomEvents.map((e) => (
                      <tr key={e.id} className="border-t border-crimson/10">
                        <td className="py-2 pr-3">
                          {new Date(e.openedAt).toLocaleString()}
                        </td>
                        <td className="pr-3">
                          {e.closedAt
                            ? new Date(e.closedAt).toLocaleString()
                            : "—"}
                        </td>
                        <td className="pr-3">{e.hostName}</td>
                        <td className="pr-3">{gameLabel(e.gameId)}</td>
                        <td>{formatCloseReason(e.reason, e.closedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {lookup && lookup.gameLogs.length > 0 && (
            <div>
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Logs for this room
              </p>
              <div className="mt-2 max-h-80 space-y-1 overflow-y-auto font-mono text-xs">
                {lookup.gameLogs.map((l) => (
                  <div key={l.id} className="border-b border-crimson/10 py-1">
                    <span className="text-ink-steel">
                      {new Date(l.at).toLocaleString()}
                    </span>{" "}
                    {l.message}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === "analytics" && (
        <div className="mt-6 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-sm text-ink-steel">
                Reach metrics from page beacons + room lifecycle events.
                Historical data starts when analytics was deployed.
              </p>
              {analytics?.meta.oldestEventAt ? (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                  Earliest event{" "}
                  {new Date(analytics.meta.oldestEventAt).toLocaleString()} ·
                  retention {analytics.meta.retentionDays}d
                </p>
              ) : (
                <p className="mt-1 font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                  No analytics events stored yet
                </p>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["day", "Day"],
                  ["week", "Week"],
                  ["month", "Month"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setAnalyticsRange(id)}
                  className={`rounded-sm border px-3 py-2 font-mono text-[10px] uppercase tracking-widest ${
                    analyticsRange === id
                      ? "border-crimson bg-crimson text-manila"
                      : "border-crimson/30"
                  }`}
                >
                  {label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => refreshAnalytics(analyticsRange)}
                className="rounded-sm border border-crimson/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest"
              >
                {analyticsLoading ? "Loading…" : "Refresh"}
              </button>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                ["Page visits", analytics?.totals.visits],
                ["Unique players", analytics?.totals.uniquePlayers],
                ["Rooms created", analytics?.totals.roomsCreated],
                ["Games started", analytics?.totals.gamesStarted],
                ["Room joins", analytics?.totals.roomJoins],
                ["Rooms closed", analytics?.totals.roomsClosed],
                [
                  "Avg room length",
                  analytics
                    ? formatDuration(analytics.totals.avgRoomDurationMs)
                    : undefined,
                ],
                ["Events stored", analytics?.totals.events],
              ] as const
            ).map(([label, value]) => (
              <div
                key={label}
                className="rounded-sm border border-crimson/20 p-3"
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                  {label}
                </p>
                <p className="mt-1 font-display text-2xl font-bold">
                  {value ?? (analyticsLoading ? "…" : "—")}
                </p>
              </div>
            ))}
          </div>

          <div className="rounded-sm border border-crimson/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Traffic over time
              </p>
              <div className="flex flex-wrap gap-1">
                {(
                  [
                    ["visits", "Visits"],
                    ["rooms", "Rooms"],
                    ["games", "Games"],
                    ["joins", "Joins"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAnalyticsMetric(id)}
                    className={`px-2 py-1 font-mono text-[10px] uppercase tracking-widest ${
                      analyticsMetric === id
                        ? "text-crimson"
                        : "text-ink-steel"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3">
              {analytics ? (
                <SeriesChart
                  series={analytics.series}
                  metric={analyticsMetric}
                />
              ) : (
                <p className="text-sm text-ink-steel">
                  {analyticsLoading ? "Loading chart…" : "No series yet."}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-crimson/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                By game
              </p>
              <div className="mt-3">
                <BarRows
                  max={Math.max(
                    1,
                    ...(analytics?.byGame.map((g) => g.games + g.rooms) ?? [0])
                  )}
                  rows={(analytics?.byGame ?? []).map((g) => ({
                    label: gameLabel(g.gameId),
                    value: g.games + g.rooms,
                    sub: `${g.games} starts · ${g.rooms} rooms · ${g.joins} joins`,
                  }))}
                />
              </div>
            </div>

            <div className="rounded-sm border border-crimson/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                By region
              </p>
              <div className="mt-3">
                <BarRows
                  max={Math.max(
                    1,
                    ...(analytics?.byRegion.map(
                      (r) => r.visits + r.players
                    ) ?? [0])
                  )}
                  rows={(analytics?.byRegion ?? []).map((r) => ({
                    label: `${countryLabel(r.country)} (${r.country})`,
                    value: r.visits + r.players,
                    sub: `${r.visits} visits · ${r.players} players · ${r.rooms} rooms`,
                  }))}
                />
              </div>
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-sm border border-crimson/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Top rooms
              </p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                      <th className="py-2 pr-3">Room</th>
                      <th className="pr-3">Game</th>
                      <th className="pr-3">Opens</th>
                      <th className="pr-3">Joins</th>
                      <th className="pr-3">Starts</th>
                      <th>Closes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(analytics?.byRoom ?? []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="py-4 text-ink-steel">
                          No room activity in this range.
                        </td>
                      </tr>
                    )}
                    {(analytics?.byRoom ?? []).map((r) => (
                      <tr key={r.roomId} className="border-t border-crimson/10">
                        <td className="py-2 pr-3 font-mono">{r.roomId}</td>
                        <td className="pr-3">{gameLabel(r.gameId)}</td>
                        <td className="pr-3">{r.opens}</td>
                        <td className="pr-3">{r.joins}</td>
                        <td className="pr-3">{r.games}</td>
                        <td>{r.closes}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="rounded-sm border border-crimson/20 p-4">
              <p className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                Pages / paths
              </p>
              <div className="mt-3">
                <BarRows
                  max={Math.max(
                    1,
                    ...(analytics?.byPath.map((p) => p.visits) ?? [0])
                  )}
                  rows={(analytics?.byPath ?? []).map((p) => ({
                    label: p.path,
                    value: p.visits,
                  }))}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
