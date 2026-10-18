import type { Server as HttpServer } from "http";
import type { Socket } from "socket.io";
import { Server } from "socket.io";
import type {
  ClientToServerEvents,
  ServerToClientEvents,
} from "@/lib/types";
import { RoomError } from "@/lib/room-code";
import { GameRuntime, type IoServer } from "./game-runtime";
import {
  createAdminSessionToken,
  verifyAdminCredentials,
  verifyAdminSessionToken,
} from "@/lib/admin-auth";
import { persistGameLog } from "@/server/admin-persist";
import { randomUUID } from "crypto";

function logSocketException(context: string, err: unknown) {
  if (err instanceof RoomError) return;
  persistGameLog({
    id: randomUUID(),
    at: Date.now(),
    level: "exception",
    message: `${context}: ${err instanceof Error ? err.message : String(err)}`,
  });
}

let activeRuntime: GameRuntime | null = null;

/** socket.io-serverless on Cloudflare may leave `socket.data` null. */
function ensureSocketData(socket: Socket): {
  playerId?: string;
  adminAuthed?: boolean;
  country?: string;
} {
  if (socket.data == null) {
    (socket as Socket & {
      data: { playerId?: string; adminAuthed?: boolean; country?: string };
    }).data = {};
  }
  return socket.data;
}

function rememberPlayerId(socket: Socket, playerId: string) {
  ensureSocketData(socket).playerId = playerId;
}

function rememberCountry(socket: Socket, country?: string | null) {
  if (!country) return;
  ensureSocketData(socket).country = country.toUpperCase();
}

function countryOf(socket: Socket): string | undefined {
  return socket.data?.country;
}

function playerIdOf(socket: Socket): string | undefined {
  return socket.data?.playerId;
}

function resolvePlayerId(
  socket: Socket,
  payload?: { playerId?: string }
): string | undefined {
  return playerIdOf(socket) ?? payload?.playerId;
}

function bindHostPlayerId(
  socket: Socket,
  payload?: { playerId?: string }
): string | undefined {
  const playerId = resolvePlayerId(socket, payload);
  if (playerId) rememberPlayerId(socket, playerId);
  return playerId;
}

export function restoreSocketRoomMemberships() {
  activeRuntime?.restoreSocketRoomMemberships();
}

export function getActiveRuntime(): GameRuntime | null {
  return activeRuntime;
}

export function wireGameSockets(io: IoServer): GameRuntime {
  const runtime = new GameRuntime(io);
  activeRuntime = runtime;
  bindPlayerId(io);

  io.on("connection", (socket) => {
    const remember = (playerId: string) => rememberPlayerId(socket, playerId);
    // Region: CF-injected query and/or CF-IPCountry header on the upgrade.
    const q = socket.handshake.query;
    const headers = socket.handshake.headers;
    const fromQuery =
      (typeof q.sd_country === "string" && q.sd_country) ||
      (typeof q.country === "string" && q.country) ||
      undefined;
    const fromHeader =
      (typeof headers["cf-ipcountry"] === "string" &&
        headers["cf-ipcountry"]) ||
      (typeof headers["CF-IPCountry"] === "string" &&
        headers["CF-IPCountry"]) ||
      undefined;
    const country =
      fromQuery && fromQuery !== "XX" && fromQuery !== "T1"
        ? fromQuery
        : fromHeader && fromHeader !== "XX" && fromHeader !== "T1"
          ? fromHeader
          : undefined;
    rememberCountry(socket, country);
    socket.join("lobby-browser");

    socket.on("lobbies:list", (payload) => {
      socket.emit("lobbies:list", {
        lobbies: runtime.listOpenLobbies(payload?.query),
      });
    });

    socket.on("games:listLive", (payload) => {
      socket.emit("games:live", {
        games: runtime.listLiveGames(payload?.query),
      });
    });

    socket.on("analytics:pageView", (payload) => {
      const playerId =
        resolvePlayerId(socket, payload) ??
        (typeof payload?.playerId === "string" ? payload.playerId : undefined);
      if (playerId) remember(playerId);
      const path =
        typeof payload?.path === "string" && payload.path.trim()
          ? payload.path.trim().slice(0, 120)
          : "/";
      runtime.trackAnalytics({
        kind: "page_view",
        path,
        playerId: playerId ?? null,
        country: countryOf(socket) ?? null,
        roomId:
          typeof payload?.roomId === "string"
            ? payload.roomId.toUpperCase().slice(0, 8)
            : null,
        gameId:
          typeof payload?.gameId === "string"
            ? payload.gameId.slice(0, 40)
            : null,
      });
    });

    socket.on("room:create", (payload) => {
      try {
        remember(payload.playerId);
        const room = runtime.createRoom({
          socketId: socket.id,
          playerId: payload.playerId,
          name: payload.name,
          avatarId: payload.avatarId,
          gameId: payload.gameId,
          localMode: payload.localMode,
          country: countryOf(socket),
        });
        socket.join(room.id);
        runtime.emitRoom(room);
      } catch (err) {
        socket.emit("room:error", {
          message: err instanceof Error ? err.message : "Could not create room",
        });
      }
    });

    socket.on("room:join", (payload) => {
      try {
        remember(payload.playerId);
        const room = runtime.joinRoom({
          roomId: payload.roomId,
          socketId: socket.id,
          playerId: payload.playerId,
          name: payload.name,
          avatarId: payload.avatarId,
          country: countryOf(socket),
        });
        socket.join(room.id);
        runtime.emitRoom(room);
      } catch (err) {
        socket.emit("room:error", {
          code: err instanceof RoomError ? err.code : "UNKNOWN",
          message: err instanceof Error ? err.message : "Could not join room",
        });
      }
    });

    socket.on("room:rejoin", (payload) => {
      try {
        remember(payload.playerId);
        const room = runtime.rejoin({
          roomId: payload.roomId,
          socketId: socket.id,
          playerId: payload.playerId,
        });
        runtime.emitRoom(room);
      } catch (err) {
        socket.emit("room:error", {
          code: err instanceof RoomError ? err.code : "UNKNOWN",
          message: err instanceof Error ? err.message : "Could not rejoin",
        });
      }
    });

    socket.on("room:leave", (payload) => {
      const playerId = playerIdOf(socket);
      if (playerId) {
        runtime.leaveRoom(payload.roomId, playerId);
      }
      socket.leave(payload.roomId);
      socket.emit("room:left");
    });

    socket.on("lobby:ready", (payload) => {
      const playerId = playerIdOf(socket);
      if (!playerId) return;
      runtime.setReady(payload.roomId, playerId, payload.ready);
    });

    socket.on("lobby:settings", (payload) => {
      const playerId = playerIdOf(socket);
      if (!playerId) return;
      runtime.updateSettings(
        payload.roomId,
        playerId,
        payload.settings
      );
    });

    socket.on("host:settings", (payload) => {
      const playerId = playerIdOf(socket);
      if (!playerId) return;
      runtime.updateSettings(
        payload.roomId,
        playerId,
        payload.settings
      );
    });

    socket.on("lobby:start", (payload) => {
      try {
        const playerId = playerIdOf(socket);
        if (!playerId) return;
        runtime.startGame(payload.roomId, playerId, countryOf(socket));
      } catch (err) {
        socket.emit("room:error", {
          code: err instanceof RoomError ? err.code : "UNKNOWN",
          message: err instanceof Error ? err.message : "Could not start",
        });
      }
    });

    socket.on("lobby:addBot", (payload) => {
      try {
        if (!playerIdOf(socket)) return;
        runtime.addBots(payload.roomId, playerIdOf(socket)!, payload.fillTo);
      } catch (err) {
        socket.emit("room:error", {
          code: err instanceof RoomError ? err.code : "UNKNOWN",
          message: err instanceof Error ? err.message : "Could not add auto players",
        });
      }
    });

    socket.on("lobby:removeBot", (payload) => {
      try {
        if (!playerIdOf(socket)) return;
        runtime.removeBot(payload.roomId, playerIdOf(socket)!);
      } catch (err) {
        socket.emit("room:error", {
          code: err instanceof RoomError ? err.code : "UNKNOWN",
          message: err instanceof Error ? err.message : "Could not remove auto player",
        });
      }
    });

    socket.on("night:action", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitNightAction(
        payload.roomId,
        playerIdOf(socket)!,
        payload.type,
        payload.targetId
      );
    });

    socket.on("day:vote", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitVote(payload.roomId, playerIdOf(socket)!, payload.targetId);
    });

    socket.on("day:voteSkip", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitVoteSkip(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("day:juggle", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitJuggle(
        payload.roomId,
        playerIdOf(socket)!,
        payload.targetIds
      );
    });

    socket.on("fivealive:playCard", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitFiveAlivePlayCard(
        payload.roomId,
        playerIdOf(socket)!,
        payload.cardId,
        payload.wildValue,
        payload.pass
      );
    });

    socket.on("ek:playCards", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkPlayCards(
        payload.roomId,
        playerIdOf(socket)!,
        payload.cardIds
      );
    });

    socket.on("ek:endTurn", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkEndTurn(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("ek:draw", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkDraw(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("ek:nope", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkNope(payload.roomId, playerIdOf(socket)!, payload.cardId);
    });

    socket.on("ek:placeDefuse", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkPlaceDefuse(
        payload.roomId,
        playerIdOf(socket)!,
        payload.deckIndex
      );
    });

    socket.on("ek:pickDiscard", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkPickDiscard(
        payload.roomId,
        playerIdOf(socket)!,
        payload.discardIndex
      );
    });

    socket.on("ek:stealTarget", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkStealTarget(
        payload.roomId,
        playerIdOf(socket)!,
        payload.targetId
      );
    });

    socket.on("ek:favorTarget", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkFavorTarget(
        payload.roomId,
        playerIdOf(socket)!,
        payload.targetId
      );
    });

    socket.on("ek:favorGive", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkFavorGive(
        payload.roomId,
        playerIdOf(socket)!,
        payload.cardId
      );
    });

    socket.on("ek:tripleDeclare", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitEkTripleDeclare(
        payload.roomId,
        playerIdOf(socket)!,
        payload.targetId,
        payload.cardType
      );
    });

    socket.on("spotit:submitMatch", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitSpotItMatch(
        payload.roomId,
        playerIdOf(socket)!,
        payload.symbolId
      );
    });

    socket.on("ttt:move", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitTttMove(
        payload.roomId,
        playerIdOf(socket)!,
        payload.cellIndex
      );
    });

    socket.on("connect4:drop", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitConnect4Drop(
        payload.roomId,
        playerIdOf(socket)!,
        payload.column
      );
    });

    socket.on("battleship:ready", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitBattleshipReady(
        payload.roomId,
        playerIdOf(socket)!,
        payload.fleet as import("@/lib/games/battleship/placement").FleetPlacement
      );
    });

    socket.on("battleship:fire", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitBattleshipFire(
        payload.roomId,
        playerIdOf(socket)!,
        payload.col,
        payload.row
      );
    });

    socket.on("battleship:powerup", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitBattleshipPowerUp(
        payload.roomId,
        playerIdOf(socket)!,
        payload.type,
        {
          col: payload.col,
          row: payload.row,
          orientation: payload.orientation,
          direction: payload.direction,
        }
      );
    });

    socket.on("battleship:rematch", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitBattleshipRematch(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("codenames:setRole", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitCodenamesRole(
        payload.roomId,
        playerIdOf(socket)!,
        payload.team,
        payload.role
      );
    });

    socket.on("codenames:giveClue", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitCodenamesClue(
        payload.roomId,
        playerIdOf(socket)!,
        payload.word,
        payload.number
      );
    });

    socket.on("codenames:guess", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitCodenamesGuess(
        payload.roomId,
        playerIdOf(socket)!,
        payload.cardIndex
      );
    });

    socket.on("codenames:endTurn", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitCodenamesEndTurn(
        payload.roomId,
        playerIdOf(socket)!
      );
    });

    socket.on("codenames:randomizeTeams", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.submitCodenamesRandomizeTeams(
        payload.roomId,
        playerIdOf(socket)!
      );
    });

    socket.on("chat:send", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.sendChat(
        payload.roomId,
        playerIdOf(socket)!,
        payload.channel,
        payload.text
      );
    });

    socket.on("host:kick", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.kick(payload.roomId, playerIdOf(socket)!, payload.playerId);
    });

    socket.on("host:pause", (payload) => {
      const playerId = bindHostPlayerId(socket, payload);
      if (!playerId) return;
      runtime.pause(payload.roomId, playerId);
    });

    socket.on("host:resume", (payload) => {
      const playerId = bindHostPlayerId(socket, payload);
      if (!playerId) return;
      runtime.resume(payload.roomId, playerId);
    });

    socket.on("host:skipDay", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.skipDay(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("host:skipTimer", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.skipPhaseTimer(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("voice:join", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.joinVoice(payload.roomId, playerIdOf(socket)!, payload.channel);
    });

    socket.on("voice:invite", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.inviteVoice(
        payload.roomId,
        playerIdOf(socket)!,
        payload.channel,
        payload.targetId
      );
    });

    socket.on("voice:leave", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.leaveVoice(payload.roomId, playerIdOf(socket)!, payload.channel);
    });

    socket.on("voice:signal", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.relayVoiceSignal(
        payload.roomId,
        playerIdOf(socket)!,
        payload.channel,
        payload.targetId,
        payload.signal
      );
    });

    socket.on("voice:speaking", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.relayVoiceSpeaking(
        payload.roomId,
        playerIdOf(socket)!,
        payload.channel,
        payload.speaking
      );
    });

    socket.on("voice:muted", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.setVoiceMuted(
        payload.roomId,
        playerIdOf(socket)!,
        payload.channel,
        payload.muted
      );
    });

    socket.on("host:voiceMute", (payload) => {
      const playerId = playerIdOf(socket);
      if (!playerId) return;
      runtime.hostVoiceMute(
        payload.roomId,
        playerId,
        payload.targetId,
        payload.muted
      );
    });

    socket.on("lobby:return", (payload) => {
      if (!playerIdOf(socket)) return;
      runtime.returnToLobby(payload.roomId, playerIdOf(socket)!);
    });

    socket.on("admin:login", (payload) => {
      if (
        !payload?.user ||
        !payload?.password ||
        !verifyAdminCredentials(payload.user, payload.password)
      ) {
        socket.emit("admin:auth", {
          ok: false,
          message: "Invalid credentials",
        });
        return;
      }
      ensureSocketData(socket).adminAuthed = true;
      socket.emit("admin:auth", {
        ok: true,
        token: createAdminSessionToken(),
      });
    });

    socket.on("admin:resume", (payload) => {
      if (!verifyAdminSessionToken(payload?.token)) {
        socket.emit("admin:auth", {
          ok: false,
          message: "Session expired — sign in again",
        });
        return;
      }
      ensureSocketData(socket).adminAuthed = true;
      socket.emit("admin:auth", {
        ok: true,
        token: payload.token,
      });
    });

    socket.on("admin:snapshot", (payload) => {
      void (async () => {
        const data = ensureSocketData(socket);
        if (!data.adminAuthed && verifyAdminSessionToken(payload?.token)) {
          data.adminAuthed = true;
        }
        if (!data.adminAuthed) {
          socket.emit("admin:auth", { ok: false, message: "Unauthorized" });
          return;
        }
        try {
          const snap = await runtime.getAdminSnapshot();
          socket.emit("admin:snapshot", snap);
        } catch (err) {
          socket.emit("admin:auth", {
            ok: false,
            message:
              err instanceof Error ? err.message : "Failed to load admin data",
          });
        }
      })();
    });

    socket.on("admin:roomLookup", (payload) => {
      void (async () => {
        const data = ensureSocketData(socket);
        if (!data.adminAuthed && verifyAdminSessionToken(payload?.token)) {
          data.adminAuthed = true;
        }
        if (!data.adminAuthed) {
          socket.emit("admin:auth", { ok: false, message: "Unauthorized" });
          return;
        }
        const code = (payload?.code ?? "").trim();
        if (!code) {
          socket.emit("admin:roomLookup", {
            code: "",
            found: false,
            live: null,
            roomEvents: [],
            gameLogs: [],
          });
          return;
        }
        try {
          const result = await runtime.getAdminRoomLookup(code);
          socket.emit("admin:roomLookup", result);
        } catch (err) {
          logSocketException("admin:roomLookup", err);
          socket.emit("admin:roomLookup", {
            code: code.toUpperCase(),
            found: false,
            live: null,
            roomEvents: [],
            gameLogs: [],
          });
        }
      })();
    });

    socket.on("admin:analytics", (payload) => {
      void (async () => {
        const data = ensureSocketData(socket);
        if (!data.adminAuthed && verifyAdminSessionToken(payload?.token)) {
          data.adminAuthed = true;
        }
        if (!data.adminAuthed) {
          socket.emit("admin:auth", { ok: false, message: "Unauthorized" });
          return;
        }
        try {
          const range =
            payload?.range === "day" ||
            payload?.range === "week" ||
            payload?.range === "month"
              ? payload.range
              : "week";
          const days =
            typeof payload?.days === "number" && payload.days > 0
              ? Math.min(90, Math.floor(payload.days))
              : undefined;
          const result = await runtime.getAdminAnalytics({ range, days });
          socket.emit("admin:analytics", result);
        } catch (err) {
          logSocketException("admin:analytics", err);
          socket.emit("admin:auth", {
            ok: false,
            message:
              err instanceof Error
                ? err.message
                : "Failed to load analytics",
          });
        }
      })();
    });

    socket.on("disconnect", () => {
      runtime.disconnect(socket.id);
    });
  });

  return runtime;
}

export function attachSocketServer(
  httpServer: HttpServer,
  corsOrigin: string | string[] = "*"
): IoServer {
  const io: IoServer = new Server<ClientToServerEvents, ServerToClientEvents>(
    httpServer,
    {
      cors: {
        origin: corsOrigin,
        methods: ["GET", "POST"],
      },
      pingTimeout: 20000,
      pingInterval: 25000,
    }
  );

  wireGameSockets(io);
  return io;
}

export function bindPlayerId(
  io: IoServer
) {
  io.use((socket, next) => {
    const playerId = socket.handshake.auth?.playerId as string | undefined;
    if (playerId) rememberPlayerId(socket, playerId);
    const q = socket.handshake.query;
    const headers = socket.handshake.headers;
    const country =
      (typeof q.sd_country === "string" && q.sd_country) ||
      (typeof q.country === "string" && q.country) ||
      (typeof headers["cf-ipcountry"] === "string" &&
        headers["cf-ipcountry"]) ||
      undefined;
    if (country && country !== "XX" && country !== "T1") {
      rememberCountry(socket, country);
    }
    next();
  });
}
