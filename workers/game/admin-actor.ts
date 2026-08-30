import { DurableObject } from "cloudflare:workers";

export type AdminRoomEventRow = {
  id: string;
  code: string;
  hostName: string;
  gameId: string;
  openedAt: number;
  closedAt: number | null;
  reason: string | null;
};

export type AdminGameLogRow = {
  id: string;
  at: number;
  level: "info" | "error" | "exception";
  roomId?: string;
  message: string;
};

export type AdminAnalyticsEventRow = {
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

export type AdminAnalyticsRange = "day" | "week" | "month";

/**
 * SQLite-backed admin audit store (rooms + game logs + analytics).
 * Singleton DO: env.adminActor.idFromName("singleton")
 */
export class AdminActor extends DurableObject {
  constructor(ctx: DurableObjectState, env: unknown) {
    super(ctx, env);
    this.ctx.storage.sql.exec(`
      CREATE TABLE IF NOT EXISTS room_events (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL,
        host_name TEXT NOT NULL,
        game_id TEXT NOT NULL,
        opened_at INTEGER NOT NULL,
        closed_at INTEGER,
        reason TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_room_events_opened ON room_events(opened_at DESC);
      CREATE INDEX IF NOT EXISTS idx_room_events_code ON room_events(code);

      CREATE TABLE IF NOT EXISTS game_logs (
        id TEXT PRIMARY KEY,
        at INTEGER NOT NULL,
        level TEXT NOT NULL,
        room_id TEXT,
        message TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_game_logs_at ON game_logs(at DESC);
      CREATE INDEX IF NOT EXISTS idx_game_logs_room ON game_logs(room_id);

      CREATE TABLE IF NOT EXISTS analytics_events (
        id TEXT PRIMARY KEY,
        at INTEGER NOT NULL,
        day TEXT NOT NULL,
        kind TEXT NOT NULL,
        path TEXT,
        game_id TEXT,
        room_id TEXT,
        player_id TEXT,
        country TEXT
      );
      CREATE INDEX IF NOT EXISTS idx_analytics_at ON analytics_events(at DESC);
      CREATE INDEX IF NOT EXISTS idx_analytics_day ON analytics_events(day);
      CREATE INDEX IF NOT EXISTS idx_analytics_kind ON analytics_events(kind);
      CREATE INDEX IF NOT EXISTS idx_analytics_game ON analytics_events(game_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_room ON analytics_events(room_id);
      CREATE INDEX IF NOT EXISTS idx_analytics_country ON analytics_events(country);
    `);
  }

  private sql() {
    return this.ctx.storage.sql;
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    try {
      if (request.method === "GET" && url.pathname === "/snapshot") {
        const roomLimit = Math.min(
          2000,
          Math.max(1, Number(url.searchParams.get("rooms") ?? 500))
        );
        const logLimit = Math.min(
          5000,
          Math.max(1, Number(url.searchParams.get("logs") ?? 2000))
        );
        return Response.json(this.snapshot(roomLimit, logLimit));
      }

      if (request.method === "GET" && url.pathname === "/room") {
        const code = (url.searchParams.get("code") ?? "").trim().toUpperCase();
        if (!code) {
          return Response.json({ ok: false, message: "code required" }, { status: 400 });
        }
        return Response.json(this.lookupRoom(code));
      }

      if (request.method === "POST" && url.pathname === "/room-open") {
        const body = (await request.json()) as AdminRoomEventRow;
        this.insertRoomOpen(body);
        return Response.json({ ok: true });
      }

      if (request.method === "POST" && url.pathname === "/room-close") {
        const body = (await request.json()) as {
          code: string;
          closedAt: number;
          reason: string;
          fallback?: AdminRoomEventRow;
        };
        this.closeRoom(body);
        return Response.json({ ok: true });
      }

      if (request.method === "POST" && url.pathname === "/log") {
        const body = (await request.json()) as AdminGameLogRow;
        this.insertLog(body);
        return Response.json({ ok: true });
      }

      if (request.method === "POST" && url.pathname === "/logs-batch") {
        const body = (await request.json()) as { logs: AdminGameLogRow[] };
        for (const row of body.logs ?? []) this.insertLog(row);
        return Response.json({ ok: true });
      }

      if (request.method === "POST" && url.pathname === "/analytics-event") {
        const body = (await request.json()) as AdminAnalyticsEventRow;
        this.insertAnalyticsEvent(body);
        return Response.json({ ok: true });
      }

      if (request.method === "GET" && url.pathname === "/analytics") {
        const range = (url.searchParams.get("range") ?? "week") as AdminAnalyticsRange;
        const daysParam = Number(url.searchParams.get("days") ?? 0);
        return Response.json(this.queryAnalytics(range, daysParam));
      }

      return new Response("Not found", { status: 404 });
    } catch (err) {
      const message = err instanceof Error ? err.message : "admin store error";
      return Response.json({ ok: false, message }, { status: 500 });
    }
  }

  private insertRoomOpen(row: AdminRoomEventRow) {
    this.sql().exec(
      `INSERT OR REPLACE INTO room_events
        (id, code, host_name, game_id, opened_at, closed_at, reason)
       VALUES (?, ?, ?, ?, ?, NULL, NULL)`,
      row.id,
      row.code,
      row.hostName,
      row.gameId,
      row.openedAt
    );
  }

  private closeRoom(body: {
    code: string;
    closedAt: number;
    reason: string;
    fallback?: AdminRoomEventRow;
  }) {
    const code = body.code.toUpperCase();
    this.sql().exec(
      `UPDATE room_events
       SET closed_at = ?, reason = ?
       WHERE UPPER(code) = ? AND closed_at IS NULL`,
      body.closedAt,
      body.reason,
      code
    );

    const openLeft = [
      ...this.sql().exec<{ c: number }>(
        `SELECT COUNT(*) as c FROM room_events WHERE UPPER(code) = ? AND closed_at IS NULL`,
        code
      ),
    ][0]?.c;

    if ((openLeft ?? 0) > 0) {
      // Still open somehow — force-close every open row for this code
      this.sql().exec(
        `UPDATE room_events
         SET closed_at = ?, reason = ?
         WHERE UPPER(code) = ? AND closed_at IS NULL`,
        body.closedAt,
        body.reason,
        code
      );
    }

    const any = [
      ...this.sql().exec<{ c: number }>(
        `SELECT COUNT(*) as c FROM room_events WHERE UPPER(code) = ?`,
        code
      ),
    ][0]?.c;

    if (!any) {
      const fb = body.fallback;
      this.sql().exec(
        `INSERT INTO room_events
          (id, code, host_name, game_id, opened_at, closed_at, reason)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        fb?.id ?? `close-${code}-${body.closedAt}`,
        code,
        fb?.hostName ?? "?",
        fb?.gameId ?? "unknown",
        fb?.openedAt ?? body.closedAt,
        body.closedAt,
        body.reason
      );
    }

    // Always append a close marker log row so history is visible even if UPDATE missed
    this.insertLog({
      id: `room-close-${code}-${body.closedAt}`,
      at: body.closedAt,
      level: "info",
      roomId: code,
      message: `Room ${code} closed (${body.reason})`,
    });
  }

  private insertLog(row: AdminGameLogRow) {
    this.sql().exec(
      `INSERT OR IGNORE INTO game_logs (id, at, level, room_id, message)
       VALUES (?, ?, ?, ?, ?)`,
      row.id,
      row.at,
      row.level,
      row.roomId ?? null,
      row.message
    );
  }

  private dayKey(at: number): string {
    return new Date(at).toISOString().slice(0, 10);
  }

  private insertAnalyticsEvent(row: AdminAnalyticsEventRow) {
    const at = row.at || Date.now();
    this.sql().exec(
      `INSERT OR IGNORE INTO analytics_events
        (id, at, day, kind, path, game_id, room_id, player_id, country)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      row.id,
      at,
      this.dayKey(at),
      row.kind,
      row.path ?? null,
      row.gameId ?? null,
      row.roomId ?? null,
      row.playerId ?? null,
      row.country ? row.country.toUpperCase() : null
    );

    // Keep ~90 days of analytics to bound SQLite growth.
    const cutoff = Date.now() - 90 * 24 * 60 * 60 * 1000;
    this.sql().exec(`DELETE FROM analytics_events WHERE at < ?`, cutoff);
  }

  private rangeBounds(
    range: AdminAnalyticsRange,
    daysOverride: number
  ): { since: number; until: number; days: number; range: AdminAnalyticsRange | "custom" } {
    const until = Date.now();
    const dayMs = 24 * 60 * 60 * 1000;
    if (daysOverride > 0 && daysOverride <= 90) {
      return {
        since: until - daysOverride * dayMs,
        until,
        days: daysOverride,
        range: "custom",
      };
    }
    const days = range === "day" ? 1 : range === "month" ? 30 : 7;
    return {
      since: until - days * dayMs,
      until,
      days,
      range,
    };
  }

  private queryAnalytics(range: AdminAnalyticsRange, daysOverride = 0) {
    const bounds = this.rangeBounds(range, daysOverride);
    const { since, until } = bounds;

    const countKind = (kind: string) =>
      [
        ...this.sql().exec<{ c: number }>(
          `SELECT COUNT(*) as c FROM analytics_events WHERE at >= ? AND at < ? AND kind = ?`,
          since,
          until,
          kind
        ),
      ][0]?.c ?? 0;

    const uniquePlayers =
      [
        ...this.sql().exec<{ c: number }>(
          `SELECT COUNT(DISTINCT player_id) as c
           FROM analytics_events
           WHERE at >= ? AND at < ? AND player_id IS NOT NULL AND player_id != ''`,
          since,
          until
        ),
      ][0]?.c ?? 0;

    const avgDurationMs = (() => {
      const rows = [
        ...this.sql().exec<{ avg_ms: number | null }>(
          `SELECT AVG(CAST(re.closed_at - re.opened_at AS REAL)) as avg_ms
           FROM room_events re
           WHERE re.closed_at IS NOT NULL
             AND re.opened_at >= ?
             AND re.opened_at < ?`,
          since,
          until
        ),
      ];
      return rows[0]?.avg_ms ?? null;
    })();

    const seriesMap = new Map<
      string,
      {
        day: string;
        visits: number;
        rooms: number;
        joins: number;
        games: number;
        players: number;
      }
    >();
    for (let i = 0; i < bounds.days; i++) {
      const d = new Date(until - (bounds.days - 1 - i) * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      seriesMap.set(key, {
        day: key,
        visits: 0,
        rooms: 0,
        joins: 0,
        games: 0,
        players: 0,
      });
    }

    for (const row of this.sql().exec<{ day: string; kind: string; c: number }>(
      `SELECT day, kind, COUNT(*) as c
       FROM analytics_events
       WHERE at >= ? AND at < ?
       GROUP BY day, kind`,
      since,
      until
    )) {
      const bucket = seriesMap.get(row.day);
      if (!bucket) continue;
      if (row.kind === "page_view") bucket.visits += row.c;
      else if (row.kind === "room_open") bucket.rooms += row.c;
      else if (row.kind === "room_join") bucket.joins += row.c;
      else if (row.kind === "game_start") bucket.games += row.c;
      else if (row.kind === "player_seen") bucket.players += row.c;
    }

    const byGame: Array<{ gameId: string; rooms: number; games: number; joins: number }> =
      [];
    const gameMap = new Map<
      string,
      { gameId: string; rooms: number; games: number; joins: number }
    >();
    for (const row of this.sql().exec<{
      game_id: string;
      kind: string;
      c: number;
    }>(
      `SELECT COALESCE(game_id, 'unknown') as game_id, kind, COUNT(*) as c
       FROM analytics_events
       WHERE at >= ? AND at < ?
         AND kind IN ('room_open', 'game_start', 'room_join')
         AND game_id IS NOT NULL AND game_id != ''
       GROUP BY game_id, kind`,
      since,
      until
    )) {
      const cur = gameMap.get(row.game_id) ?? {
        gameId: row.game_id,
        rooms: 0,
        games: 0,
        joins: 0,
      };
      if (row.kind === "room_open") cur.rooms += row.c;
      else if (row.kind === "game_start") cur.games += row.c;
      else if (row.kind === "room_join") cur.joins += row.c;
      gameMap.set(row.game_id, cur);
    }
    byGame.push(...gameMap.values());
    byGame.sort((a, b) => b.games + b.rooms - (a.games + a.rooms));

    const byRegion: Array<{ country: string; visits: number; players: number; rooms: number }> =
      [];
    const regionMap = new Map<
      string,
      { country: string; visits: number; players: number; rooms: number }
    >();
    for (const row of this.sql().exec<{
      country: string;
      kind: string;
      c: number;
    }>(
      `SELECT COALESCE(NULLIF(country, ''), '??') as country, kind, COUNT(*) as c
       FROM analytics_events
       WHERE at >= ? AND at < ?
         AND kind IN ('page_view', 'player_seen', 'room_open')
       GROUP BY country, kind`,
      since,
      until
    )) {
      const cur = regionMap.get(row.country) ?? {
        country: row.country,
        visits: 0,
        players: 0,
        rooms: 0,
      };
      if (row.kind === "page_view") cur.visits += row.c;
      else if (row.kind === "player_seen") cur.players += row.c;
      else if (row.kind === "room_open") cur.rooms += row.c;
      regionMap.set(row.country, cur);
    }
    byRegion.push(...regionMap.values());
    byRegion.sort((a, b) => b.visits + b.players - (a.visits + a.players));

    const byRoom: Array<{
      roomId: string;
      gameId: string;
      opens: number;
      joins: number;
      games: number;
      closes: number;
    }> = [];
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
    for (const row of this.sql().exec<{
      room_id: string;
      game_id: string | null;
      kind: string;
      c: number;
    }>(
      `SELECT room_id, MAX(game_id) as game_id, kind, COUNT(*) as c
       FROM analytics_events
       WHERE at >= ? AND at < ?
         AND room_id IS NOT NULL AND room_id != ''
         AND kind IN ('room_open', 'room_join', 'game_start', 'room_close')
       GROUP BY room_id, kind`,
      since,
      until
    )) {
      const cur = roomMap.get(row.room_id) ?? {
        roomId: row.room_id,
        gameId: row.game_id ?? "unknown",
        opens: 0,
        joins: 0,
        games: 0,
        closes: 0,
      };
      if (row.game_id) cur.gameId = row.game_id;
      if (row.kind === "room_open") cur.opens += row.c;
      else if (row.kind === "room_join") cur.joins += row.c;
      else if (row.kind === "game_start") cur.games += row.c;
      else if (row.kind === "room_close") cur.closes += row.c;
      roomMap.set(row.room_id, cur);
    }
    byRoom.push(...roomMap.values());
    byRoom.sort(
      (a, b) =>
        b.opens + b.joins + b.games - (a.opens + a.joins + a.games)
    );

    const byPath: Array<{ path: string; visits: number }> = [];
    for (const row of this.sql().exec<{ path: string; c: number }>(
      `SELECT COALESCE(NULLIF(path, ''), '/') as path, COUNT(*) as c
       FROM analytics_events
       WHERE at >= ? AND at < ? AND kind = 'page_view'
       GROUP BY path
       ORDER BY c DESC
       LIMIT 20`,
      since,
      until
    )) {
      byPath.push({ path: row.path, visits: row.c });
    }

    const eventCount =
      [
        ...this.sql().exec<{ c: number }>(
          `SELECT COUNT(*) as c FROM analytics_events WHERE at >= ? AND at < ?`,
          since,
          until
        ),
      ][0]?.c ?? 0;

    const oldest =
      [
        ...this.sql().exec<{ m: number | null }>(
          `SELECT MIN(at) as m FROM analytics_events`
        ),
      ][0]?.m ?? null;

    return {
      range: bounds.range,
      days: bounds.days,
      since,
      until,
      totals: {
        visits: countKind("page_view"),
        roomsCreated: countKind("room_open"),
        roomJoins: countKind("room_join"),
        roomsClosed: countKind("room_close"),
        gamesStarted: countKind("game_start"),
        uniquePlayers,
        events: eventCount,
        avgRoomDurationMs: avgDurationMs,
      },
      series: [...seriesMap.values()],
      byGame,
      byRegion: byRegion.slice(0, 40),
      byRoom: byRoom.slice(0, 40),
      byPath,
      meta: {
        oldestEventAt: oldest,
        retentionDays: 90,
      },
    };
  }

  private snapshot(roomLimit: number, logLimit: number) {
    const roomEvents: AdminRoomEventRow[] = [];
    for (const row of this.sql().exec<{
      id: string;
      code: string;
      host_name: string;
      game_id: string;
      opened_at: number;
      closed_at: number | null;
      reason: string | null;
    }>(
      `SELECT id, code, host_name, game_id, opened_at, closed_at, reason
       FROM room_events
       ORDER BY opened_at DESC
       LIMIT ?`,
      roomLimit
    )) {
      roomEvents.push({
        id: row.id,
        code: row.code,
        hostName: row.host_name,
        gameId: row.game_id,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        reason: row.reason,
      });
    }

    const gameLogs: AdminGameLogRow[] = [];
    for (const row of this.sql().exec<{
      id: string;
      at: number;
      level: string;
      room_id: string | null;
      message: string;
    }>(
      `SELECT id, at, level, room_id, message
       FROM game_logs
       ORDER BY at DESC
       LIMIT ?`,
      logLimit
    )) {
      gameLogs.push({
        id: row.id,
        at: row.at,
        level: row.level as AdminGameLogRow["level"],
        roomId: row.room_id ?? undefined,
        message: row.message,
      });
    }

    // Return chronological (oldest→newest) to match prior in-memory order
    roomEvents.reverse();
    gameLogs.reverse();

    const logCount = [
      ...this.sql().exec<{ c: number }>(`SELECT COUNT(*) as c FROM game_logs`),
    ][0]?.c;
    const roomCount = [
      ...this.sql().exec<{ c: number }>(`SELECT COUNT(*) as c FROM room_events`),
    ][0]?.c;

    return {
      roomEvents,
      gameLogs,
      totals: {
        roomEvents: roomCount ?? roomEvents.length,
        gameLogs: logCount ?? gameLogs.length,
      },
    };
  }

  private lookupRoom(code: string) {
    const roomEvents: AdminRoomEventRow[] = [];
    for (const row of this.sql().exec<{
      id: string;
      code: string;
      host_name: string;
      game_id: string;
      opened_at: number;
      closed_at: number | null;
      reason: string | null;
    }>(
      `SELECT id, code, host_name, game_id, opened_at, closed_at, reason
       FROM room_events
       WHERE UPPER(code) = ?
       ORDER BY opened_at ASC`,
      code
    )) {
      roomEvents.push({
        id: row.id,
        code: row.code,
        hostName: row.host_name,
        gameId: row.game_id,
        openedAt: row.opened_at,
        closedAt: row.closed_at,
        reason: row.reason,
      });
    }

    const gameLogs: AdminGameLogRow[] = [];
    for (const row of this.sql().exec<{
      id: string;
      at: number;
      level: string;
      room_id: string | null;
      message: string;
    }>(
      `SELECT id, at, level, room_id, message
       FROM game_logs
       WHERE UPPER(COALESCE(room_id, '')) = ?
       ORDER BY at ASC
       LIMIT 2000`,
      code
    )) {
      gameLogs.push({
        id: row.id,
        at: row.at,
        level: row.level as AdminGameLogRow["level"],
        roomId: row.room_id ?? undefined,
        message: row.message,
      });
    }

    return {
      code,
      found: roomEvents.length > 0 || gameLogs.length > 0,
      roomEvents,
      gameLogs,
    };
  }
}
