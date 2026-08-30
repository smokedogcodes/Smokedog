/**
 * Persist admin audit data to Cloudflare AdminActor (SQLite DO),
 * with a local JSONL fallback for standalone Node game server.
 */

export type AdminRoomEvent = {
  id: string;
  code: string;
  hostName: string;
  gameId: string;
  openedAt: number;
  closedAt: number | null;
  reason: string | null;
};

export type AdminGameLog = {
  id: string;
  at: number;
  level: "info" | "error" | "exception";
  roomId?: string;
  message: string;
};

export type AdminAnalyticsEvent = {
  id: string;
  at: number;
  kind:
    | "page_view"
    | "room_open"
    | "room_join"
    | "room_close"
    | "game_start"
    | "player_seen";
  path?: string | null;
  gameId?: string | null;
  roomId?: string | null;
  playerId?: string | null;
  country?: string | null;
};

export type AdminAnalyticsPayload = {
  range: "day" | "week" | "month" | "custom";
  days: number;
  since: number;
  until: number;
  totals: {
    visits: number;
    roomsCreated: number;
    roomJoins: number;
    roomsClosed: number;
    gamesStarted: number;
    uniquePlayers: number;
    events: number;
    avgRoomDurationMs: number | null;
  };
  series: Array<{
    day: string;
    visits: number;
    rooms: number;
    joins: number;
    games: number;
    players: number;
  }>;
  byGame: Array<{
    gameId: string;
    rooms: number;
    games: number;
    joins: number;
  }>;
  byRegion: Array<{
    country: string;
    visits: number;
    players: number;
    rooms: number;
  }>;
  byRoom: Array<{
    roomId: string;
    gameId: string;
    opens: number;
    joins: number;
    games: number;
    closes: number;
  }>;
  byPath: Array<{ path: string; visits: number }>;
  meta: {
    oldestEventAt: number | null;
    retentionDays: number;
  };
};

type AdminActorStub = {
  fetch: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
};

function getAdminActorStub(): AdminActorStub | null {
  const g = globalThis as unknown as {
    __SMOKEDOG_ADMIN_ACTOR__?: AdminActorStub;
  };
  return g.__SMOKEDOG_ADMIN_ACTOR__ ?? null;
}

async function postJson(path: string, body: unknown): Promise<boolean> {
  const stub = getAdminActorStub();
  if (!stub) {
    appendLocalFallback(path, body);
    return true;
  }
  try {
    const res = await stub.fetch(`https://admin.internal${path}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      appendLocalFallback(path, body);
      return false;
    }
    return true;
  } catch {
    appendLocalFallback(path, body);
    return false;
  }
}

/** Local Node fallback — keeps historic rows in memory for the process lifetime + optional file. */
const localRoomEvents: AdminRoomEvent[] = [];
const localGameLogs: AdminGameLog[] = [];
const localAnalyticsEvents: AdminAnalyticsEvent[] = [];

function appendLocalFallback(path: string, body: unknown) {
  if (path === "/room-open") {
    const row = body as AdminRoomEvent;
    localRoomEvents.push({ ...row, closedAt: null, reason: null });
    return;
  }
  if (path === "/room-close") {
    const b = body as {
      code: string;
      closedAt: number;
      reason: string;
      fallback?: AdminRoomEvent;
    };
    const code = b.code.toUpperCase();
    const open = [...localRoomEvents]
      .reverse()
      .find((e) => e.code.toUpperCase() === code && e.closedAt == null);
    if (open) {
      open.closedAt = b.closedAt;
      open.reason = b.reason;
    } else if (b.fallback) {
      localRoomEvents.push({
        ...b.fallback,
        code,
        closedAt: b.closedAt,
        reason: b.reason,
      });
    } else {
      localRoomEvents.push({
        id: `close-${code}-${b.closedAt}`,
        code,
        hostName: "?",
        gameId: "unknown",
        openedAt: b.closedAt,
        closedAt: b.closedAt,
        reason: b.reason,
      });
    }
    return;
  }
  if (path === "/log") {
    localGameLogs.push(body as AdminGameLog);
    if (localGameLogs.length > 10000) localGameLogs.splice(0, localGameLogs.length - 10000);
    return;
  }
  if (path === "/analytics-event") {
    localAnalyticsEvents.push(body as AdminAnalyticsEvent);
    if (localAnalyticsEvents.length > 20000) {
      localAnalyticsEvents.splice(0, localAnalyticsEvents.length - 20000);
    }
  }
}

export function persistRoomOpen(row: AdminRoomEvent): void {
  void postJson("/room-open", row);
}

export async function persistRoomClose(
  code: string,
  closedAt: number,
  reason: string,
  fallback?: AdminRoomEvent
): Promise<boolean> {
  return postJson("/room-close", {
    code: code.toUpperCase(),
    closedAt,
    reason,
    fallback: fallback
      ? { ...fallback, code: fallback.code.toUpperCase() }
      : undefined,
  });
}

export function persistGameLog(row: AdminGameLog): void {
  void postJson("/log", row);
}

export async function persistGameLogAsync(row: AdminGameLog): Promise<boolean> {
  return postJson("/log", row);
}

export function persistAnalyticsEvent(row: AdminAnalyticsEvent): void {
  void postJson("/analytics-event", {
    ...row,
    at: row.at || Date.now(),
    country: row.country ? row.country.toUpperCase() : null,
  });
}

function emptyAnalytics(
  range: "day" | "week" | "month" | "custom",
  days: number,
  since: number,
  until: number
): AdminAnalyticsPayload {
  const series: AdminAnalyticsPayload["series"] = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(until - (days - 1 - i) * 24 * 60 * 60 * 1000);
    series.push({
      day: d.toISOString().slice(0, 10),
      visits: 0,
      rooms: 0,
      joins: 0,
      games: 0,
      players: 0,
    });
  }
  return {
    range,
    days,
    since,
    until,
    totals: {
      visits: 0,
      roomsCreated: 0,
      roomJoins: 0,
      roomsClosed: 0,
      gamesStarted: 0,
      uniquePlayers: 0,
      events: 0,
      avgRoomDurationMs: null,
    },
    series,
    byGame: [],
    byRegion: [],
    byRoom: [],
    byPath: [],
    meta: { oldestEventAt: null, retentionDays: 90 },
  };
}

function aggregateLocalAnalytics(
  range: "day" | "week" | "month",
  daysOverride = 0
): AdminAnalyticsPayload {
  const until = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  const days =
    daysOverride > 0 && daysOverride <= 90
      ? daysOverride
      : range === "day"
        ? 1
        : range === "month"
          ? 30
          : 7;
  const since = until - days * dayMs;
  const out = emptyAnalytics(
    daysOverride > 0 ? "custom" : range,
    days,
    since,
    until
  );
  const events = localAnalyticsEvents.filter(
    (e) => e.at >= since && e.at < until
  );
  out.totals.events = events.length;
  const players = new Set<string>();
  const seriesMap = new Map(out.series.map((s) => [s.day, s]));
  const gameMap = new Map<
    string,
    { gameId: string; rooms: number; games: number; joins: number }
  >();
  const regionMap = new Map<
    string,
    { country: string; visits: number; players: number; rooms: number }
  >();
  const roomMap = new Map<
    string,
    {
      roomId: string;
      gameId: string;
      opens: number;
      joins: number;
      games: number;
      closes: number;
    }
  >();
  const pathMap = new Map<string, number>();

  for (const e of events) {
    if (e.playerId) players.add(e.playerId);
    const day = new Date(e.at).toISOString().slice(0, 10);
    const bucket = seriesMap.get(day);
    if (e.kind === "page_view") {
      out.totals.visits += 1;
      if (bucket) bucket.visits += 1;
      const path = e.path || "/";
      pathMap.set(path, (pathMap.get(path) ?? 0) + 1);
    } else if (e.kind === "room_open") {
      out.totals.roomsCreated += 1;
      if (bucket) bucket.rooms += 1;
    } else if (e.kind === "room_join") {
      out.totals.roomJoins += 1;
      if (bucket) bucket.joins += 1;
    } else if (e.kind === "room_close") {
      out.totals.roomsClosed += 1;
    } else if (e.kind === "game_start") {
      out.totals.gamesStarted += 1;
      if (bucket) bucket.games += 1;
    } else if (e.kind === "player_seen") {
      if (bucket) bucket.players += 1;
    }

    if (e.gameId && ["room_open", "game_start", "room_join"].includes(e.kind)) {
      const g = gameMap.get(e.gameId) ?? {
        gameId: e.gameId,
        rooms: 0,
        games: 0,
        joins: 0,
      };
      if (e.kind === "room_open") g.rooms += 1;
      else if (e.kind === "game_start") g.games += 1;
      else if (e.kind === "room_join") g.joins += 1;
      gameMap.set(e.gameId, g);
    }

    const country = (e.country || "??").toUpperCase();
    if (["page_view", "player_seen", "room_open"].includes(e.kind)) {
      const r = regionMap.get(country) ?? {
        country,
        visits: 0,
        players: 0,
        rooms: 0,
      };
      if (e.kind === "page_view") r.visits += 1;
      else if (e.kind === "player_seen") r.players += 1;
      else if (e.kind === "room_open") r.rooms += 1;
      regionMap.set(country, r);
    }

    if (
      e.roomId &&
      ["room_open", "room_join", "game_start", "room_close"].includes(e.kind)
    ) {
      const rm = roomMap.get(e.roomId) ?? {
        roomId: e.roomId,
        gameId: e.gameId ?? "unknown",
        opens: 0,
        joins: 0,
        games: 0,
        closes: 0,
      };
      if (e.gameId) rm.gameId = e.gameId;
      if (e.kind === "room_open") rm.opens += 1;
      else if (e.kind === "room_join") rm.joins += 1;
      else if (e.kind === "game_start") rm.games += 1;
      else if (e.kind === "room_close") rm.closes += 1;
      roomMap.set(e.roomId, rm);
    }
  }

  out.totals.uniquePlayers = players.size;
  const closed = localRoomEvents.filter(
    (r) =>
      r.closedAt != null &&
      r.openedAt >= since &&
      r.openedAt < until &&
      r.closedAt != null
  );
  if (closed.length) {
    out.totals.avgRoomDurationMs =
      closed.reduce((sum, r) => sum + ((r.closedAt ?? 0) - r.openedAt), 0) /
      closed.length;
  }
  out.byGame = [...gameMap.values()].sort(
    (a, b) => b.games + b.rooms - (a.games + a.rooms)
  );
  out.byRegion = [...regionMap.values()]
    .sort((a, b) => b.visits + b.players - (a.visits + a.players))
    .slice(0, 40);
  out.byRoom = [...roomMap.values()]
    .sort((a, b) => b.opens + b.joins + b.games - (a.opens + a.joins + a.games))
    .slice(0, 40);
  out.byPath = [...pathMap.entries()]
    .map(([path, visits]) => ({ path, visits }))
    .sort((a, b) => b.visits - a.visits)
    .slice(0, 20);
  out.meta.oldestEventAt =
    localAnalyticsEvents.reduce<number | null>(
      (min, e) => (min == null || e.at < min ? e.at : min),
      null
    );
  return out;
}

export async function loadAdminAnalytics(opts?: {
  range?: "day" | "week" | "month";
  days?: number;
}): Promise<AdminAnalyticsPayload> {
  const range = opts?.range ?? "week";
  const days = opts?.days ?? 0;
  const stub = getAdminActorStub();
  if (!stub) {
    return aggregateLocalAnalytics(range, days);
  }
  try {
    const qs = new URLSearchParams({ range });
    if (days > 0) qs.set("days", String(days));
    const res = await stub.fetch(
      `https://admin.internal/analytics?${qs.toString()}`
    );
    if (!res.ok) throw new Error(`admin analytics ${res.status}`);
    return (await res.json()) as AdminAnalyticsPayload;
  } catch {
    return aggregateLocalAnalytics(range, days);
  }
}

export async function loadAdminHistory(opts?: {
  rooms?: number;
  logs?: number;
}): Promise<{
  roomEvents: AdminRoomEvent[];
  gameLogs: AdminGameLog[];
  totals: { roomEvents: number; gameLogs: number };
}> {
  const stub = getAdminActorStub();
  if (!stub) {
    return {
      roomEvents: localRoomEvents.slice(-(opts?.rooms ?? 500)),
      gameLogs: localGameLogs.slice(-(opts?.logs ?? 2000)),
      totals: {
        roomEvents: localRoomEvents.length,
        gameLogs: localGameLogs.length,
      },
    };
  }
  try {
    const rooms = opts?.rooms ?? 500;
    const logs = opts?.logs ?? 2000;
    const res = await stub.fetch(
      `https://admin.internal/snapshot?rooms=${rooms}&logs=${logs}`
    );
    if (!res.ok) throw new Error(`admin snapshot ${res.status}`);
    return (await res.json()) as {
      roomEvents: AdminRoomEvent[];
      gameLogs: AdminGameLog[];
      totals: { roomEvents: number; gameLogs: number };
    };
  } catch {
    return {
      roomEvents: localRoomEvents.slice(-(opts?.rooms ?? 500)),
      gameLogs: localGameLogs.slice(-(opts?.logs ?? 2000)),
      totals: {
        roomEvents: localRoomEvents.length,
        gameLogs: localGameLogs.length,
      },
    };
  }
}

export async function loadAdminRoomLookup(code: string): Promise<{
  code: string;
  found: boolean;
  roomEvents: AdminRoomEvent[];
  gameLogs: AdminGameLog[];
}> {
  const normalized = code.trim().toUpperCase();
  const stub = getAdminActorStub();
  if (!stub) {
    const roomEvents = localRoomEvents.filter(
      (e) => e.code.toUpperCase() === normalized
    );
    const gameLogs = localGameLogs.filter(
      (l) => (l.roomId ?? "").toUpperCase() === normalized
    );
    return {
      code: normalized,
      found: roomEvents.length > 0 || gameLogs.length > 0,
      roomEvents,
      gameLogs,
    };
  }
  try {
    const res = await stub.fetch(
      `https://admin.internal/room?code=${encodeURIComponent(normalized)}`
    );
    if (!res.ok) throw new Error(`admin room lookup ${res.status}`);
    return (await res.json()) as {
      code: string;
      found: boolean;
      roomEvents: AdminRoomEvent[];
      gameLogs: AdminGameLog[];
    };
  } catch {
    const roomEvents = localRoomEvents.filter(
      (e) => e.code.toUpperCase() === normalized
    );
    const gameLogs = localGameLogs.filter(
      (l) => (l.roomId ?? "").toUpperCase() === normalized
    );
    return {
      code: normalized,
      found: roomEvents.length > 0 || gameLogs.length > 0,
      roomEvents,
      gameLogs,
    };
  }
}
