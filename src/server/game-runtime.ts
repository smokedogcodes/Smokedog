import { randomUUID } from "crypto";
import type { Server } from "socket.io";
import type {
  ChatChannel,
  ChatMessage,
  ChronicleEntry,
  ClientToServerEvents,
  DayIntel,
  DaySubPhase,
  GameLog,
  MafiaNightIntel,
  NightAction,
  NightActionType,
  OpenLobby,
  LiveGameListing,
  Phase,
  PhaseAnnouncement,
  Player,
  PublicFiveAliveCard,
  PublicDcCard,
  PublicGameState,
  PublicPlayer,
  RoomSettings,
  ServerToClientEvents,
  VoiceSignalPayload,
} from "@/lib/types";
import {
  DAY_VOTE_SECONDS,
  LOBBY_HOST_IDLE_MS,
  LOBBY_HOST_WARN_AT_MS,
  REVEAL_SECONDS,
  SKIP_VOTE_ID,
} from "@/lib/types";
import { generateRoomCode, RoomError, validateRoomCode } from "@/lib/room-code";
import { uniquePlayerName } from "@/lib/player-name";
import { getGameModule, resolveGameId } from "@/lib/games/registry";
import {
  loadAdminHistory,
  loadAdminRoomLookup,
  loadAdminAnalytics,
  persistAnalyticsEvent,
  persistGameLog,
  persistGameLogAsync,
  persistRoomClose,
  persistRoomOpen,
  type AdminAnalyticsPayload,
} from "@/server/admin-persist";
import {
  nextBotName,
  nextBotAvatarId,
  pickBotNightAction,
  pickBotVoteTarget,
  botNightDelayMs,
  botDayDelayMs,
} from "@/lib/games/mafia-city/bot-ai";
import {
  factionOf,
  isMafiaRole,
  effectiveRole,
  nightActionForPlayer,
  ROLE_META,
} from "@/lib/games/mafia-city/roles";
import {
  assignMafiaCityRoles,
  bulletsForLobby,
  normalizeRoleDistribution,
} from "@/lib/games/mafia-city/balance";
import {
  generateDobbleDeck,
  shuffleCards,
  sharedSymbol,
} from "@/lib/games/spot-it/deck";
import { botSpotItDelayMs, pickBotSpotItSymbol } from "@/lib/games/spot-it/bot-ai";
import {
  applyTttMove,
  checkTttWin,
  emptyTttBoard,
  isTttDraw,
} from "@/lib/games/tic-tac-toe/logic";
import { botTttDelayMs, pickBotTttMove } from "@/lib/games/tic-tac-toe/bot-ai";
import {
  checkC4Win,
  dropC4,
  emptyC4Board,
  isC4Draw,
} from "@/lib/games/connect-4/logic";
import { botC4DelayMs, pickBotC4Column } from "@/lib/games/connect-4/bot-ai";
import { boardTurnSeconds } from "@/lib/games/board/turnTimer";
import {
  toPublicConnect4,
  toPublicSpotIt,
  toPublicTtt,
  type Connect4RoomState,
  type SpotItRoomState,
  type TttRoomState,
} from "@/server/board-game-state";

/** Games where voice is intentionally disabled (text chat may still work). */
function isChatOnlyGame(gameId: string): boolean {
  return (
    gameId === "exploding-kittens" ||
    gameId === "detonation-cats" ||
    gameId === "spot-it" ||
    gameId === "connect-4" ||
    gameId === "battleship"
  );
}
import {
  botBattleshipDelayMs,
  applyBotBattleAction,
  botNeedsReady,
  pickBotFleet,
} from "@/lib/games/battleship/bot-ai";
import {
  beginBattleship,
  autoReadyRandomFleet,
  fireStandardShot,
  rematchBattleship,
  submitFleetReady,
  triggerPowerUp,
} from "@/lib/games/battleship/actions";
import { projectBattleshipPublic } from "@/lib/games/battleship/selectors";
import type { BattleshipGameState } from "@/lib/games/battleship/state";
import type { FleetPlacement } from "@/lib/games/battleship/placement";
import type { PowerUpType, TorpedoDirection, Orientation } from "@/lib/games/battleship/powerups";
import {
  countEvilAmong,
  eligibleVoters,
  playerCanDayVote,
  promoteMafiaAfterBossDeath,
  resolveNight,
  tallyLynch,
  validNightTargets,
  winCheck,
} from "@/lib/games/mafia-city/resolve";
import {
  botFiveAliveDelayMs,
  pickBotFiveAliveTurnPlay,
} from "@/lib/games/5-alive/bot-ai";
import {
  bombResponderIds,
  clearCenterToDiscard,
  drawIntoHand,
  livingCount,
  nextLivingSeatId,
  replenishDrawPile,
  resolveFiveAliveTurnPlay,
  shouldPenalizeOnEmptyHand,
  isBombDefuseCard,
  type FiveAliveSeat,
} from "@/lib/games/5-alive/actions";
import {
  canPlayFiveAliveCardAtTotal,
  handHasPlayableCard,
  isFiveAliveActionCard,
} from "@/lib/games/5-alive/rules";
import {
  buildDealStepsFromHands,
  dealAnimationDurationMs,
  computeDealStaggerMs,
  type FiveAliveDealKind,
} from "@/lib/games/5-alive/dealing";
import {
  fiveAliveBombResponseAnnouncement,
  fiveAlivePassAnnouncement,
  fiveAlivePlayAnnouncement,
} from "@/lib/games/5-alive/announcements";
import {
  botEkDelayMs,
  pickBotDefusePosition,
  pickBotDiscardIndex,
  pickBotEkPlay,
  pickBotFavorCard,
  pickBotNope,
  pickBotStealTarget,
  pickBotTripleType,
  shouldBotDraw,
} from "@/lib/games/exploding-kittens/bot-ai";
import {
  createExplodingKittensState,
  ekDraw,
  ekFavorGive,
  ekFavorTarget,
  ekMaybeWin,
  ekPickDiscard,
  ekPlaceDefuse,
  ekPlayCards,
  ekPlayNope,
  ekResolveNopeWindow,
  ekStealTarget,
  ekTripleDeclare,
  ekBeginDrawPhase,
  ekRandomDefuseIndex,
  newEkLog,
  takeCardsFromHand,
  validatePlayCards,
  type ExplodingKittensRoomState,
} from "@/server/exploding-kittens-runtime";
import { projectExplodingKittensPublic } from "@/lib/games/exploding-kittens/selectors";
import { canAccessChannel } from "@/lib/chat-access";

import {
  buildFiveAliveDeck,
  cardLabel,
  type FiveAliveCardInstance,
  isNumber0,
  shuffle,
} from "@/lib/games/5-alive/cards";

export type IoServer = Server<ClientToServerEvents, ServerToClientEvents>;

const FIVE_ALIVE_HAND_SIZE = 10;

interface Spectator {
  id: string;
  playerId: string;
  socketId: string;
  name: string;
  avatarId: number;
}

interface Room {
  id: string;
  gameId: string;
  settings: RoomSettings;
  players: Player[];
  spectators: Spectator[];
  phase: Phase;
  cycle: number;
  phaseEndsAt: number | null;
  daySubPhase: DaySubPhase | null;
  paused: boolean;
  pausedRemainingMs: number | null;
  nightActions: NightAction[];
  votes: Record<string, string>;
  logs: GameLog[];
  chat: ChatMessage[];
  chronicle: ChronicleEntry[];
  announcement: PhaseAnnouncement | null;
  mafiaNightIntel: MafiaNightIntel;
  dayIntelByPlayer: Record<string, DayIntel>;
  afkGraceEndsAt: number | null;
  afkGracePlayerId: string | null;
  winner: "town" | "mafia" | null;
  fiveAlive?: {
    drawDeck: FiveAliveCardInstance[];
    discardPile: FiveAliveCardInstance[];
    centerPile: FiveAliveCardInstance[];
    handsByPlayerId: Record<string, FiveAliveCardInstance[]>;

    runningTotal: number;
    direction: 1 | -1;
    turnPlayerId: string | null;

    skipNext: boolean;
    pendingDrawCount: number;

    bombAwaitingPlayerId: string | null;
    bombActorId: string | null;
    bombResponderIds: string[];
    repeatTurnForPlayerId: string | null;
    shuffleRedealKeepTotal: boolean;
    dealSeq: number;
    dealKind: FiveAliveDealKind | null;
    dealBanner: string | null;
    dealSteps: import("@/lib/games/5-alive/dealing").FiveAliveDealStep[];
    pendingTurnAfterDeal: string | null;
    dealTimer: ReturnType<typeof setTimeout> | null;
  };
  explodingKittens?: ExplodingKittensRoomState;
  spotIt?: SpotItRoomState;
  ttt?: TttRoomState;
  connect4?: Connect4RoomState;
  battleship?: BattleshipGameState;
  boardWinnerId?: string | null;
  boardDraw?: boolean;
  timer: ReturnType<typeof setTimeout> | null;
  detectiveByPlayer: Record<string, { targetId: string; faction: "town" | "mafia" }>;
  afkWarnedPlayerIds: string[];
  botTimers: ReturnType<typeof setTimeout>[];
  createdAt: number;
  /** Lobby only: wall-clock when host-idle close should fire (survives timer loss). */
  lobbyIdleDeadlineAt: number | null;
  voiceParticipants: Record<ChatChannel, Set<string>>;
  voiceMutedIds: Set<string>;
}

function log(room: Room, text: string) {
  room.logs.push({ id: randomUUID(), text, at: Date.now() });
  if (room.logs.length > 150) room.logs.splice(0, room.logs.length - 150);
  persistGameLog({
    id: randomUUID(),
    at: Date.now(),
    level: "info",
    roomId: room.id,
    message: text,
  });
}

function toPublicFiveAliveCard(card: FiveAliveCardInstance): PublicFiveAliveCard {
  if (card.type === "number") {
    return { id: card.id, type: card.type, value: card.value };
  }
  return { id: card.id, type: card.type };
}

function living(room: Room): Player[] {
  return room.players.filter((p) => p.alive);
}

function emptyVoiceChannels(): Record<ChatChannel, Set<string>> {
  return { town: new Set(), mafia: new Set(), graveyard: new Set() };
}

function dayVoteEligible(room: Room): Player[] {
  return eligibleVoters(room.players);
}

function dayVoteStats(room: Room) {
  const eligible = dayVoteEligible(room);
  const votesIn = eligible.filter((p) => room.votes[p.id]).length;
  // Denominator is eligible voters only (living + dead villagers), never full roster.
  return { eligible, votesIn, votesNeeded: eligible.length };
}

export class GameRuntime {
  private rooms = new Map<string, Room>();
  private playerRoom = new Map<string, string>();
  private lobbyIdleTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private lobbyWarnTimers = new Map<string, ReturnType<typeof setTimeout>[]>();
  /** Append-only admin audit (in-memory; flushed to AdminActor when present). */
  private adminRoomEvents: Array<{
    id: string;
    code: string;
    hostName: string;
    gameId: string;
    openedAt: number;
    closedAt: number | null;
    reason: string | null;
  }> = [];
  private adminGameLogs: Array<{
    id: string;
    at: number;
    level: "info" | "error" | "exception";
    roomId?: string;
    message: string;
  }> = [];

  constructor(private io: IoServer) {}

  /** Live rooms from memory; historic rooms/logs from AdminActor SQLite. */
  async getAdminSnapshot() {
    await this.sweepExpiredLobbies();
    const history = await loadAdminHistory({ rooms: 500, logs: 2000 });
    const liveCodes = new Set(
      [...this.rooms.keys()].map((c) => c.toUpperCase())
    );

    // History can still say "open" after DO memory loss / redeploy — close those orphans.
    const now = Date.now();
    for (const evt of history.roomEvents) {
      if (evt.closedAt != null) continue;
      if (liveCodes.has(evt.code.toUpperCase())) continue;
      evt.closedAt = now;
      evt.reason = "server_lost";
      await persistRoomClose(evt.code, now, "server_lost", {
        ...evt,
        closedAt: now,
        reason: "server_lost",
      });
      this.trackAnalytics({
        kind: "room_close",
        roomId: evt.code,
        gameId: evt.gameId,
        at: now,
      });
      await persistGameLogAsync({
        id: randomUUID(),
        at: now,
        level: "info",
        roomId: evt.code,
        message: `Room ${evt.code} marked closed (server_lost) — was open in history but not live in memory`,
      });
    }

    const roomsOpen = [...this.rooms.values()].map((r) => {
      const humans = r.players.filter((p) => !p.isBot);
      const connected = humans.filter((p) => !!p.socketId).length;
      return {
        code: r.id,
        gameId: r.gameId,
        phase: r.phase,
        paused: r.paused,
        players: humans.length,
        connected,
        bots: r.players.filter((p) => p.isBot).length,
        host: r.players.find((p) => p.isHost)?.name ?? null,
        createdAt: r.createdAt,
        lobbyIdleDeadlineAt: r.lobbyIdleDeadlineAt,
      };
    });

    return {
      roomsOpen,
      roomEvents: history.roomEvents,
      gameLogs: history.gameLogs,
      health: {
        ok: true,
        roomCount: this.rooms.size,
        at: Date.now(),
        storedRoomEvents: history.totals.roomEvents,
        storedGameLogs: history.totals.gameLogs,
        socketHost: "sd-game.smokedog.workers.dev",
      },
    };
  }

  async getAdminRoomLookup(code: string) {
    await this.sweepExpiredLobbies();
    const normalized = code.trim().toUpperCase();
    // Reconcile orphans so lookup status matches live memory.
    await this.getAdminSnapshot();
    const history = await loadAdminRoomLookup(normalized);
    const live = this.getRoom(normalized);
    return {
      code: normalized,
      found: history.found || !!live,
      live: live
        ? {
            code: live.id,
            gameId: live.gameId,
            phase: live.phase,
            paused: live.paused,
            createdAt: live.createdAt,
            lobbyIdleDeadlineAt: live.lobbyIdleDeadlineAt,
            host: live.players.find((p) => p.isHost)?.name ?? null,
            players: live.players.map((p) => ({
              id: p.id,
              name: p.name,
              isHost: p.isHost,
              isBot: !!p.isBot,
              alive: p.alive,
              connected: !!p.socketId,
            })),
          }
        : null,
      roomEvents: history.roomEvents,
      gameLogs: history.gameLogs,
    };
  }

  async getAdminAnalytics(opts?: {
    range?: "day" | "week" | "month";
    days?: number;
  }): Promise<AdminAnalyticsPayload> {
    return loadAdminAnalytics(opts);
  }

  trackAnalytics(event: {
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
    at?: number;
  }) {
    persistAnalyticsEvent({
      id: randomUUID(),
      at: event.at ?? Date.now(),
      kind: event.kind,
      path: event.path ?? null,
      gameId: event.gameId ?? null,
      roomId: event.roomId ?? null,
      playerId: event.playerId ?? null,
      country: event.country ?? null,
    });
  }

  private pushAdminLog(
    level: "info" | "error" | "exception",
    message: string,
    roomId?: string
  ) {
    const row = {
      id: randomUUID(),
      at: Date.now(),
      level,
      roomId,
      message,
    };
    this.adminGameLogs.push(row);
    if (this.adminGameLogs.length > 500) {
      this.adminGameLogs.splice(0, this.adminGameLogs.length - 500);
    }
    persistGameLog(row);
  }

  private clearLobbyIdleTimers(roomId: string) {
    const idle = this.lobbyIdleTimers.get(roomId);
    if (idle) clearTimeout(idle);
    this.lobbyIdleTimers.delete(roomId);
    const warns = this.lobbyWarnTimers.get(roomId);
    if (warns) {
      for (const t of warns) clearTimeout(t);
    }
    this.lobbyWarnTimers.delete(roomId);
  }

  private lobbyHostConnected(room: Room): boolean {
    const host = room.players.find((p) => p.isHost);
    return !!host?.socketId;
  }

  /**
   * Lobby presence is server socket only — never mouse/tab/client activity.
   * If the seated host has no socket but another human is connected, hand host over
   * so the room does not idle-close on an abandoned seat.
   */
  private promoteConnectedHostIfNeeded(room: Room) {
    if (room.phase !== "lobby") return;
    const host = room.players.find((p) => p.isHost);
    if (!host || host.socketId) return;
    const next = this.pickNextHumanHost(room, host.id);
    if (!next?.socketId) return;
    host.isHost = false;
    next.isHost = true;
    log(room, `${next.name} is now the host.`);
  }

  /**
   * Sync lobby idle countdown to host socket presence (server-only).
   * Starts the 5min close only when the current host has no socketId.
   * Does NOT treat mouse/tab idle as away — a connected host waiting for
   * players never starts this timer. Client activity must never call this
   * to "reset" an idle clock while the host is online.
   */
  syncLobbyHostOfflineIdle(room: Room) {
    if (room.phase !== "lobby") {
      room.lobbyIdleDeadlineAt = null;
      this.clearLobbyIdleTimers(room.id);
      return;
    }

    if (this.lobbyHostConnected(room)) {
      room.lobbyIdleDeadlineAt = null;
      this.clearLobbyIdleTimers(room.id);
      return;
    }

    // Host socket offline — start countdown if not already running; otherwise resume.
    if (
      room.lobbyIdleDeadlineAt != null &&
      room.lobbyIdleDeadlineAt > Date.now() &&
      (this.lobbyWarnTimers.has(room.id) || this.lobbyIdleTimers.has(room.id))
    ) {
      return;
    }

    this.scheduleLobbyHostIdleCountdown(room);
  }

  /** Schedule progressive host-only warnings + close from now (or remaining deadline). */
  private scheduleLobbyHostIdleCountdown(room: Room) {
    this.clearLobbyIdleTimers(room.id);

    const now = Date.now();
    const deadline =
      room.lobbyIdleDeadlineAt != null && room.lobbyIdleDeadlineAt > now
        ? room.lobbyIdleDeadlineAt
        : now + LOBBY_HOST_IDLE_MS;
    room.lobbyIdleDeadlineAt = deadline;
    const elapsed = Math.max(0, LOBBY_HOST_IDLE_MS - (deadline - now));

    const warnMessages: Record<1 | 2 | 3, string> = {
      1: "Your connection dropped 30 seconds ago. This lobby closes after 5 minutes while the host is offline — reconnect to keep it open.",
      2: "Your connection has been down for 1 minute. This lobby closes after 5 minutes while the host is offline — reconnect to keep it open.",
      3: "This lobby is closing now after 5 minutes with the host offline.",
    };

    const warnTimers = LOBBY_HOST_WARN_AT_MS.flatMap((atMs, index) => {
      const stage = (index + 1) as 1 | 2 | 3;
      const isFinal = stage === 3;
      const delay = atMs - elapsed;
      if (delay < 0 && !isFinal) return [];
      const wait = Math.max(0, delay);
      return [
        setTimeout(() => {
          const current = this.getRoom(room.id);
          if (!current || current.phase !== "lobby") return;
          if (this.lobbyHostConnected(current)) {
            current.lobbyIdleDeadlineAt = null;
            this.clearLobbyIdleTimers(current.id);
            return;
          }
          // Host is offline — they cannot receive socket events. Persist for reconnect toast.
          // Warnings are host-only; other players never get these events.
          const host = current.players.find((p) => p.isHost);
          if (host?.socketId) {
            this.io.to(host.socketId).emit("lobby:idleWarning", {
              stage,
              closesInMs: Math.max(0, (current.lobbyIdleDeadlineAt ?? 0) - Date.now()),
              message: warnMessages[stage],
              ...(isFinal ? { isFinal: true } : {}),
            });
          }
          if (isFinal) {
            setTimeout(() => {
              void this.sweepExpiredLobbies();
            }, 1500);
          }
        }, wait),
      ];
    });
    this.lobbyWarnTimers.set(room.id, warnTimers);

    const closeDelay = Math.max(0, deadline - now) + 5000;
    this.lobbyIdleTimers.set(
      room.id,
      setTimeout(() => {
        void this.sweepExpiredLobbies();
      }, closeDelay)
    );
  }

  /** Close lobbies past idle deadline (works even if setTimeout was lost on DO hibernate). */
  private async sweepExpiredLobbies() {
    const now = Date.now();
    const expired = [...this.rooms.values()].filter((r) => {
      if (r.phase !== "lobby") return false;
      if (this.lobbyHostConnected(r)) {
        // Host came back — clear stale deadline.
        r.lobbyIdleDeadlineAt = null;
        this.clearLobbyIdleTimers(r.id);
        return false;
      }
      return r.lobbyIdleDeadlineAt != null && r.lobbyIdleDeadlineAt <= now;
    });
    for (const room of expired) {
      await this.closeLobby(room, "host_afk");
    }
  }

  private async closeLobby(room: Room, reason: string) {
    this.clearLobbyIdleTimers(room.id);
    room.lobbyIdleDeadlineAt = null;
    this.clearTimer(room);
    this.clearBotTimers(room);
    const host = room.players.find((p) => p.isHost);
    const closedAt = Date.now();
    const evt = this.adminRoomEvents.find(
      (e) => e.code === room.id && e.closedAt == null
    );
    const openRow = evt ?? {
      id: randomUUID(),
      code: room.id,
      hostName: host?.name ?? "?",
      gameId: room.gameId,
      openedAt: room.createdAt,
      closedAt: null as number | null,
      reason: null as string | null,
    };
    openRow.closedAt = closedAt;
    openRow.reason = reason;
    if (!evt) this.adminRoomEvents.push(openRow);

    // Await so DO hibernation cannot cancel the SQLite write.
    await persistRoomClose(room.id, closedAt, reason, {
      ...openRow,
      closedAt,
      reason,
    });
    this.trackAnalytics({
      kind: "room_close",
      roomId: room.id,
      gameId: room.gameId,
      at: closedAt,
    });
    await persistGameLogAsync({
      id: randomUUID(),
      at: closedAt,
      level: "info",
      roomId: room.id,
      message: `Lobby ${room.id} closed (${reason})`,
    });

    for (const p of room.players) {
      this.playerRoom.delete(p.id);
      if (p.socketId) {
        const message =
          reason === "host_afk"
            ? "Lobby closed — host was offline too long."
            : reason === "host_quit"
              ? "Lobby closed — host left."
              : "Lobby closed — no players remaining.";
        this.io.to(p.socketId).emit("room:error", {
          message,
          code: "LOBBY_CLOSED",
        });
      }
    }
    this.rooms.delete(room.id);
    this.broadcastLobbies();
  }

  private getRoom(roomId: string): Room | undefined {
    return this.rooms.get(roomId.toUpperCase());
  }

  private requireHost(room: Room, playerId: string): Player | null {
    const p = room.players.find((x) => x.id === playerId);
    return p?.isHost ? p : null;
  }

  /** Prefer a connected human; otherwise any human. Never bots. */
  private pickNextHumanHost(
    room: Room,
    excludingPlayerId: string
  ): Player | null {
    return (
      room.players.find(
        (p) => p.id !== excludingPlayerId && !p.isBot && !!p.socketId
      ) ??
      room.players.find((p) => p.id !== excludingPlayerId && !p.isBot) ??
      null
    );
  }

  /**
   * If `leaving` is host, move host to another human before they are removed.
   * Returns the new host, or null if none available.
   */
  private transferHostFrom(
    room: Room,
    leaving: Player
  ): Player | null {
    if (!leaving.isHost) return null;
    const next = this.pickNextHumanHost(room, leaving.id);
    if (!next) return null;
    leaving.isHost = false;
    next.isHost = true;
    log(room, `${next.name} is now the host.`);
    return next;
  }

  /** After removals: repair 0 or multiple human hosts. Never promote bots. */
  private ensureHumanHost(room: Room) {
    const humans = room.players.filter((p) => !p.isBot);
    if (humans.length === 0) {
      for (const p of room.players) p.isHost = false;
      return;
    }
    const hosts = humans.filter((p) => p.isHost);
    if (hosts.length === 1) return;
    for (const p of room.players) p.isHost = false;
    const next =
      humans.find((p) => !!p.socketId) ?? humans[0];
    next.isHost = true;
    log(room, `${next.name} is now the host.`);
  }

  private playerBySocket(socketId: string): { room: Room; player: Player } | null {
    for (const room of this.rooms.values()) {
      const player = room.players.find((p) => p.socketId === socketId);
      if (player) return { room, player };
    }
    return null;
  }

  private toPublicPlayer(room: Room, p: Player, viewerId: string, revealAll: boolean): PublicPlayer {
    const viewer = room.players.find((x) => x.id === viewerId);
    const viewerIsHost = !!viewer?.isHost;
    const viewerIsMafia = viewer?.role ? isMafiaRole(viewer.role) : false;
    const viewerIsTown = viewer?.role ? !isMafiaRole(viewer.role) : false;
    const showRole =
      revealAll ||
      p.id === viewerId ||
      (viewerIsMafia && isMafiaRole(p.role) && room.phase !== "gameover");
    return {
      id: p.id,
      name: p.name,
      avatarId: p.avatarId,
      alive: p.alive,
      isHost: p.isHost,
      ready: p.ready,
      afkCount: p.afkCount,
      blackmailed: p.blackmailed && room.phase === "day",
      role: showRole ? p.role : undefined,
      lives: p.lives,
      connected: p.isBot || !!p.socketId,
      isBot: viewerIsHost ? !!p.isBot : false,
    };
  }

  private setAnnouncement(
    room: Room,
    tone: PhaseAnnouncement["tone"],
    title: string,
    detail?: string
  ) {
    room.announcement = {
      id: randomUUID(),
      tone,
      title,
      detail,
      at: Date.now(),
    };
  }

  private fiveAliveAnnounce(
    room: Room,
    ann: { title: string; detail: string; tone?: "info" | "good" | "bad" }
  ) {
    this.setAnnouncement(
      room,
      ann.tone ?? "info",
      ann.title,
      ann.detail
    );
  }

  private addChronicle(
    room: Room,
    phase: "night" | "day",
    summary: string
  ) {
    room.chronicle.push({
      id: randomUUID(),
      cycle: room.cycle,
      phase,
      summary,
      at: Date.now(),
    });
  }

  private channelAccessOpts(room: Room, you: Player | null) {
    return {
      alive: !!you?.alive,
      role: you?.role,
      blackmailed: !!you?.blackmailed,
      phase: room.phase,
      daySubPhase: room.daySubPhase ?? undefined,
    };
  }

  private sanitize(room: Room, viewerId: string | null): PublicGameState {
    const you = viewerId
      ? room.players.find((p) => p.id === viewerId) ?? null
      : null;
    const revealAll = room.phase === "gameover";
    const viewerIsMafia = you?.role ? isMafiaRole(you.role) : false;
    const five = room.gameId === "five-alive" ? room.fiveAlive : undefined;
    const ek =
      room.gameId === "exploding-kittens" || room.gameId === "detonation-cats"
        ? room.explodingKittens
        : undefined;
    const rolePreview =
      room.phase === "lobby"
        ? normalizeRoleDistribution(
            room.settings.roleDistribution,
            room.players.length
          )
        : null;
    const displayRole = you
      ? revealAll
        ? you.role
        : effectiveRole(you)
      : undefined;
    return {
      roomId: room.id,
      gameId: room.gameId,
      settings: room.settings,
      players: room.players.map((p) =>
        this.toPublicPlayer(room, p, viewerId ?? "", revealAll)
      ),
      phase: room.phase,
      cycle: room.cycle,
      phaseEndsAt: room.paused ? null : room.phaseEndsAt,
      paused: room.paused,
      logs: room.logs,
      winner: room.winner,
      recap: revealAll
        ? room.players.map((p) => this.toPublicPlayer(room, p, viewerId ?? "", true))
        : null,
      you: you
        ? {
            id: you.id,
            role: displayRole,
            faction: you.role ? factionOf(you.role) : undefined,
            bulletsLeft: you.bulletsLeft,
            alive: you.alive,
            isHost: you.isHost,
            blackmailed: you.blackmailed && room.phase === "day",
          }
        : null,
      votes: room.phase === "day" && room.daySubPhase === "vote" ? room.votes : {},
      submittedNightAction:
        !!you &&
        room.nightActions.some((a) => a.playerId === you.id && !a.auto),
      nightActionTargetId:
        you && room.phase === "night"
          ? room.nightActions.find((a) => a.playerId === you.id)?.targetId ??
            null
          : null,
      detectiveResult: you ? room.detectiveByPlayer[you.id] ?? null : null,
      afkWarnedPlayerIds: you?.isHost ? room.afkWarnedPlayerIds : [],
      chat: this.visibleChat(room, you),
      canSkipDay: this.canSkipDay(room),
      dayVotesIn: dayVoteStats(room).votesIn,
      dayVotesNeeded: dayVoteStats(room).votesNeeded,
      voiceParticipants: this.publicVoiceParticipants(room),
      voiceMutedIds: [...room.voiceMutedIds],
      autoPlayerCount: you?.isHost
        ? room.players.filter((p) => p.isBot).length
        : 0,
      daySubPhase: room.daySubPhase ?? undefined,
      announcement: room.announcement,
      mafiaTeam:
        viewerIsMafia && room.phase !== "lobby"
          ? room.players
              .filter((p) => isMafiaRole(p.role))
              .map((p) => this.toPublicPlayer(room, p, viewerId ?? "", false))
          : undefined,
      mafiaNightIntel:
        viewerIsMafia && room.phase === "night"
          ? room.mafiaNightIntel
          : undefined,
      dayIntel: you ? room.dayIntelByPlayer[you.id] ?? null : null,
      jugglerAvailable:
        !!you &&
        you.alive &&
        you.role === "juggler" &&
        !you.jugglerUsed &&
        room.phase === "day" &&
        (room.daySubPhase === "discussion" ||
          (!!room.settings.localMode && room.daySubPhase === "vote")),
      chronicle: revealAll ? room.chronicle : undefined,
      afkGraceEndsAt: null,
      afkGracePlayerId: null,
      roleDistributionPreview: rolePreview,
      deadVillagerVote:
        !!you &&
        !you.alive &&
        playerCanDayVote(you) &&
        room.daySubPhase === "vote",
      fiveAlive: five
        ? (() => {
            const isDealing = room.phase === "fivealive_dealing";
            const viewerHand = five.handsByPlayerId[you?.id ?? ""] ?? [];
            const opponentHandCounts: Record<string, number> = {};
            const handCounts: Record<string, number> = {};
            for (const [pid, hand] of Object.entries(five.handsByPlayerId)) {
              handCounts[pid] = hand.length;
              if (pid !== you?.id) opponentHandCounts[pid] = hand.length;
            }
            const dealEvent =
              isDealing && five.dealKind
                ? {
                    seq: five.dealSeq,
                    kind: five.dealKind,
                    banner: five.dealBanner,
                    staggerMs: computeDealStaggerMs(five.dealSteps.length),
                    sourceCount: five.dealSteps.length,
                    steps: five.dealSteps.map((step) => {
                      const raw =
                        step.playerId === you?.id
                          ? viewerHand[step.cardIndex]
                          : undefined;
                      const card = raw
                        ? toPublicFiveAliveCard(raw as FiveAliveCardInstance)
                        : undefined;
                      return card
                        ? { playerId: step.playerId, cardIndex: step.cardIndex, card }
                        : { playerId: step.playerId, cardIndex: step.cardIndex };
                    }),
                  }
                : null;

            return {
              runningTotal: five.runningTotal,
              direction: five.direction,
              turnPlayerId: five.pendingTurnAfterDeal ?? five.turnPlayerId,
              skipNext: five.skipNext,
              pendingDrawCount: five.pendingDrawCount,
              yourHand: isDealing
                ? []
                : viewerHand.map(toPublicFiveAliveCard),
              bombAwaitingPlayerId: five.bombAwaitingPlayerId,
              bombActorId: five.bombActorId,
              bombResponderIds: five.bombResponderIds,
              // During shuffle deal, show the collected pool size as the deal deck.
              drawPileCount:
                isDealing && five.dealKind === "shuffle"
                  ? five.dealSteps.length
                  : five.drawDeck.length,
              discardPileCount: five.discardPile.length,
              centerPileCount: isDealing ? 0 : five.centerPile.length,
              centerTopCard:
                isDealing || five.centerPile.length === 0
                  ? null
                  : toPublicFiveAliveCard(
                      five.centerPile[five.centerPile.length - 1] as FiveAliveCardInstance
                    ),
              centerRecentCards:
                isDealing || five.centerPile.length === 0
                  ? []
                  : five.centerPile
                      .slice(-3)
                      .map((c) =>
                        toPublicFiveAliveCard(c as FiveAliveCardInstance)
                      ),
              dealEvent,
              handCounts,
              opponentHandCounts,
              isDealing,
            };
          })()
        : undefined,
      explodingKittens: ek
        ? projectExplodingKittensPublic(ek, you?.id ?? null)
        : undefined,
      spotIt:
        room.spotIt && room.gameId === "spot-it"
          ? toPublicSpotIt(
              room.spotIt,
              you?.id,
              room.players.map((p) => ({ id: p.id, name: p.name }))
            )
          : undefined,
      ttt:
        room.ttt && room.gameId === "tic-tac-toe"
          ? toPublicTtt(room.ttt)
          : undefined,
      connect4:
        room.connect4 && room.gameId === "connect-4"
          ? toPublicConnect4(room.connect4)
          : undefined,
      battleship:
        room.battleship && room.gameId === "battleship"
          ? projectBattleshipPublic(room.battleship, you?.id ?? null)
          : undefined,
      boardWinnerId: revealAll ? room.boardWinnerId ?? null : undefined,
      boardDraw: revealAll ? !!room.boardDraw : undefined,
    };
  }

  private canSkipDay(room: Room): boolean {
    if (
      room.phase !== "day" ||
      room.daySubPhase !== "vote" ||
      room.paused
    ) {
      return false;
    }
    const { eligible, votesIn } = dayVoteStats(room);
    if (eligible.length === 0) return true;
    return votesIn >= eligible.length;
  }

  private publicVoiceParticipants(
    room: Room
  ): Partial<Record<ChatChannel, string[]>> {
    const out: Partial<Record<ChatChannel, string[]>> = {};
    for (const channel of ["town", "mafia", "graveyard"] as ChatChannel[]) {
      const ids = [...room.voiceParticipants[channel]];
      if (ids.length > 0) out[channel] = ids;
    }
    return out;
  }

  private visibleChat(room: Room, you: Player | null): ChatMessage[] {
    const opts = this.channelAccessOpts(room, you);
    return room.chat
      .filter((m) => {
        if (m.channel === "town") {
          return (
            canAccessChannel("town", opts) ||
            (!!you && !you.alive && room.phase === "day")
          );
        }
        if (m.channel === "graveyard") return !!you && !you.alive;
        if (m.channel === "mafia") {
          return canAccessChannel("mafia", opts);
        }
        return false;
      })
      .slice(-50);
  }

  emitRoom(room: Room) {
    for (const player of room.players) {
      if (!player.socketId) continue;
      this.io.to(player.socketId).emit("room:state", this.sanitize(room, player.id));
    }
    for (const spec of room.spectators) {
      if (!spec.socketId) continue;
      this.io.to(spec.socketId).emit("room:state", {
        ...this.sanitize(room, null),
        spectatorMode: true,
      });
    }
    this.broadcastLobbies();
    this.broadcastLiveGames();
  }

  restoreSocketRoomMemberships() {
    for (const room of this.rooms.values()) {
      for (const player of room.players) {
        if (player.socketId) {
          this.joinSocketRooms(player.socketId, room, player);
        }
      }
      for (const spec of room.spectators) {
        if (spec.socketId) {
          this.joinSocketRooms(spec.socketId, room);
        }
      }
    }
  }

  listOpenLobbies(query = ""): OpenLobby[] {
    const q = query.trim().toUpperCase();
    const rows: OpenLobby[] = [];
    for (const room of this.rooms.values()) {
      if (room.phase !== "lobby") continue;
      const mod = getGameModule(room.gameId);
      const openSlots = mod.maxPlayers - room.players.length;
      if (openSlots <= 0) continue;
      const host = room.players.find((p) => p.isHost) ?? room.players[0];
      if (!host) continue;
      const listing: OpenLobby = {
        roomId: room.id,
        gameId: room.gameId,
        hostName: host.name,
        hostAvatarId: host.avatarId,
        playerCount: room.players.length,
        maxPlayers: mod.maxPlayers,
        openSlots,
        botCount: room.players.filter((p) => p.isBot).length,
        humanCount: room.players.filter((p) => !p.isBot).length,
      };
      if (
        q &&
        !listing.roomId.includes(q) &&
        !listing.hostName.toUpperCase().includes(q)
      ) {
        continue;
      }
      rows.push(listing);
    }
    return rows.sort((a, b) => b.openSlots - a.openSlots || a.roomId.localeCompare(b.roomId));
  }

  broadcastLobbies() {
    void this.sweepExpiredLobbies().then(() => {
      this.io.to("lobby-browser").emit("lobbies:list", {
        lobbies: this.listOpenLobbies(),
      });
    });
  }

  listLiveGames(query = ""): LiveGameListing[] {
    const q = query.trim().toUpperCase();
    const rows: LiveGameListing[] = [];
    for (const room of this.rooms.values()) {
      if (room.phase === "lobby" || room.phase === "gameover") continue;
      const host = room.players.find((p) => p.isHost) ?? room.players[0];
      if (!host) continue;
      const listing: LiveGameListing = {
        roomId: room.id,
        gameId: room.gameId,
        hostName: host.name,
        hostAvatarId: host.avatarId,
        playerCount: room.players.length,
        phase: room.phase,
        cycle: room.cycle,
      };
      if (
        q &&
        !listing.roomId.includes(q) &&
        !listing.hostName.toUpperCase().includes(q)
      ) {
        continue;
      }
      rows.push(listing);
    }
    return rows.sort((a, b) => a.roomId.localeCompare(b.roomId));
  }

  broadcastLiveGames() {
    this.io.to("lobby-browser").emit("games:live", {
      games: this.listLiveGames(),
    });
  }

  private blockIfSeatedElsewhere(playerId: string, exceptRoomId?: string) {
    const existingId = this.playerRoom.get(playerId);
    if (!existingId || existingId === exceptRoomId) return;
    const existing = this.getRoom(existingId);
    if (!existing) {
      this.playerRoom.delete(playerId);
      return;
    }
    if (existing.phase !== "lobby") {
      throw new RoomError(
        "IN_PROGRESS",
        "You are already in an active match. Leave or finish it first."
      );
    }
    this.leaveRoom(existingId, playerId);
  }

  private removeSpectatorEverywhere(playerId: string, exceptRoomId?: string) {
    for (const room of this.rooms.values()) {
      if (exceptRoomId && room.id === exceptRoomId) continue;
      const before = room.spectators.length;
      room.spectators = room.spectators.filter((s) => s.playerId !== playerId);
      if (room.spectators.length !== before && exceptRoomId) {
        this.emitRoom(room);
      }
    }
  }

  private joinSocketRooms(socketId: string, room: Room, player?: Player) {
    const sock = this.io.sockets.sockets.get(socketId);
    if (!sock) return;
    sock.join(room.id);
    sock.join("lobby-browser");
    if (player) this.joinMafiaRoom(player, room.id);
  }

  private clearTimer(room: Room) {
    if (room.timer) {
      clearTimeout(room.timer);
      room.timer = null;
    }
    this.clearBotTimers(room);
  }

  private clearBotTimers(room: Room) {
    for (const t of room.botTimers) clearTimeout(t);
    room.botTimers = [];
  }

  private delayBot(room: Room, ms: number, fn: () => void) {
    const t = setTimeout(() => {
      room.botTimers = room.botTimers.filter((x) => x !== t);
      fn();
    }, ms);
    room.botTimers.push(t);
  }

  private scheduleBots(room: Room) {
    this.clearBotTimers(room);
    if (room.paused) return;

    if (room.gameId === "five-alive") {
      const five = room.fiveAlive;
      if (!five) return;

      if (room.phase === "fivealive_dealing") return;

      if (room.phase === "fivealive_turn" && five.turnPlayerId) {
        const bot = room.players.find(
          (p) => p.id === five.turnPlayerId && p.isBot && p.alive
        );
        if (!bot) return;
        const wait = botFiveAliveDelayMs();
        this.delayBot(room, wait, () => {
          if (room.phase !== "fivealive_turn" || room.paused || !bot.alive) return;
          if (five.turnPlayerId !== bot.id) return;
          const currentHand = five.handsByPlayerId[bot.id] ?? [];
          const play = pickBotFiveAliveTurnPlay(currentHand, five.runningTotal);
          if (!play) return;
          if (play.pass) {
            this.submitFiveAlivePlayCard(room.id, bot.id, null, undefined, true);
          } else {
            this.submitFiveAlivePlayCard(room.id, bot.id, play.cardId);
          }
        });
        return;
      }

      if (room.phase === "fivealive_bomb" && five.bombAwaitingPlayerId) {
        // Auto-resolve for everyone: play number 0 if held, else lose 1 life.
        const awaitingId = five.bombAwaitingPlayerId;
        const wait = 900 + Math.floor(Math.random() * 400);
        this.delayBot(room, wait, () => {
          if (room.phase !== "fivealive_bomb" || room.paused) return;
          if (five.bombAwaitingPlayerId !== awaitingId) return;
          this.fiveAliveAutoResolveBombResponse(room, awaitingId);
        });
      }
      return;
    }

    if (this.isEkGame(room.gameId)) {
      const ek = room.explodingKittens;
      if (!ek) return;

      if (ek.nopeWindowEndsAt && room.phase === "ek_turn") {
        for (const bot of room.players.filter((p) => p.isBot && p.alive)) {
          const hand = ek.handsByPlayerId[bot.id] ?? [];
          const nopeId = pickBotNope(hand);
          if (!nopeId) continue;
          this.delayBot(room, botEkDelayMs(), () => {
            if (room.paused || !ek.nopeWindowEndsAt) return;
            this.submitEkNope(room.id, bot.id, nopeId);
          });
        }
        return;
      }

      if (room.phase === "ek_turn" && ek.turnPlayerId) {
        const bot = room.players.find(
          (p) => p.id === ek.turnPlayerId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          if (room.phase !== "ek_turn" || room.paused || !bot.alive) return;
          if (ek.turnPlayerId !== bot.id || ek.nopeWindowEndsAt) return;
          const hand = ek.handsByPlayerId[bot.id] ?? [];

          if (ek.subPhase === "draw" || shouldBotDraw(ek, bot.id)) {
            this.submitEkDraw(room.id, bot.id);
            return;
          }

          const play = pickBotEkPlay(hand);
          if (play) {
            this.submitEkPlayCards(room.id, bot.id, play.cardIds);
            if (play.draw) {
              setTimeout(() => {
                this.submitEkDraw(room.id, bot.id);
              }, 500);
            }
          } else {
            this.submitEkEndTurn(room.id, bot.id);
          }
        });
        return;
      }

      if (room.phase === "ek_defuse" && ek.defusePlayerId) {
        const bot = room.players.find(
          (p) => p.id === ek.defusePlayerId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          this.submitEkPlaceDefuse(
            room.id,
            bot.id,
            pickBotDefusePosition(ek.drawDeck.length)
          );
        });
        return;
      }

      if (room.phase === "ek_pick_discard" && ek.pickDiscardPlayerId) {
        const bot = room.players.find(
          (p) => p.id === ek.pickDiscardPlayerId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          this.submitEkPickDiscard(
            room.id,
            bot.id,
            pickBotDiscardIndex(ek.discardPile.length)
          );
        });
        return;
      }

      if (room.phase === "ek_steal" && ek.stealActorId) {
        const bot = room.players.find(
          (p) => p.id === ek.stealActorId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          const counts: Record<string, number> = {};
          for (const [pid, h] of Object.entries(ek.handsByPlayerId)) {
            counts[pid] = h.length;
          }
          const target = pickBotStealTarget(
            room.players.filter((p) => p.alive).map((p) => p.id),
            bot.id,
            counts
          );
          if (target) this.submitEkStealTarget(room.id, bot.id, target);
        });
        return;
      }

      if (room.phase === "ek_favor" && ek.favorToId) {
        const bot = room.players.find(
          (p) => p.id === ek.favorToId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          const hand = ek.handsByPlayerId[bot.id] ?? [];
          const cardId = pickBotFavorCard(hand);
          if (cardId) this.submitEkFavorGive(room.id, bot.id, cardId);
        });
        return;
      }

      if (
        room.phase === "ek_favor" &&
        ek.favorFromId &&
        ek.pendingAction?.kind === "favor_pick_target"
      ) {
        const bot = room.players.find(
          (p) => p.id === ek.favorFromId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          const others = room.players.filter(
            (p) => p.alive && p.id !== bot.id
          );
          const target = others[0];
          if (target) this.submitEkFavorTarget(room.id, bot.id, target.id);
        });
        return;
      }

      if (room.phase === "ek_triple" && ek.tripleActorId) {
        const bot = room.players.find(
          (p) => p.id === ek.tripleActorId && p.isBot && p.alive
        );
        if (!bot) return;
        this.delayBot(room, botEkDelayMs(), () => {
          const others = room.players.filter(
            (p) => p.alive && p.id !== bot.id
          );
          const target = others[0];
          if (target) {
            this.submitEkTripleDeclare(
              room.id,
              bot.id,
              target.id,
              pickBotTripleType(ek.handsByPlayerId[bot.id] ?? []) ?? "skip"
            );
          }
        });
      }
      return;
    }

    if (room.gameId === "spot-it" && room.phase === "spotit_play" && room.spotIt) {
      const spot = room.spotIt;
      const center = spot.deck[0];
      if (!center) return;
      for (const bot of room.players.filter((p) => p.isBot)) {
        const top = spot.piles[bot.id]?.[0];
        if (!top) continue;
        const symbolId = pickBotSpotItSymbol(top, center);
        if (symbolId == null) continue;
        const seq = spot.matchSeq;
        this.delayBot(room, botSpotItDelayMs(), () => {
          if (
            room.phase !== "spotit_play" ||
            room.paused ||
            !room.spotIt ||
            room.spotIt.matchSeq !== seq
          ) {
            return;
          }
          this.submitSpotItMatch(room.id, bot.id, symbolId);
        });
      }
      return;
    }

    if (room.gameId === "tic-tac-toe" && room.phase === "ttt_play" && room.ttt) {
      const turn = room.players.find(
        (p) => p.id === room.ttt!.turnPlayerId && p.isBot
      );
      if (!turn) return;
      this.delayBot(room, botTttDelayMs(), () => {
        if (room.phase !== "ttt_play" || room.paused || !room.ttt) return;
        if (room.ttt.turnPlayerId !== turn.id) return;
        const cell = pickBotTttMove(room.ttt.board);
        if (cell == null) return;
        this.submitTttMove(room.id, turn.id, cell);
      });
      return;
    }

    if (room.gameId === "connect-4" && room.phase === "connect4_play" && room.connect4) {
      const turn = room.players.find(
        (p) => p.id === room.connect4!.turnPlayerId && p.isBot
      );
      if (!turn) return;
      this.delayBot(room, botC4DelayMs(), () => {
        if (room.phase !== "connect4_play" || room.paused || !room.connect4) return;
        if (room.connect4.turnPlayerId !== turn.id) return;
        const col = pickBotC4Column(room.connect4.board);
        if (col == null) return;
        this.submitConnect4Drop(room.id, turn.id, col);
      });
      return;
    }

    if (room.gameId === "battleship" && room.battleship) {
      const bs = room.battleship;
      if (room.phase === "battleship_setup") {
        for (const bot of room.players.filter((p) => p.isBot)) {
          if (!botNeedsReady(bs, bot.id)) continue;
          this.delayBot(room, botBattleshipDelayMs(), () => {
            if (room.phase !== "battleship_setup" || room.paused) return;
            this.submitBattleshipReady(room.id, bot.id, pickBotFleet());
          });
        }
        return;
      }
      if (room.phase === "battleship_play" && bs.turnPlayerId) {
        const bot = room.players.find(
          (p) => p.id === bs.turnPlayerId && p.isBot
        );
        if (!bot) return;
        this.delayBot(room, botBattleshipDelayMs(), () => {
          if (room.phase !== "battleship_play" || room.paused || !room.battleship)
            return;
          if (room.battleship.turnPlayerId !== bot.id) return;
          room.battleship = applyBotBattleAction(room.battleship, bot.id);
          this.afterBattleshipAction(room);
        });
      }
      return;
    }

    if (room.phase === "night") {
      for (const bot of living(room).filter((p) => p.isBot)) {
        const wait = botNightDelayMs(bot.role);
        this.delayBot(room, wait, () => {
          if (room.phase !== "night" || room.paused || !bot.alive) return;
          const action = pickBotNightAction(room.players, bot);
          if (!action) return;
          this.submitNightAction(room.id, bot.id, action.type, action.targetId);
        });
      }
    }
    if (room.phase === "day" && room.daySubPhase === "vote") {
      const voters = dayVoteEligible(room).filter(
        (p) => p.isBot && !(p.alive && p.blackmailed)
      );
      voters.forEach((bot, index) => {
        const wait =
          botDayDelayMs() + index * (500 + Math.floor(Math.random() * 900));
        this.delayBot(room, wait, () => {
          if (
            room.phase !== "day" ||
            room.daySubPhase !== "vote" ||
            room.paused ||
            (bot.alive && bot.blackmailed)
          ) {
            return;
          }
          if (!playerCanDayVote(bot) || room.votes[bot.id]) return;
          const targetId = pickBotVoteTarget(room.players, bot, room.votes);
          if (!targetId) return;
          this.submitVote(room.id, bot.id, targetId);
        });
      });
    }
  }

  private schedule(room: Room) {
    this.clearTimer(room);
    if (room.paused || !room.phaseEndsAt) return;
    const delay = Math.max(0, room.phaseEndsAt - Date.now());
    room.timer = setTimeout(() => this.onTimeout(room.id), delay + 30);
  }

  private setPhase(room: Room, phase: Phase, seconds: number | null) {
    room.phase = phase;
    room.paused = false;
    room.pausedRemainingMs = null;
    if (seconds == null) {
      room.phaseEndsAt = null;
      this.clearTimer(room);
    } else {
      room.phaseEndsAt = Date.now() + seconds * 1000;
      this.schedule(room);
    }
  }

  private joinMafiaRoom(player: Player, roomId: string) {
    if (player.socketId && isMafiaRole(player.role) && player.alive) {
      this.io.sockets.sockets.get(player.socketId)?.join(`mafia:${roomId}`);
    }
  }

  private leaveMafiaRooms(player: Player, roomId: string) {
    if (player.socketId) {
      this.io.sockets.sockets.get(player.socketId)?.leave(`mafia:${roomId}`);
    }
  }

  private voiceSocketIds(room: Room, channel: ChatChannel): string[] {
    const ids = room.voiceParticipants[channel];
    const sockets: string[] = [];
    for (const playerId of ids) {
      const p = room.players.find((x) => x.id === playerId);
      if (p?.socketId) sockets.push(p.socketId);
    }
    return sockets;
  }

  private broadcastVoiceParticipants(room: Room, channel: ChatChannel) {
    const participantIds = [...room.voiceParticipants[channel]];
    for (const socketId of this.voiceSocketIds(room, channel)) {
      this.io.to(socketId).emit("voice:participants", { channel, participantIds });
    }
  }

  private removeFromAllVoice(room: Room, playerId: string) {
    room.voiceMutedIds.delete(playerId);
    for (const channel of ["town", "mafia", "graveyard"] as ChatChannel[]) {
      if (!room.voiceParticipants[channel].delete(playerId)) continue;
      this.broadcastVoiceParticipants(room, channel);
    }
  }

  private clearVoiceChannels(room: Room, ...channels: ChatChannel[]) {
    for (const channel of channels) {
      if (room.voiceParticipants[channel].size === 0) continue;
      room.voiceParticipants[channel].clear();
      this.broadcastVoiceParticipants(room, channel);
    }
  }

  private finishDayPhase(room: Room) {
    this.clearTimer(room);
    room.daySubPhase = null;
    this.resolveDayPhase(room);
    if (this.maybeWin(room)) return;
    room.cycle += 1;
    for (const p of room.players) p.blackmailed = false;
    this.startNight(room);
  }

  private startDayVoteSubphase(room: Room, voteSeconds?: number) {
    room.daySubPhase = "vote";
    room.votes = {};
    this.clearVoiceChannels(room, "town");
    const local = room.gameId === "mafia-city" && !!room.settings.localMode;
    const seconds = voteSeconds ?? DAY_VOTE_SECONDS;
    this.setAnnouncement(
      room,
      "info",
      "Voting has started",
      local
        ? "Cast your vote or skip."
        : "Cast your vote or skip. Town voice is now closed."
    );
    log(room, `Day ${room.cycle} — voting open for ${seconds}s.`);
    room.phaseEndsAt = Date.now() + seconds * 1000;
    this.schedule(room);
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  createRoom(opts: {
    socketId: string;
    playerId: string;
    name: string;
    avatarId: number;
    gameId?: string;
    localMode?: boolean;
    country?: string | null;
  }): Room {
    this.blockIfSeatedElsewhere(opts.playerId);
    this.removeSpectatorEverywhere(opts.playerId);
    const requestedId = resolveGameId(opts.gameId);
    const mod = getGameModule(opts.gameId);
    if (mod.status === "maintenance") {
      throw new Error(
        `${mod.displayName} is under maintenance. Try another game.`
      );
    }
    if (mod.id !== requestedId) {
      throw new Error(
        `Could not start ${requestedId}. This game server may need a redeploy.`
      );
    }
    let code = generateRoomCode();
    while (this.rooms.has(code)) code = generateRoomCode();

    const player: Player = {
      id: opts.playerId,
      socketId: opts.socketId,
      name: opts.name.trim().slice(0, 18) || "Operator",
      avatarId: opts.avatarId,
      alive: true,
      isHost: true,
      ready: true,
      afkCount: 0,
      blackmailed: false,
      isBot: false,
    };

    const room: Room = {
      id: code,
      gameId: mod.id,
      settings: mod.createSettings(),
      players: [player],
      spectators: [],
      phase: "lobby",
      cycle: 0,
      phaseEndsAt: null,
      daySubPhase: null,
      paused: false,
      pausedRemainingMs: null,
      nightActions: [],
      votes: {},
      logs: [],
      chat: [],
      chronicle: [],
      announcement: null,
      mafiaNightIntel: {},
      dayIntelByPlayer: {},
      afkGraceEndsAt: null,
      afkGracePlayerId: null,
      winner: null,
      timer: null,
      detectiveByPlayer: {},
      afkWarnedPlayerIds: [],
      botTimers: [],
      createdAt: Date.now(),
      lobbyIdleDeadlineAt: null,
      voiceParticipants: emptyVoiceChannels(),
      voiceMutedIds: new Set(),
    };

    if (mod.id === "mafia-city" && typeof opts.localMode === "boolean") {
      room.settings.localMode = opts.localMode;
    }

    this.rooms.set(code, room);
    this.playerRoom.set(opts.playerId, code);
    this.adminRoomEvents.push({
      id: randomUUID(),
      code,
      hostName: opts.name,
      gameId: room.gameId,
      openedAt: room.createdAt,
      closedAt: null,
      reason: null,
    });
    persistRoomOpen({
      id: this.adminRoomEvents[this.adminRoomEvents.length - 1]!.id,
      code,
      hostName: opts.name,
      gameId: room.gameId,
      openedAt: room.createdAt,
      closedAt: null,
      reason: null,
    });
    this.trackAnalytics({
      kind: "room_open",
      roomId: code,
      gameId: room.gameId,
      playerId: opts.playerId,
      country: opts.country,
      at: room.createdAt,
    });
    this.trackAnalytics({
      kind: "player_seen",
      roomId: code,
      gameId: room.gameId,
      playerId: opts.playerId,
      country: opts.country,
      at: room.createdAt,
    });
    this.pushAdminLog("info", `Lobby ${code} opened by ${opts.name}`, code);
    // Host is socket-connected at create — no offline idle countdown.
    return room;
  }

  joinRoom(opts: {
    roomId: string;
    socketId: string;
    playerId: string;
    name: string;
    avatarId: number;
    country?: string | null;
  }): Room {
    const parsedJoin = validateRoomCode(opts.roomId);
    this.blockIfSeatedElsewhere(
      opts.playerId,
      parsedJoin.ok ? parsedJoin.code : undefined
    );
    this.removeSpectatorEverywhere(opts.playerId);
    const parsed = parsedJoin;
    if (!parsed.ok) {
      throw new RoomError("INVALID_CODE", parsed.message);
    }
    const room = this.getRoom(parsed.code);
    if (!room) {
      throw new RoomError(
        "NOT_FOUND",
        `No lobby exists for code ${parsed.code}. Check the party code and try again.`
      );
    }
    const mod = getGameModule(room.gameId);

    const existing = room.players.find((p) => p.id === opts.playerId);
    if (existing) {
      existing.socketId = opts.socketId;
      const others = room.players
        .filter((p) => p.id !== opts.playerId)
        .map((p) => p.name);
      existing.name =
        uniquePlayerName(opts.name.trim() || existing.name, others) ||
        existing.name;
      existing.avatarId = opts.avatarId;
      if (room.phase === "lobby") existing.ready = true;
      this.playerRoom.set(opts.playerId, room.id);
      this.joinSocketRooms(opts.socketId, room, existing);
      if (room.phase === "lobby") {
        this.promoteConnectedHostIfNeeded(room);
        this.syncLobbyHostOfflineIdle(room);
      }
      return room;
    }

    if (room.phase !== "lobby") {
      throw new RoomError(
        "IN_PROGRESS",
        "That lobby already started a match. Ask the host for a new code."
      );
    }
    if (room.players.length >= mod.maxPlayers) {
      throw new RoomError("FULL", "That lobby is full.");
    }

    const name = uniquePlayerName(
      opts.name,
      room.players.map((p) => p.name)
    );

    room.players.push({
      id: opts.playerId,
      socketId: opts.socketId,
      name,
      avatarId: opts.avatarId,
      alive: true,
      isHost: false,
      ready: true,
      afkCount: 0,
      blackmailed: false,
      isBot: false,
    });
    this.playerRoom.set(opts.playerId, room.id);
    this.joinSocketRooms(opts.socketId, room, room.players[room.players.length - 1]);
    this.promoteConnectedHostIfNeeded(room);
    this.syncLobbyHostOfflineIdle(room);
    this.trackAnalytics({
      kind: "room_join",
      roomId: room.id,
      gameId: room.gameId,
      playerId: opts.playerId,
      country: opts.country,
    });
    this.trackAnalytics({
      kind: "player_seen",
      roomId: room.id,
      gameId: room.gameId,
      playerId: opts.playerId,
      country: opts.country,
    });
    return room;
  }

  rejoin(opts: { roomId: string; socketId: string; playerId: string }): Room {
    const parsed = validateRoomCode(opts.roomId);
    if (!parsed.ok) {
      throw new RoomError("INVALID_CODE", parsed.message);
    }
    const room = this.getRoom(parsed.code);
    if (!room) {
      throw new RoomError(
        "NOT_FOUND",
        `No lobby exists for code ${parsed.code}. It may have closed.`
      );
    }
    const player = room.players.find((p) => p.id === opts.playerId);
    if (!player || player.isBot) {
      throw new RoomError("NOT_IN_ROOM", "You are not in this lobby. Join with the party code from the hub.");
    }
    player.socketId = opts.socketId;
    if (room.phase === "lobby") player.ready = true;
    this.playerRoom.set(opts.playerId, room.id);
    this.joinSocketRooms(opts.socketId, room, player);
    if (room.phase === "lobby") {
      this.promoteConnectedHostIfNeeded(room);
      this.syncLobbyHostOfflineIdle(room);
    }
    return room;
  }

  spectateRoom(opts: {
    roomId: string;
    socketId: string;
    playerId: string;
    name: string;
    avatarId: number;
  }): Room {
    const parsed = validateRoomCode(opts.roomId);
    if (!parsed.ok) {
      throw new RoomError("INVALID_CODE", parsed.message);
    }
    this.blockIfSeatedElsewhere(opts.playerId);
    this.removeSpectatorEverywhere(opts.playerId, parsed.code);
    const room = this.getRoom(parsed.code);
    if (!room) {
      throw new RoomError(
        "NOT_FOUND",
        `No match exists for code ${parsed.code}.`
      );
    }
    if (room.phase === "lobby") {
      throw new RoomError(
        "NOT_FOUND",
        "That party has not started yet. Join as a player instead."
      );
    }
    if (room.phase === "gameover") {
      throw new RoomError("NOT_FOUND", "That match has already ended.");
    }
    if (room.players.some((p) => p.id === opts.playerId)) {
      throw new RoomError(
        "IN_PROGRESS",
        "You are already in this match as a player."
      );
    }

    room.spectators = room.spectators.filter((s) => s.playerId !== opts.playerId);
    room.spectators.push({
      id: randomUUID(),
      playerId: opts.playerId,
      socketId: opts.socketId,
      name: opts.name.trim().slice(0, 18) || "Observer",
      avatarId: opts.avatarId,
    });
    this.joinSocketRooms(opts.socketId, room);
    this.emitRoom(room);
    return room;
  }

  setReady(roomId: string, playerId: string, ready: boolean) {
    const room = this.getRoom(roomId);
    if (!room || room.phase !== "lobby") return;
    const p = room.players.find((x) => x.id === playerId);
    if (p && !p.isBot) p.ready = ready;
    this.emitRoom(room);
  }

  updateSettings(roomId: string, playerId: string, patch: Partial<RoomSettings>) {
    const room = this.getRoom(roomId);
    if (!room) return;
    if (!this.requireHost(room, playerId)) return;

    const midGame = room.phase !== "lobby" && room.phase !== "gameover";

    if (typeof patch.nightSeconds === "number") {
      room.settings.nightSeconds = Math.min(120, Math.max(15, patch.nightSeconds));
    }
    if (typeof patch.daySeconds === "number") {
      const isBoardTurnGame =
        room.gameId === "tic-tac-toe" || room.gameId === "connect-4";
      const minDay =
        room.gameId === "five-alive" || isBoardTurnGame ? 10 : 20;
      const maxDay =
        room.gameId === "five-alive" ? 120 : isBoardTurnGame ? 60 : 200;
      room.settings.daySeconds = Math.min(
        maxDay,
        Math.max(minDay, patch.daySeconds)
      );
      if (
        midGame &&
        room.gameId === "five-alive" &&
        !room.paused &&
        room.phaseEndsAt &&
        (room.phase === "fivealive_turn" || room.phase === "fivealive_bomb")
      ) {
        room.phaseEndsAt = Date.now() + room.settings.daySeconds * 1000;
        this.schedule(room);
      } else if (
        midGame &&
        room.gameId === "five-alive" &&
        room.paused &&
        room.pausedRemainingMs != null &&
        (room.phase === "fivealive_turn" || room.phase === "fivealive_bomb")
      ) {
        room.pausedRemainingMs = room.settings.daySeconds * 1000;
      }
    }
    if (!midGame) {
      if (patch.vigilanteBullets === null) {
        room.settings.vigilanteBullets = null;
      } else if (typeof patch.vigilanteBullets === "number") {
        room.settings.vigilanteBullets = Math.min(
          3,
          Math.max(1, patch.vigilanteBullets)
        );
      }
      if (patch.roleDistribution !== undefined) {
        room.settings.roleDistribution = normalizeRoleDistribution(
          patch.roleDistribution,
          room.players.length
        );
      }
      if (typeof patch.localMode === "boolean" && room.gameId === "mafia-city") {
        room.settings.localMode = patch.localMode;
      }
    }
    // Settings changes do not affect host-offline idle (socket presence only).
    this.emitRoom(room);
  }

  addBots(roomId: string, playerId: string, fillTo?: number) {
    const room = this.getRoom(roomId);
    if (!room || room.phase !== "lobby") {
      throw new RoomError("NOT_LOBBY", "Bots can only be added in the lobby.");
    }
    if (!this.requireHost(room, playerId)) {
      throw new RoomError("NOT_HOST", "Only the host can add bots.");
    }
    const mod = getGameModule(room.gameId);
    if (fillTo != null) {
      const target = Math.min(mod.maxPlayers, fillTo);
      while (room.players.length < target) {
        this.pushBot(room);
      }
    } else {
      if (room.players.length >= mod.maxPlayers) {
        throw new RoomError("FULL", "Lobby is full.");
      }
      this.pushBot(room);
    }
    this.emitRoom(room);
  }

  private pushBot(room: Room) {
    const name = nextBotName(room.players.map((p) => p.name));
    const avatarId = nextBotAvatarId(room.players.map((p) => p.avatarId));
    room.players.push({
      id: `bot-${randomUUID()}`,
      socketId: null,
      name,
      avatarId,
      alive: true,
      isHost: false,
      ready: true,
      afkCount: 0,
      blackmailed: false,
      isBot: true,
    });
  }

  removeBot(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.phase !== "lobby") {
      throw new RoomError("NOT_LOBBY", "Auto players can only be removed in the lobby.");
    }
    if (!this.requireHost(room, playerId)) {
      throw new RoomError("NOT_HOST", "Only the host can remove auto players.");
    }
    const idx = [...room.players].reverse().findIndex((p) => p.isBot);
    if (idx === -1) {
      throw new RoomError("NO_BOTS", "No auto players to remove.");
    }
    const removeAt = room.players.length - 1 - idx;
    room.players.splice(removeAt, 1);
    this.emitRoom(room);
  }

  startGame(roomId: string, playerId: string, country?: string | null) {
    const room = this.getRoom(roomId);
    if (!room) throw new Error("Room not found");
    if (!this.requireHost(room, playerId)) throw new Error("Only the host can start");
    if (room.phase !== "lobby") throw new Error("Game already started");
    const mod = getGameModule(room.gameId);
    if (room.players.length < mod.minPlayers) {
      throw new Error(`Need at least ${mod.minPlayers} players`);
    }
    this.clearLobbyIdleTimers(room.id);
    room.lobbyIdleDeadlineAt = null;

    this.trackAnalytics({
      kind: "game_start",
      roomId: room.id,
      gameId: room.gameId,
      playerId,
      country,
    });

    if (room.gameId === "five-alive") {
      this.startFiveAlive(room);
      return;
    }
    if (this.isEkGame(room.gameId)) {
      this.startExplodingKittens(room);
      return;
    }
    if (room.gameId === "spot-it") {
      this.startSpotIt(room);
      return;
    }
    if (room.gameId === "tic-tac-toe") {
      this.startTicTacToe(room);
      return;
    }
    if (room.gameId === "connect-4") {
      this.startConnect4(room);
      return;
    }
    if (room.gameId === "battleship") {
      this.startBattleship(room);
      return;
    }

    const deals = assignMafiaCityRoles(room.players.length, room.settings);
    const bullets = bulletsForLobby(room.players.length, room.settings);
    room.players.forEach((p, i) => {
      const deal = deals[i]!;
      p.role = deal.role;
      p.fakeRole = deal.fakeRole;
      p.jugglerUsed = false;
      p.poisoned = false;
      p.alive = true;
      p.ready = false;
      p.afkCount = 0;
      p.blackmailed = false;
      p.bulletsLeft =
        effectiveRole(p) === "vigilante" ? bullets : undefined;
      this.leaveMafiaRooms(p, room.id);
      this.joinMafiaRoom(p, room.id);
    });
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    room.votes = {};
    room.nightActions = [];
    room.detectiveByPlayer = {};
    room.afkWarnedPlayerIds = [];
    room.chronicle = [];
    room.announcement = null;
    room.mafiaNightIntel = {};
    room.dayIntelByPlayer = {};
    room.daySubPhase = null;
    room.afkGraceEndsAt = null;
    room.afkGracePlayerId = null;
    log(room, "The city goes dark. Roles have been sealed.");
    this.setPhase(room, "reveal", REVEAL_SECONDS);

    for (const p of room.players) {
      if (!p.socketId || !p.role) continue;
      const displayRole =
        p.role === "drunk" && p.fakeRole ? p.fakeRole : p.role;
      const meta = ROLE_META[displayRole];
      this.io.to(p.socketId).emit("role:reveal", {
        role: displayRole,
        faction: meta.faction,
        ability: meta.ability,
      });
    }
    this.emitRoom(room);
  }

  private startFiveAlive(room: Room) {
    // Reset all Mafia-City-specific round state.
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    room.votes = {};
    room.nightActions = [];
    room.detectiveByPlayer = {};
    room.afkWarnedPlayerIds = [];
    room.fiveAlive = {
      drawDeck: buildFiveAliveDeck(),
      discardPile: [],
      centerPile: [],
      handsByPlayerId: {},
      runningTotal: 0,
      direction: 1,
      turnPlayerId: null,
      skipNext: false,
      pendingDrawCount: 0,
      bombAwaitingPlayerId: null,
      bombActorId: null,
      bombResponderIds: [],
      repeatTurnForPlayerId: null,
      shuffleRedealKeepTotal: true,
      dealSeq: 0,
      dealKind: null,
      dealBanner: null,
      dealSteps: [],
      pendingTurnAfterDeal: null,
      dealTimer: null,
    };

    const five = room.fiveAlive;
    if (!five) return;

    // Initialize lives and clear Mafia room voice/channel membership.
    for (const p of room.players) {
      p.role = undefined;
      p.bulletsLeft = undefined;
      p.blackmailed = false;
      p.lives = 5;
      p.alive = true;
      p.ready = false;
      p.afkCount = 0;
      this.leaveMafiaRooms(p, room.id);
    }

    const drawFromDeck = (count: number) => {
      const out: FiveAliveCardInstance[] = [];
      while (out.length < count) {
        replenishDrawPile(five, buildFiveAliveDeck);
        const drawn = five.drawDeck.pop();
        if (drawn) out.push(drawn);
      }
      return out;
    };

    // Deal initial hands.
    for (const p of room.players) {
      five.handsByPlayerId[p.id] = drawFromDeck(FIVE_ALIVE_HAND_SIZE);
    }

    // Turn order: random living seat starts the match.
    const living = room.players.filter((p) => (p.lives ?? 0) > 0);
    const first =
      living.length > 0
        ? living[Math.floor(Math.random() * living.length)]
        : undefined;
    five.turnPlayerId = first?.id ?? null;

    log(room, "5 Alive begins: keep the running total at or below 21.");
    this.beginFiveAliveDealing(
      room,
      "initial",
      "5 Alive — dealing hands…",
      five.turnPlayerId
    );
  }

  private isEkGame(gameId: string): boolean {
    return gameId === "exploding-kittens" || gameId === "detonation-cats";
  }

  private ekPlayerRefs(room: Room) {
    return room.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
    }));
  }

  private applyEkResult(room: Room, result: import("@/lib/games/exploding-kittens/state").EkActionResult) {
    for (const line of result.logs) {
      room.logs.push(newEkLog(line));
    }
    const ek = room.explodingKittens;
    if (result.gameOver && ek?.winnerId) {
      room.boardWinnerId = ek.winnerId;
      const winner = room.players.find((p) => p.id === ek.winnerId);
      log(room, `${winner?.name ?? "Someone"} wins Exploding Kittens!`);
      this.setPhase(room, "gameover", null);
      this.emitRoom(room);
      return true;
    }
    this.setPhase(room, result.phase ?? "ek_turn", room.settings.daySeconds);
    this.scheduleBots(room);
    this.emitRoom(room);
    return false;
  }

  private scheduleEkNopeResolve(room: Room) {
    const ek = room.explodingKittens;
    if (!ek?.nopeWindowEndsAt) return;
    const wait = Math.max(50, ek.nopeWindowEndsAt - Date.now() + 50);
    this.delayBot(room, wait, () => {
      if (room.paused || !this.isEkGame(room.gameId)) return;
      const state = room.explodingKittens;
      if (!state?.nopeWindowEndsAt || Date.now() < state.nopeWindowEndsAt) return;
      const result = ekResolveNopeWindow(state, this.ekPlayerRefs(room));
      this.applyEkResult(room, result);
    });
  }

  private startExplodingKittens(room: Room) {
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    room.votes = {};
    room.nightActions = [];
    room.detectiveByPlayer = {};
    room.afkWarnedPlayerIds = [];
    room.boardWinnerId = null;
    room.boardDraw = false;

    for (const p of room.players) {
      p.role = undefined;
      p.bulletsLeft = undefined;
      p.blackmailed = false;
      p.lives = undefined;
      p.alive = true;
      p.ready = false;
      p.afkCount = 0;
      this.leaveMafiaRooms(p, room.id);
    }

    room.explodingKittens = createExplodingKittensState(this.ekPlayerRefs(room));

    log(room, "Exploding Kittens begins — don't draw the kitten.");
    this.setPhase(room, "ek_turn", room.settings.daySeconds);
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private ekMaybeWinRoom(room: Room): boolean {
    const ek = room.explodingKittens;
    if (!ek) return false;
    const winnerId = ekMaybeWin(this.ekPlayerRefs(room), ek.turnOrder);
    if (!winnerId) return false;
    ek.winnerId = winnerId;
    room.boardWinnerId = winnerId;
    const winner = room.players.find((p) => p.id === winnerId);
    log(room, `${winner?.name ?? "Someone"} wins Exploding Kittens!`);
    this.setPhase(room, "gameover", null);
    this.emitRoom(room);
    return true;
  }

  submitEkPlayCards(roomId: string, playerId: string, cardIds: string[]) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_turn") return;
    const ek = room.explodingKittens;
    if (!ek || ek.turnPlayerId !== playerId || ek.subPhase !== "play") return;
    if (ek.nopeWindowEndsAt) return;
    const actor = room.players.find((p) => p.id === playerId);
    if (!actor?.alive) return;

    const hand = ek.handsByPlayerId[playerId] ?? [];
    const validated = validatePlayCards(hand, cardIds);
    if (!validated.ok) return;

    const { taken, remaining } = takeCardsFromHand(hand, cardIds);
    ek.handsByPlayerId[playerId] = remaining;

    const result = ekPlayCards(ek, this.ekPlayerRefs(room), playerId, taken);
    if (this.applyEkResult(room, result)) return;
    if (ek.nopeWindowEndsAt) {
      this.scheduleEkNopeResolve(room);
    }
  }

  submitEkEndTurn(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_turn") return;
    const ek = room.explodingKittens;
    if (!ek || ek.turnPlayerId !== playerId) return;
    if (ek.nopeWindowEndsAt) return;

    if (ek.subPhase === "draw") {
      this.submitEkDraw(roomId, playerId);
      return;
    }
    ekBeginDrawPhase(ek, playerId);
    this.emitRoom(room);
    this.scheduleBots(room);
  }

  submitEkDraw(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_turn") return;
    const ek = room.explodingKittens;
    if (!ek || ek.turnPlayerId !== playerId || ek.subPhase !== "draw") return;
    if (ek.nopeWindowEndsAt) return;

    const result = ekDraw(ek, this.ekPlayerRefs(room), playerId);
    if (this.applyEkResult(room, result)) return;
    if (!result.gameOver) {
      this.ekMaybeWinRoom(room);
    }
  }

  submitEkNope(roomId: string, playerId: string, cardId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    const ek = room.explodingKittens;
    if (!ek?.nopeWindowEndsAt) return;

    const result = ekPlayNope(ek, playerId, cardId);
    if (!result) return;
    for (const line of result.logs) {
      room.logs.push(newEkLog(line));
    }
    this.scheduleEkNopeResolve(room);
    this.emitRoom(room);
  }

  submitEkPlaceDefuse(roomId: string, playerId: string, deckIndex: number) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_defuse") return;
    const ek = room.explodingKittens;
    if (!ek || ek.defusePlayerId !== playerId) return;

    const result = ekPlaceDefuse(ek, this.ekPlayerRefs(room), playerId, deckIndex);
    if (this.applyEkResult(room, result)) return;
    this.ekMaybeWinRoom(room);
  }

  submitEkPickDiscard(
    roomId: string,
    playerId: string,
    discardIndex: number
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_pick_discard") return;
    const ek = room.explodingKittens;
    if (!ek || ek.pickDiscardPlayerId !== playerId) return;

    const result = ekPickDiscard(ek, this.ekPlayerRefs(room), playerId, discardIndex);
    this.applyEkResult(room, result);
  }

  submitEkStealTarget(roomId: string, playerId: string, targetId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_steal") return;
    const ek = room.explodingKittens;
    if (!ek || ek.stealActorId !== playerId) return;
    const target = room.players.find((p) => p.id === targetId && p.alive);
    if (!target || target.id === playerId) return;
    const targetHand = ek.handsByPlayerId[targetId] ?? [];
    if (targetHand.length === 0) return;

    const result = ekStealTarget(ek, this.ekPlayerRefs(room), playerId, targetId);
    this.applyEkResult(room, result);
  }

  submitEkFavorTarget(roomId: string, playerId: string, targetId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_favor") return;
    const ek = room.explodingKittens;
    if (!ek || ek.favorFromId !== playerId) return;
    const target = room.players.find((p) => p.id === targetId && p.alive);
    if (!target || target.id === playerId) return;

    const result = ekFavorTarget(ek, playerId, targetId);
    this.applyEkResult(room, result);
  }

  submitEkFavorGive(roomId: string, playerId: string, cardId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_favor") return;
    const ek = room.explodingKittens;
    if (!ek || ek.favorToId !== playerId) return;

    const result = ekFavorGive(ek, this.ekPlayerRefs(room), playerId, cardId);
    this.applyEkResult(room, result);
  }

  submitEkTripleDeclare(
    roomId: string,
    playerId: string,
    targetId: string,
    cardType: import("@/lib/games/exploding-kittens/cards").EkCardType
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    if (room.phase !== "ek_triple") return;
    const ek = room.explodingKittens;
    if (!ek || ek.tripleActorId !== playerId) return;
    const target = room.players.find((p) => p.id === targetId && p.alive);
    if (!target || target.id === playerId) return;

    const result = ekTripleDeclare(
      ek,
      this.ekPlayerRefs(room),
      playerId,
      targetId,
      cardType
    );
    this.applyEkResult(room, result);
  }

  private onTimeoutExplodingKittens(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || !this.isEkGame(room.gameId)) return;
    const ek = room.explodingKittens;
    if (!ek) return;

    if (ek.nopeWindowEndsAt && Date.now() >= ek.nopeWindowEndsAt) {
      const result = ekResolveNopeWindow(ek, this.ekPlayerRefs(room));
      if (this.applyEkResult(room, result)) return;
    }

    if (room.phase === "ek_turn" && ek.turnPlayerId) {
      if (ek.nopeWindowEndsAt) return;
      if (ek.subPhase === "draw") {
        log(
          room,
          `${room.players.find((p) => p.id === ek.turnPlayerId)?.name ?? "Player"} timed out — auto draw.`
        );
        this.submitEkDraw(roomId, ek.turnPlayerId);
        return;
      }
      this.submitEkEndTurn(roomId, ek.turnPlayerId);
      return;
    }
    if (room.phase === "ek_defuse" && ek.defusePlayerId) {
      this.submitEkPlaceDefuse(
        roomId,
        ek.defusePlayerId,
        ekRandomDefuseIndex(ek.drawDeck.length)
      );
      return;
    }
    if (room.phase === "ek_pick_discard" && ek.pickDiscardPlayerId) {
      this.submitEkPickDiscard(
        roomId,
        ek.pickDiscardPlayerId,
        pickBotDiscardIndex(ek.discardPile.length)
      );
      return;
    }
    if (room.phase === "ek_steal" && ek.stealActorId) {
      const counts: Record<string, number> = {};
      for (const [pid, hand] of Object.entries(ek.handsByPlayerId)) {
        counts[pid] = hand.length;
      }
      const target = pickBotStealTarget(
        room.players.filter((p) => p.alive).map((p) => p.id),
        ek.stealActorId,
        counts
      );
      if (target) {
        this.submitEkStealTarget(roomId, ek.stealActorId, target);
      }
      return;
    }
    if (room.phase === "ek_favor" && ek.favorToId) {
      const hand = ek.handsByPlayerId[ek.favorToId] ?? [];
      const cardId = pickBotFavorCard(hand);
      if (cardId) {
        this.submitEkFavorGive(roomId, ek.favorToId, cardId);
      }
      return;
    }
    if (room.phase === "ek_favor" && ek.favorFromId && ek.pendingAction?.kind === "favor_pick_target") {
      const others = room.players.filter(
        (p) => p.alive && p.id !== ek.favorFromId
      );
      const target = others[0];
      if (target) {
        this.submitEkFavorTarget(roomId, ek.favorFromId, target.id);
      }
      return;
    }
    if (room.phase === "ek_triple" && ek.tripleActorId) {
      const others = room.players.filter(
        (p) => p.alive && p.id !== ek.tripleActorId
      );
      const target = others[0];
      if (target) {
        this.submitEkTripleDeclare(
          roomId,
          ek.tripleActorId,
          target.id,
          pickBotTripleType(ek.handsByPlayerId[ek.tripleActorId] ?? []) ?? "skip"
        );
      }
    }
  }

  private startNight(room: Room) {
    room.nightActions = [];
    room.votes = {};
    room.detectiveByPlayer = {};
    room.dayIntelByPlayer = {};
    room.daySubPhase = null;
    room.mafiaNightIntel = {};
    room.afkGraceEndsAt = null;
    room.afkGracePlayerId = null;
    this.clearVoiceChannels(room, "town", "graveyard");
    log(room, `Night ${room.cycle} falls over the city.`);
    this.setPhase(room, "night", room.settings.nightSeconds);
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private startDay(room: Room) {
    this.clearVoiceChannels(room, "mafia");
    room.votes = {};
    room.phase = "day";
    room.paused = false;
    room.pausedRemainingMs = null;

    const local = room.gameId === "mafia-city" && !!room.settings.localMode;
    if (local) {
      log(room, `Day ${room.cycle} — local vote (no discussion).`);
      this.startDayVoteSubphase(room, room.settings.daySeconds);
      return;
    }

    room.daySubPhase = "discussion";
    const discussionSeconds = Math.max(
      DAY_VOTE_SECONDS,
      room.settings.daySeconds - DAY_VOTE_SECONDS
    );
    log(room, `Day ${room.cycle} — discuss, accuse, survive.`);
    this.setAnnouncement(
      room,
      "info",
      `Day ${room.cycle} discussion`,
      "Town voice is open. Voting starts in the final 15 seconds."
    );
    room.phaseEndsAt = Date.now() + discussionSeconds * 1000;
    this.schedule(room);
    this.emitRoom(room);
  }

  private maybeWin(room: Room): boolean {
    if (room.gameId === "five-alive") {
      return this.fiveAliveMaybeWin(room);
    }
    const winner = winCheck(room.players);
    if (!winner) return false;
    room.winner = winner;
    this.setPhase(room, "gameover", null);
    const recap = room.players.map((p) =>
      this.toPublicPlayer(room, p, "", true)
    );
    this.io.to(room.id).emit("game:over", { winner, recap });
    this.emitRoom(room);
    return true;
  }

  private playersNeedingNightAction(room: Room): Player[] {
    return living(room).filter((p) => {
      const type = nightActionForPlayer(p) as NightActionType | null;
      if (!type) return false;
      if (type === "vigilante_shoot" && (p.bulletsLeft ?? 0) <= 0) return false;
      if (room.nightActions.some((a) => a.playerId === p.id)) return false;
      return true;
    });
  }

  private playersNeedingVote(room: Room): Player[] {
    return dayVoteEligible(room).filter((p) => !room.votes[p.id]);
  }

  private markMafiaAfkOnTimeout(room: Room) {
    if (room.gameId !== "mafia-city") return;
    if (room.phase === "night") {
      for (const player of this.playersNeedingNightAction(room)) {
        if (player.isBot) continue;
        player.afkCount = 1;
      }
      return;
    }
    if (room.phase === "day" && room.daySubPhase === "vote") {
      for (const player of this.playersNeedingVote(room)) {
        if (player.isBot) continue;
        player.afkCount = 1;
      }
    }
  }

  private maybePromoteMafiaAfterBossDeath(room: Room, deadPlayerId: string) {
    const promotion = promoteMafiaAfterBossDeath(room.players, deadPlayerId);
    if (!promotion) return;
    const { promoted, fromRole } = promotion;
    const fromLabel = ROLE_META[fromRole].label;
    this.addChronicle(
      room,
      room.phase === "night" ? "night" : "day",
      `Boss promoted ${promoted.name} from ${fromLabel} to Goon.`
    );
    const detail = `${promoted.name} was promoted from ${fromLabel} to Mafia Goon.`;
    for (const p of room.players) {
      if (!p.alive || !isMafiaRole(p.role) || !p.socketId) continue;
      this.emitNightPowerResult(p.socketId, {
        tone: "info",
        title: "Mafia succession",
        detail,
      });
    }
    this.joinMafiaRoom(promoted, room.id);
  }

  private handlePhaseTimeoutAfk(room: Room) {
    this.markMafiaAfkOnTimeout(room);
  }

  private updateMafiaNightIntel(room: Room) {
    const intel: MafiaNightIntel = {};
    for (const action of room.nightActions) {
      const actor = room.players.find((p) => p.id === action.playerId);
      const target = room.players.find((p) => p.id === action.targetId);
      if (!actor || !target) continue;
      if (action.type === "blackmail") {
        intel.blackmailTargetId = target.id;
        intel.blackmailTargetName = target.name;
      }
      if (action.type === "poison") {
        intel.poisonTargetId = target.id;
        intel.poisonTargetName = target.name;
      }
      if (action.type === "mafia_kill" && actor.role === "mafia_boss") {
        intel.bossTargetId = target.id;
        intel.bossTargetName = target.name;
      }
      if (action.type === "mafia_kill" && actor.role === "mafia_goon") {
        intel.goonTargetId = target.id;
        intel.goonTargetName = target.name;
      }
    }
    room.mafiaNightIntel = intel;
  }

  private byActorRolePhrase(
    room: Room,
    actorId: string | null | undefined,
    actorRole?: string | null
  ): string {
    if (!actorId) return "";
    const actor = room.players.find((p) => p.id === actorId);
    if (!actor) return "";
    const role =
      (actorRole && actorRole in ROLE_META
        ? ROLE_META[actorRole as keyof typeof ROLE_META].label
        : actor.role
          ? ROLE_META[actor.role].label
          : null) ?? "Unknown";
    return ` by ${actor.name} with ${role} role`;
  }

  private emitNightPowerResult(
    socketId: string,
    payload: {
      tone: PhaseAnnouncement["tone"];
      title: string;
      detail: string;
      id?: string;
    }
  ) {
    this.io.to(socketId).emit("night:powerResult", {
      id: payload.id ?? randomUUID(),
      tone: payload.tone,
      title: payload.title,
      detail: payload.detail,
    });
  }

  private emitPersonalNightPowerResults(
    room: Room,
    result: ReturnType<typeof resolveNight>
  ) {
    const cycle = room.cycle;
    const nightLabel = `Night ${cycle}`;

    if (result.detective) {
      const target = room.players.find((p) => p.id === result.detective!.targetId);
      const inv = room.players.find((p) => p.id === result.detective!.investigatorId);
      if (inv?.socketId && target) {
        if (result.detective.interrupted) {
          this.emitNightPowerResult(inv.socketId, {
            tone: "bad",
            title: `${nightLabel} — investigation interrupted`,
            detail: "Poison blocked your investigation. You learned nothing.",
          });
        } else {
          this.io.to(inv.socketId).emit("detective:result", {
            targetId: result.detective.targetId,
            targetName: target.name,
            faction: result.detective.faction,
            cycle,
          });
        }
      }
    }

    if (result.poisonClearedTargetId) {
      const cleared = room.players.find(
        (p) => p.id === result.poisonClearedTargetId
      );
      const doctor =
        (result.doctorId
          ? room.players.find((p) => p.id === result.doctorId)
          : null) ??
        room.players.find((p) => p.role === "doctor");
      if (doctor?.socketId && cleared) {
        this.emitNightPowerResult(doctor.socketId, {
          tone: "good",
          title: `${nightLabel} — poison cleared`,
          detail: `You protected ${cleared.name} and cleared poison.`,
        });
      }
    }

    const poisonAction = room.nightActions.find((a) => a.type === "poison");
    if (poisonAction) {
      const poisoner = room.players.find((p) => p.id === poisonAction.playerId);
      const poisonLog = result.powerLogs.find(
        (pl) => pl.type === "poison" && pl.actorId === poisoner?.id
      );
      if (poisoner?.socketId && poisonLog) {
        const text = poisonLog.clause ?? poisonLog.outcome;
        this.emitNightPowerResult(poisoner.socketId, {
          tone: /failed/i.test(text) ? "info" : "good",
          title: `${nightLabel} — poison`,
          detail: text.charAt(0).toUpperCase() + text.slice(1) + ".",
        });
      }
    }

    const doctorAction = room.nightActions.find((a) => a.type === "doctor_protect");
    if (doctorAction) {
      const doctor =
        (result.doctorId
          ? room.players.find((p) => p.id === result.doctorId)
          : null) ?? room.players.find((p) => p.id === doctorAction.playerId);
      const patient = room.players.find((p) => p.id === doctorAction.targetId);
      if (doctor?.socketId && patient) {
        if (result.doctorSavedTargetId === patient.id) {
          this.emitNightPowerResult(doctor.socketId, {
            tone: "good",
            title: `${nightLabel} — patient saved`,
            detail: `${patient.name} survived the night under your care.`,
          });
        } else {
          this.emitNightPowerResult(doctor.socketId, {
            tone: "info",
            title: `${nightLabel} — quiet watch`,
            detail: `No attack reached ${patient.name}.`,
          });
        }
      }
    }

    if (result.blackmailerId && result.silencedId) {
      const blackmailer = room.players.find((p) => p.id === result.blackmailerId);
      const silenced = room.players.find((p) => p.id === result.silencedId);
      if (blackmailer?.socketId && silenced) {
        this.emitNightPowerResult(blackmailer.socketId, {
          tone: "good",
          title: `${nightLabel} — blackmail`,
          detail: `You silenced ${silenced.name} for the day.`,
        });
      }
    }

    const vigAction = room.nightActions.find((a) => a.type === "vigilante_shoot");
    if (vigAction) {
      const vig = room.players.find((p) => p.id === vigAction.playerId);
      if (vig?.socketId && vigAction.targetId === SKIP_VOTE_ID) {
        this.emitNightPowerResult(vig.socketId, {
          tone: "info",
          title: `${nightLabel} — no shot`,
          detail: "You held your fire tonight.",
        });
      }
      const target = room.players.find((p) => p.id === vigAction.targetId);
      if (vig?.socketId && target) {
        const kill = result.deaths.find(
          (d) => d.actorId === vig.id && d.actorRole === "vigilante"
        );
        const selfDeath = result.deaths.find((d) => d.playerId === vig.id);
        if (kill) {
          this.emitNightPowerResult(vig.socketId, {
            tone: "bad",
            title: `${nightLabel} — shot landed`,
            detail: `You eliminated ${target.name}.`,
          });
        } else if (selfDeath?.reason.toLowerCase().includes("attacking")) {
          this.emitNightPowerResult(vig.socketId, {
            tone: "bad",
            title: `${nightLabel} — ambushed`,
            detail: `You died attacking a bodyguard protecting ${target.name}.`,
          });
        } else if (result.doctorSavedTargetId === target.id) {
          this.emitNightPowerResult(vig.socketId, {
            tone: "info",
            title: `${nightLabel} — shot blocked`,
            detail: `${target.name} was protected — your bullet failed.`,
          });
        } else if (
          result.deaths.some(
            (d) =>
              d.actorId === vig.id &&
              d.reason.toLowerCase().includes("intercepting")
          )
        ) {
          this.emitNightPowerResult(vig.socketId, {
            tone: "info",
            title: `${nightLabel} — intercepted`,
            detail: `A bodyguard intercepted your shot on ${target.name}.`,
          });
        }
      }
    }

    const bgAction = room.nightActions.find((a) => a.type === "bodyguard_protect");
    if (bgAction) {
      const bg = room.players.find((p) => p.id === bgAction.playerId);
      const charge = room.players.find((p) => p.id === bgAction.targetId);
      const intercepted = result.deaths.find(
        (d) =>
          d.playerId === bg?.id &&
          d.reason.toLowerCase().includes("intercepting")
      );
      if (bg?.socketId && charge && intercepted) {
        this.emitNightPowerResult(bg.socketId, {
          tone: "bad",
          title: `${nightLabel} — last stand`,
          detail: `You died protecting ${charge.name}.`,
        });
      }
    }

    const intel = room.mafiaNightIntel;
    const intelParts: string[] = [];
    if (intel.bossTargetName) {
      intelParts.push(`Boss marked ${intel.bossTargetName}`);
    }
    if (intel.goonTargetName && intel.goonTargetName !== intel.bossTargetName) {
      intelParts.push(`Goon marked ${intel.goonTargetName}`);
    }
    if (intel.blackmailTargetName) {
      intelParts.push(`Blackmail on ${intel.blackmailTargetName}`);
    }
    if (intel.poisonTargetName) {
      intelParts.push(`Poison on ${intel.poisonTargetName}`);
    }
    if (intelParts.length > 0) {
      for (const p of room.players) {
        if (!p.alive || !p.socketId || !isMafiaRole(p.role)) continue;
        this.emitNightPowerResult(p.socketId, {
          tone: "info",
          title: `${nightLabel} — mafia intel`,
          detail: `${intelParts.join(". ")}.`,
        });
      }
    }
  }

  private resolveNightPhase(room: Room) {
    this.handlePhaseTimeoutAfk(room);
    const result = resolveNight(room.players, room.nightActions);

    if (result.powerLogs.length > 0) {
      const clauses = result.powerLogs.map((pl) => {
        const actor = room.players.find((p) => p.id === pl.actorId);
        const name = actor?.name ?? "Someone";
        return `${name} ${pl.clause ?? pl.outcome}`;
      });
      this.addChronicle(room, "night", clauses.join(", ") + ".");
    }

    if (result.detective) {
      const target = room.players.find((p) => p.id === result.detective!.targetId);
      const inv = room.players.find(
        (p) => p.id === result.detective!.investigatorId
      );
      if (inv && target) {
        if (result.detective.interrupted) {
          room.dayIntelByPlayer[inv.id] = {
            kind: "detective",
            title: `Night ${room.cycle} — investigation interrupted`,
            detail: "Your investigation was blocked — you learned nothing.",
            cycle: room.cycle,
            at: Date.now(),
          };
        } else {
          room.detectiveByPlayer[inv.id] = {
            targetId: result.detective.targetId,
            faction: result.detective.faction,
          };
          room.dayIntelByPlayer[inv.id] = {
            kind: "detective",
            title: `Night ${room.cycle} — investigation`,
            detail: `${target.name} is ${result.detective.faction}.`,
            cycle: room.cycle,
            at: Date.now(),
          };
        }
      }
    }

    this.emitPersonalNightPowerResults(room, result);

    if (result.silencedId) {
      const p = room.players.find((x) => x.id === result.silencedId);
      if (p) {
        log(room, `${p.name} has been blackmailed into silence.`);
      }
    }

    const deadBossIds: string[] = [];

    if (result.deaths.length === 0) {
      log(room, "The night passes without blood.");
      if (
        !result.doctorSavedTargetId &&
        !result.detective &&
        !result.silencedId &&
        result.powerLogs.length === 0
      ) {
        this.addChronicle(room, "night", "The night passed quietly.");
      }
      this.setAnnouncement(
        room,
        "good",
        "Quiet night",
        "No one was eliminated overnight."
      );
    } else {
      const names = result.deaths
        .map((d) => room.players.find((x) => x.id === d.playerId)?.name)
        .filter((n): n is string => Boolean(n));
      const nameList =
        names.length === 0
          ? "Someone"
          : names.length === 1
            ? names[0]
            : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
      const verb = names.length === 1 || names.length === 0 ? "was" : "were";
      log(room, `${nameList} ${verb} eliminated overnight.`);
      for (const d of result.deaths) {
        const p = room.players.find((x) => x.id === d.playerId);
        if (p) {
          if (p.role === "mafia_boss") deadBossIds.push(p.id);
          this.leaveMafiaRooms(p, room.id);
          this.removeFromAllVoice(room, p.id);
        }
      }
      this.addChronicle(
        room,
        "night",
        `${nameList} ${verb} eliminated overnight.`
      );
      this.setAnnouncement(
        room,
        "bad",
        "Night results",
        `${nameList} ${verb} eliminated overnight.`
      );
    }

    for (const bossId of deadBossIds) {
      this.maybePromoteMafiaAfterBossDeath(room, bossId);
    }

    for (const p of room.players) {
      if (!p.alive) this.leaveMafiaRooms(p, room.id);
    }
  }

  private resolveDayPhase(room: Room) {
    this.handlePhaseTimeoutAfk(room);
    const lynchedId = tallyLynch(room.players, room.votes);
    if (lynchedId === SKIP_VOTE_ID) {
      log(room, "The city votes to skip.");
      this.addChronicle(room, "day", "No one was voted out — vote skipped.");
      this.setAnnouncement(
        room,
        "info",
        "Vote result",
        "No one was voted out."
      );
      return;
    }
    if (!lynchedId) {
      log(room, "The vote ties. The city lets the day die without an elimination.");
      this.addChronicle(room, "day", "Vote tied — no one was voted out.");
      this.setAnnouncement(
        room,
        "info",
        "Tied vote",
        "No one held the most votes alone."
      );
      return;
    }
    const target = room.players.find((p) => p.id === lynchedId);
    if (!target || !target.alive) return;
    const wasBoss = target.role === "mafia_boss";
    target.alive = false;
    log(room, `The city voted out ${target.name}.`);
    this.addChronicle(room, "day", `${target.name} was voted out.`);
    this.setAnnouncement(
      room,
      "bad",
      "Vote result",
      `${target.name} was eliminated by vote.`
    );
    this.leaveMafiaRooms(target, room.id);
    this.removeFromAllVoice(room, target.id);
    if (wasBoss) {
      this.maybePromoteMafiaAfterBossDeath(room, target.id);
    }
  }

  private onTimeout(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused) return;
    if (room.gameId === "five-alive") {
      this.onTimeoutFiveAlive(roomId);
      return;
    }
    if (this.isEkGame(room.gameId)) {
      this.onTimeoutExplodingKittens(roomId);
      return;
    }
    if (room.gameId === "tic-tac-toe" && room.phase === "ttt_play" && room.ttt) {
      const turnId = room.ttt.turnPlayerId;
      const bot = room.players.find((p) => p.id === turnId);
      if (bot) {
        const cell = pickBotTttMove(room.ttt.board);
        if (cell != null) this.submitTttMove(room.id, turnId, cell);
      }
      return;
    }
    if (room.gameId === "connect-4" && room.phase === "connect4_play" && room.connect4) {
      const turnId = room.connect4.turnPlayerId;
      const col = pickBotC4Column(room.connect4.board);
      if (col != null) this.submitConnect4Drop(room.id, turnId, col);
      return;
    }
    if (room.gameId === "battleship") {
      this.onTimeoutBattleship(roomId);
      return;
    }
    if (room.phase === "reveal") {
      this.startNight(room);
      return;
    }
    if (room.phase === "night") {
      this.resolveNightPhase(room);
      if (this.maybeWin(room)) return;
      this.startDay(room);
      return;
    }
    if (room.phase === "day") {
      if (room.daySubPhase === "discussion") {
        this.startDayVoteSubphase(room);
        return;
      }
      this.finishDayPhase(room);
    }
  }

  private fiveAliveMaybeWin(room: Room): boolean {
    const five = room.fiveAlive;
    if (!five) return false;
    const livingIds = room.players
      .filter((p) => (p.lives ?? 0) > 0 && p.alive)
      .map((p) => p.id);
    if (livingIds.length > 1) return false;

    room.winner = "town";
    this.setPhase(room, "gameover", null);
    const recap = room.players.map((p) =>
      this.toPublicPlayer(room, p, "", true)
    );
    this.io.to(room.id).emit("game:over", { winner: "town", recap });
    this.emitRoom(room);
    return true;
  }

  private fiveAliveSeats(room: Room): FiveAliveSeat[] {
    return room.players.map((p) => ({
      id: p.id,
      name: p.name,
      alive: p.alive,
      lives: p.lives ?? 0,
    }));
  }

  private fiveAliveLivingPlayerIds(room: Room): string[] {
    return room.players
      .filter((p) => p.alive && (p.lives ?? 0) > 0)
      .map((p) => p.id);
  }

  private fiveAliveClearDealTimer(five: NonNullable<Room["fiveAlive"]>) {
    if (five.dealTimer) {
      clearTimeout(five.dealTimer);
      five.dealTimer = null;
    }
  }

  private fiveAliveCollectAllCardsToDeck(
    five: NonNullable<Room["fiveAlive"]>
  ) {
    const pool: FiveAliveCardInstance[] = [];
    for (const hand of Object.values(five.handsByPlayerId)) {
      pool.push(...hand);
    }
    pool.push(...five.centerPile, ...five.discardPile);
    five.centerPile = [];
    five.discardPile = [];
    five.handsByPlayerId = {};
    five.drawDeck = shuffle([...five.drawDeck, ...pool]);
  }

  private fiveAliveDealToAllLiving(room: Room) {
    const five = room.fiveAlive;
    if (!five) return;
    for (const playerId of this.fiveAliveLivingPlayerIds(room)) {
      five.handsByPlayerId[playerId] = [];
      drawIntoHand(five, playerId, FIVE_ALIVE_HAND_SIZE, buildFiveAliveDeck);
    }
  }

  private beginFiveAliveDealing(
    room: Room,
    kind: FiveAliveDealKind,
    banner: string | null,
    pendingTurnPlayerId: string | null,
    explicitSteps?: import("@/lib/games/5-alive/dealing").FiveAliveDealStep[]
  ) {
    const five = room.fiveAlive;
    if (!five) return;

    this.fiveAliveClearDealTimer(five);

    const playerIds = this.fiveAliveLivingPlayerIds(room);
    five.dealSeq += 1;
    five.dealKind = kind;
    five.dealBanner = banner;
    five.dealSteps =
      explicitSteps ?? buildDealStepsFromHands(playerIds, five.handsByPlayerId);
    five.pendingTurnAfterDeal = pendingTurnPlayerId;

    this.setPhase(room, "fivealive_dealing", null);
    this.clearBotTimers(room);
    this.emitRoom(room);

    const showBanner = !!banner;
    const duration = dealAnimationDurationMs(five.dealSteps.length, showBanner);
    five.dealTimer = setTimeout(
      () => this.completeFiveAliveDealing(room.id),
      duration
    );
  }

  private completeFiveAliveDealing(roomId: string) {
    const room = this.getRoom(roomId);
    const five = room?.fiveAlive;
    if (!room || !five || room.phase !== "fivealive_dealing") return;

    this.fiveAliveClearDealTimer(five);

    if (five.pendingTurnAfterDeal) {
      five.turnPlayerId = five.pendingTurnAfterDeal;
    }
    five.pendingTurnAfterDeal = null;
    five.dealKind = null;
    five.dealBanner = null;
    five.dealSteps = [];

    this.setPhase(room, "fivealive_turn", room.settings.daySeconds);
    if (!this.fiveAliveAutoPassIfStuck(room)) {
      this.scheduleBots(room);
    }
    this.emitRoom(room);
  }

  private fiveAliveResolveTurnAfter(
    room: Room,
    fromPlayerId: string
  ): string | null {
    const five = room.fiveAlive;
    if (!five) return null;

    if (five.repeatTurnForPlayerId) {
      return five.repeatTurnForPlayerId;
    }

    const nextId = this.fiveAliveNextNormalPlayerId(room, fromPlayerId);
    if (!nextId) return null;

    if (five.pendingDrawCount > 0) {
      this.fiveAliveDrawIntoHand(room, nextId, five.pendingDrawCount);
      log(
        room,
        `${room.players.find((p) => p.id === nextId)?.name ?? "Someone"} draws ${five.pendingDrawCount}.`
      );
      five.pendingDrawCount = 0;
      return this.fiveAliveNextNormalPlayerId(room, nextId);
    }

    return nextId;
  }

  private fiveAlivePenalizeEmptyHand(room: Room, playerId: string) {
    const five = room.fiveAlive;
    if (!five) return;
    const hand = five.handsByPlayerId[playerId] ?? [];
    if (hand.length > 0) return;

    const actor = room.players.find((p) => p.id === playerId);
    const seats = this.fiveAliveSeats(room);

    if (actor && shouldPenalizeOnEmptyHand(seats, playerId)) {
      let penalized = 0;
      for (const p of room.players) {
        if (p.id === playerId) continue;
        if (!p.alive || (p.lives ?? 0) <= 0) continue;
        p.lives = Math.max(0, (p.lives ?? 0) - 1);
        p.alive = (p.lives ?? 0) > 0;
        penalized += 1;
      }
      if (penalized > 0) {
        log(
          room,
          `${actor.name} emptied their hand — all other players lose 1 life.`
        );
      }
    }
  }

  private fiveAliveResetRound(
    room: Room,
    banner: string,
    fromPlayerId: string,
    /** When true, `fromPlayerId` starts the next deal (round winner). */
    startWithFromPlayer = false
  ) {
    const five = room.fiveAlive;
    if (!five) return;

    five.runningTotal = 0;
    five.pendingDrawCount = 0;
    five.skipNext = false;
    five.repeatTurnForPlayerId = null;
    five.bombAwaitingPlayerId = null;
    five.bombActorId = null;
    five.bombResponderIds = [];

    this.fiveAliveCollectAllCardsToDeck(five);
    this.fiveAliveDealToAllLiving(room);

    const fromStillAlive = this.fiveAliveLivingPlayerIds(room).includes(
      fromPlayerId
    );
    const nextTurn =
      startWithFromPlayer && fromStillAlive
        ? fromPlayerId
        : this.fiveAliveResolveTurnAfter(room, fromPlayerId);
    if (!nextTurn) {
      this.fiveAliveMaybeWin(room);
      return;
    }

    five.repeatTurnForPlayerId = null;
    this.beginFiveAliveDealing(room, "round_reset", banner, nextTurn);
  }

  private fiveAliveDrawIntoHand(
    room: Room,
    playerId: string,
    count: number
  ) {
    const five = room.fiveAlive;
    if (!five || count <= 0) return;
    drawIntoHand(five, playerId, count, buildFiveAliveDeck);
  }

  private fiveAliveAfterEmptyHandRoundEnd(
    room: Room,
    playerId: string
  ): boolean {
    const five = room.fiveAlive;
    if (!five) return false;
    const hand = five.handsByPlayerId[playerId] ?? [];
    if (hand.length > 0) return false;

    this.fiveAlivePenalizeEmptyHand(room, playerId);
    if (this.fiveAliveMaybeWin(room)) return true;
    // Round winner (emptied hand) starts the next deal.
    this.fiveAliveResetRound(
      room,
      "Round complete — new hands dealt.",
      playerId,
      true
    );
    return true;
  }

  private fiveAliveClearCenterToDiscard(room: Room) {
    const five = room.fiveAlive;
    if (!five) return;
    clearCenterToDiscard(five);
  }

  private fiveAliveNextNormalPlayerId(
    room: Room,
    fromPlayerId: string
  ): string | null {
    const five = room.fiveAlive;
    if (!five) return null;
    const steps = 1 + (five.skipNext ? 1 : 0);
    five.skipNext = false;
    return nextLivingSeatId(
      this.fiveAliveSeats(room),
      fromPlayerId,
      five.direction,
      steps
    );
  }

  private fiveAliveAdvanceToNextTurn(room: Room, fromPlayerId: string) {
    const five = room.fiveAlive;
    if (!five) return;

    if (five.repeatTurnForPlayerId) {
      const repeatId = five.repeatTurnForPlayerId;
      five.repeatTurnForPlayerId = null;
      five.turnPlayerId = repeatId;
      five.bombAwaitingPlayerId = null;
      five.bombResponderIds = [];
      five.bombActorId = null;
      this.setPhase(room, "fivealive_turn", room.settings.daySeconds);
      if (!this.fiveAliveAutoPassIfStuck(room)) {
        this.scheduleBots(room);
        this.emitRoom(room);
      }
      return;
    }

    const nextId = this.fiveAliveNextNormalPlayerId(room, fromPlayerId);
    if (!nextId) {
      this.fiveAliveMaybeWin(room);
      return;
    }

    let turnPlayerId = nextId;

    // +1/+2: next player draws, then turn skips them to the following player.
    if (five.pendingDrawCount > 0) {
      this.fiveAliveDrawIntoHand(room, nextId, five.pendingDrawCount);
      log(
        room,
        `${room.players.find((p) => p.id === nextId)?.name ?? "Someone"} draws ${five.pendingDrawCount}.`
      );
      five.pendingDrawCount = 0;
      const afterDrawerId = this.fiveAliveNextNormalPlayerId(room, nextId);
      if (!afterDrawerId) {
        this.fiveAliveMaybeWin(room);
        return;
      }
      turnPlayerId = afterDrawerId;
    }

    five.turnPlayerId = turnPlayerId;
    five.bombAwaitingPlayerId = null;
    five.bombResponderIds = [];
    five.bombActorId = null;
    this.setPhase(room, "fivealive_turn", room.settings.daySeconds);
    if (!this.fiveAliveAutoPassIfStuck(room)) {
      this.scheduleBots(room);
      this.emitRoom(room);
    }
  }

  /** No legal play → lose 1 life and reset total (runs automatically). */
  private fiveAliveAutoPassIfStuck(room: Room): boolean {
    const five = room.fiveAlive;
    if (!five || room.phase !== "fivealive_turn" || !five.turnPlayerId) {
      return false;
    }
    const playerId = five.turnPlayerId;
    const hand = five.handsByPlayerId[playerId] ?? [];
    if (hand.length === 0 || handHasPlayableCard(hand, five.runningTotal)) {
      return false;
    }
    this.submitFiveAlivePlayCard(room.id, playerId, null, undefined, true);
    return true;
  }

  private fiveAliveStartBombResolution(room: Room, actorId: string) {
    const five = room.fiveAlive;
    if (!five) return;
    if (livingCount(this.fiveAliveSeats(room)) <= 1) {
      this.fiveAliveAdvanceToNextTurn(room, actorId);
      return;
    }

    const responders = bombResponderIds(
      this.fiveAliveSeats(room),
      actorId,
      five.direction
    );

    if (responders.length === 0) {
      this.fiveAliveAdvanceToNextTurn(room, actorId);
      return;
    }

    five.bombActorId = actorId;
    five.bombResponderIds = responders;
    five.bombAwaitingPlayerId = responders[0] ?? null;
    five.turnPlayerId = null;
    five.runningTotal = 0;
    five.skipNext = false;
    five.pendingDrawCount = 0;
    five.repeatTurnForPlayerId = null;

    this.fiveAliveClearDealTimer(five);
    five.dealKind = null;
    five.dealBanner = null;
    five.dealSteps = [];
    five.pendingTurnAfterDeal = null;

    this.setPhase(room, "fivealive_bomb", room.settings.daySeconds);
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  /** Auto-play number 0 if held; otherwise lose 1 life. */
  private fiveAliveAutoResolveBombResponse(room: Room, playerId: string) {
    const five = room.fiveAlive;
    if (!five || room.phase !== "fivealive_bomb") return;
    if (five.bombAwaitingPlayerId !== playerId) return;
    const hand = five.handsByPlayerId[playerId] ?? [];
    const zero = hand.find((c) => isNumber0(c));
    if (zero) {
      this.submitFiveAlivePlayCard(room.id, playerId, zero.id);
    } else {
      this.submitFiveAlivePlayCard(room.id, playerId, null, undefined, true);
    }
  }

  private onTimeoutFiveAlive(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || room.gameId !== "five-alive") return;
    const five = room.fiveAlive;
    if (!five) return;

    if (room.phase === "fivealive_turn") {
      const actorId = five.turnPlayerId;
      if (!actorId) {
        this.fiveAliveMaybeWin(room);
        return;
      }
      const actor = room.players.find((p) => p.id === actorId);
      const actorName = actor?.name ?? "Someone";
      const hand = five.handsByPlayerId[actorId] ?? [];
      const play = pickBotFiveAliveTurnPlay(hand, five.runningTotal);

      if (!play) {
        log(room, `${actorName} timed out with no playable card.`);
        this.fiveAliveAdvanceToNextTurn(room, actorId);
        return;
      }

      log(room, `${actorName} timed out — auto-playing.`);
      if (play.pass) {
        this.submitFiveAlivePlayCard(room.id, actorId, null, undefined, true);
      } else {
        this.submitFiveAlivePlayCard(room.id, actorId, play.cardId);
      }
      return;
    }

    if (room.phase === "fivealive_bomb") {
      const awaitingId = five.bombAwaitingPlayerId;
      if (!awaitingId) return;
      log(room, `Bomb response timed out — auto-resolving.`);
      this.fiveAliveAutoResolveBombResponse(room, awaitingId);
    }
  }

  submitFiveAlivePlayCard(
    roomId: string,
    playerId: string,
    cardId?: string | null,
    wildValue?: number,
    pass?: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || room.gameId !== "five-alive") return;
    const five = room.fiveAlive;
    if (!five) return;

    const actor = room.players.find((p) => p.id === playerId);
    if (!actor || !actor.alive || (actor.lives ?? 0) <= 0) return;
    if (!five.handsByPlayerId[playerId]) five.handsByPlayerId[playerId] = [];

    if (room.phase === "fivealive_dealing") return;

    if (room.phase === "fivealive_turn") {
      if (five.turnPlayerId !== playerId) return;

      if (pass) {
        const hand = five.handsByPlayerId[playerId] ?? [];
        if (handHasPlayableCard(hand, five.runningTotal)) return;
        actor.lives = Math.max(0, (actor.lives ?? 0) - 1);
        actor.alive = (actor.lives ?? 0) > 0;
        five.runningTotal = 0;
        five.pendingDrawCount = 0;
        five.skipNext = false;
        five.repeatTurnForPlayerId = null;
        this.fiveAliveClearCenterToDiscard(room);
        log(
          room,
          `${actor.name} has no playable cards — lose 1 life, reset to 0.`
        );
        this.fiveAliveAnnounce(room, fiveAlivePassAnnouncement(actor.name));
        if (this.fiveAliveMaybeWin(room)) return;
        // Keep all hands; only the stuck player lost a life and total reset.
        this.fiveAliveAdvanceToNextTurn(room, playerId);
        return;
      }

      const id = cardId ?? null;
      if (!id) return;

      const hand = five.handsByPlayerId[playerId] ?? [];
      const idx = hand.findIndex((c) => c.id === id);
      if (idx < 0) return;

      const card = hand[idx] as FiveAliveCardInstance;
      if (!canPlayFiveAliveCardAtTotal(card, five.runningTotal)) {
        return;
      }

      hand.splice(idx, 1);
      five.centerPile.push(card);

      const doBust = (reason: string) => {
        actor.lives = Math.max(0, (actor.lives ?? 0) - 1);
        actor.alive = (actor.lives ?? 0) > 0;
        five.runningTotal = 0;
        five.pendingDrawCount = 0;
        five.skipNext = false;
        five.repeatTurnForPlayerId = null;
        this.fiveAliveClearCenterToDiscard(room);
        log(room, `${actor.name} busts (${reason}) — lose 1 life, reset to 0.`);
        if (this.fiveAliveMaybeWin(room)) return;
        this.fiveAliveResetRound(
          room,
          "Round complete — new hands dealt.",
          playerId
        );
      };

      const result = resolveFiveAliveTurnPlay(
        five,
        card,
        playerId,
        this.fiveAliveSeats(room)
      );
      for (const line of result.logs) log(room, line);

      const playAnn = fiveAlivePlayAnnouncement(
        card,
        actor.name,
        this.fiveAliveSeats(room),
        five,
        result
      );
      if (playAnn) this.fiveAliveAnnounce(room, playAnn);

      if (result.kind === "bust") {
        doBust(result.reason);
        return;
      }

      if (result.kind === "bomb") {
        if (this.fiveAliveMaybeWin(room)) return;
        this.fiveAliveStartBombResolution(room, playerId);
        return;
      }

      if (result.kind === "shuffle") {
        five.pendingDrawCount = 0;
        five.skipNext = false;
        five.repeatTurnForPlayerId = null;
        const nextTurn =
          nextLivingSeatId(
            this.fiveAliveSeats(room),
            playerId,
            five.direction,
            1
          ) ?? null;
        if (!nextTurn) {
          this.fiveAliveMaybeWin(room);
          return;
        }
        this.beginFiveAliveDealing(
          room,
          "shuffle",
          "Shuffle — total reset to 0",
          nextTurn,
          result.dealSteps
        );
        return;
      }

      if (this.fiveAliveAfterEmptyHandRoundEnd(room, playerId)) return;

      if (this.fiveAliveMaybeWin(room)) return;
      this.fiveAliveAdvanceToNextTurn(room, playerId);
      return;
    }

    if (room.phase === "fivealive_bomb") {
      if (five.bombAwaitingPlayerId !== playerId) return;

      const hand = five.handsByPlayerId[playerId] ?? [];

      if (pass) {
        const hasDefuse = hand.some((c) => isBombDefuseCard(c));
        if (hasDefuse) return;
        actor.lives = Math.max(0, (actor.lives ?? 0) - 1);
        actor.alive = (actor.lives ?? 0) > 0;
        log(room, `${actor.name} cannot defuse — lose 1 life.`);
        this.fiveAliveAnnounce(
          room,
          fiveAliveBombResponseAnnouncement(actor.name, false)
        );
      } else {
        const id = cardId ?? null;
        if (!id) return;

        const idx = hand.findIndex((c) => c.id === id);
        if (idx < 0) return;
        const card = hand[idx] as FiveAliveCardInstance;
        if (!isBombDefuseCard(card)) return;

        hand.splice(idx, 1);
        five.centerPile.push(card);
        log(
          room,
          `${actor.name} defuses with ${cardLabel(card)}.`
        );
        this.fiveAliveAnnounce(
          room,
          fiveAliveBombResponseAnnouncement(actor.name, true, cardLabel(card))
        );
      }

      // Round reset only after bomb chain if hand emptied (not before bomb starts).
      if (this.fiveAliveAfterEmptyHandRoundEnd(room, playerId)) return;
      if (this.fiveAliveMaybeWin(room)) return;

      const idx = five.bombResponderIds.indexOf(playerId);
      const nextAwaiting = five.bombResponderIds[idx + 1] ?? null;
      five.bombAwaitingPlayerId = nextAwaiting;

      if (!nextAwaiting) {
        const actorId = five.bombActorId;
        five.bombActorId = null;
        five.bombResponderIds = [];
        five.bombAwaitingPlayerId = null;
        if (actorId) {
          this.fiveAliveAdvanceToNextTurn(room, actorId);
        } else {
          this.fiveAliveMaybeWin(room);
        }
      } else {
        this.scheduleBots(room);
        this.emitRoom(room);
      }
    }
  }

  submitNightAction(
    roomId: string,
    playerId: string,
    type: NightActionType,
    targetId: string
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.phase !== "night" || room.paused) return;
    const actor = room.players.find((p) => p.id === playerId);
    if (!actor?.alive) return;
    const expected = nightActionForPlayer(actor);
    if (expected !== type) return;
    if (type === "vigilante_shoot" && (actor.bulletsLeft ?? 0) <= 0) return;
    if (
      type !== "vigilante_shoot" ||
      targetId !== SKIP_VOTE_ID
    ) {
      const legal = validNightTargets(room.players, actor);
      if (!legal.some((p) => p.id === targetId)) {
        return;
      }
    }
    room.nightActions = room.nightActions.filter((a) => a.playerId !== playerId);
    room.nightActions.push({ playerId, type, targetId, auto: false });
    this.updateMafiaNightIntel(room);
    actor.afkCount = 0;
    this.emitRoom(room);
  }

  submitJuggle(roomId: string, playerId: string, targetIds: string[]) {
    const room = this.getRoom(roomId);
    const localVote =
      !!room?.settings.localMode && room.daySubPhase === "vote";
    if (
      !room ||
      room.phase !== "day" ||
      (room.daySubPhase !== "discussion" && !localVote) ||
      room.paused
    ) {
      return;
    }
    const juggler = room.players.find((p) => p.id === playerId);
    if (
      !juggler?.alive ||
      juggler.role !== "juggler" ||
      juggler.jugglerUsed
    ) {
      return;
    }
    const unique = [...new Set(targetIds)];
    if (unique.length !== 4) return;
    const livingIds = new Set(living(room).map((p) => p.id));
    if (!unique.every((id) => livingIds.has(id))) return;

    const evilCount = countEvilAmong(room.players, unique);
    juggler.jugglerUsed = true;

    const names = unique
      .map((id) => room.players.find((p) => p.id === id)?.name)
      .filter((n): n is string => Boolean(n));
    const nameList =
      names.length <= 1
        ? names[0] ?? "someone"
        : `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;

    log(room, `The Juggler juggled ${nameList}.`);
    this.setAnnouncement(
      room,
      "info",
      "Juggler acted",
      `The Juggler juggled ${nameList}.`
    );
    this.addChronicle(
      room,
      "day",
      `The Juggler juggled ${nameList}.`
    );

    const intelDetail = `${evilCount} of these 4 are evil.`;
    room.dayIntelByPlayer[juggler.id] = {
      kind: "juggler",
      title: `Day ${room.cycle} — juggle result`,
      detail: intelDetail,
      cycle: room.cycle,
      at: Date.now(),
    };
    if (juggler.socketId) {
      this.emitNightPowerResult(juggler.socketId, {
        tone: "good",
        title: `Day ${room.cycle} — juggle result`,
        detail: intelDetail,
      });
    }
    this.emitRoom(room);
  }

  submitVoteSkip(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (
      !room ||
      room.phase !== "day" ||
      room.daySubPhase !== "vote" ||
      room.paused
    ) {
      return;
    }
    const voter = room.players.find((p) => p.id === playerId);
    if (!voter) return;
    if (!playerCanDayVote(voter)) return;
    room.votes[playerId] = SKIP_VOTE_ID;
    voter.afkCount = 0;
    this.emitRoom(room);
  }

  submitVote(roomId: string, playerId: string, targetId: string) {
    const room = this.getRoom(roomId);
    if (
      !room ||
      room.phase !== "day" ||
      room.daySubPhase !== "vote" ||
      room.paused
    ) {
      return;
    }
    const voter = room.players.find((p) => p.id === playerId);
    const target = room.players.find((p) => p.id === targetId);
    if (!voter || !playerCanDayVote(voter) || !target?.alive || target.id === voter.id) {
      return;
    }
    room.votes[playerId] = targetId;
    voter.afkCount = 0;
    this.emitRoom(room);
  }

  skipDay(roomId: string, hostId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.requireHost(room, hostId)) return;
    if (
      room.phase !== "day" ||
      room.daySubPhase !== "vote" ||
      room.paused ||
      !this.canSkipDay(room)
    ) {
      return;
    }
    log(room, "The host ends the day early.");
    this.finishDayPhase(room);
  }

  /** Host force-advances the current timed phase (night / discussion / vote / reveal). */
  skipPhaseTimer(roomId: string, hostId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.requireHost(room, hostId)) return;
    if (room.paused) return;
    if (room.phase === "lobby" || room.phase === "gameover") return;
    if (!room.phaseEndsAt && room.gameId === "mafia-city") return;
    log(room, "The host skips the timer.");
    this.clearTimer(room);
    this.onTimeout(roomId);
  }

  relayVoiceSpeaking(
    roomId: string,
    playerId: string,
    channel: ChatChannel,
    speaking: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room || isChatOnlyGame(room.gameId)) return;
    if (!room.voiceParticipants[channel].has(playerId)) return;
    for (const socketId of this.voiceSocketIds(room, channel)) {
      this.io.to(socketId).emit("voice:speaking", {
        channel,
        playerId,
        speaking,
      });
    }
  }

  joinVoice(roomId: string, playerId: string, channel: ChatChannel) {
    const room = this.getRoom(roomId);
    const player = room?.players.find((p) => p.id === playerId);
    if (!room || isChatOnlyGame(room.gameId)) {
      if (player?.socketId) {
        this.io.to(player.socketId).emit("voice:error", {
          message: "Voice is not available in this game.",
        });
      }
      return;
    }
    if (room.gameId === "mafia-city" && room.settings.localMode) {
      if (player?.socketId) {
        this.io.to(player.socketId).emit("voice:error", {
          message: "Voice is disabled in Local mode.",
        });
      }
      return;
    }
    if (!player?.socketId) return;
    const opts = this.channelAccessOpts(room, player);
    if (!canAccessChannel(channel, opts)) {
      this.io.to(player.socketId).emit("voice:error", {
        message: "This voice channel is closed right now.",
      });
      return;
    }
    if (channel === "town" && opts.daySubPhase === "vote") {
      this.io.to(player.socketId).emit("voice:error", {
        message: "Town voice is closed during voting.",
      });
      return;
    }
    this.removeFromAllVoice(room, playerId);
    room.voiceParticipants[channel].add(playerId);
    this.broadcastVoiceParticipants(room, channel);
    this.emitRoom(room);
  }

  inviteVoice(
    roomId: string,
    fromId: string,
    channel: ChatChannel,
    targetId: string
  ) {
    const room = this.getRoom(roomId);
    if (!room || isChatOnlyGame(room.gameId)) return;
    if (room.gameId === "mafia-city" && room.settings.localMode) return;
    const from = room.players.find((p) => p.id === fromId);
    const target = room.players.find((p) => p.id === targetId);
    if (!from?.socketId || !target?.socketId || target.isBot || from.id === target.id) {
      return;
    }
    const fromOk = canAccessChannel(channel, this.channelAccessOpts(room, from));
    const targetOk = canAccessChannel(channel, this.channelAccessOpts(room, target));
    if (!fromOk || !targetOk) {
      this.io.to(from.socketId).emit("voice:error", {
        message: "That operator cannot join this channel right now.",
      });
      return;
    }
    if (room.voiceParticipants[channel].has(targetId)) return;
    this.io.to(target.socketId).emit("voice:invite", {
      channel,
      fromId: from.id,
      fromName: from.name,
    });
  }

  leaveVoice(roomId: string, playerId: string, channel: ChatChannel) {
    const room = this.getRoom(roomId);
    if (!room) return;
    if (!room.voiceParticipants[channel].delete(playerId)) return;
    room.voiceMutedIds.delete(playerId);
    this.broadcastVoiceParticipants(room, channel);
    this.emitRoom(room);
  }

  setVoiceMuted(
    roomId: string,
    playerId: string,
    channel: ChatChannel,
    muted: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room || isChatOnlyGame(room.gameId)) return;
    if (!room.voiceParticipants[channel].has(playerId)) return;
    if (muted) room.voiceMutedIds.add(playerId);
    else room.voiceMutedIds.delete(playerId);
    for (const socketId of this.voiceSocketIds(room, channel)) {
      this.io.to(socketId).emit("voice:muted", {
        channel,
        playerId,
        muted,
      });
    }
    this.emitRoom(room);
  }

  hostVoiceMute(
    roomId: string,
    hostId: string,
    targetId: string,
    muted: boolean
  ) {
    const room = this.getRoom(roomId);
    if (!room || !this.requireHost(room, hostId)) return;
    if (isChatOnlyGame(room.gameId)) return;
    const target = room.players.find((p) => p.id === targetId);
    if (!target || target.isBot) return;

    let channel: ChatChannel | null = null;
    for (const ch of ["town", "mafia", "graveyard"] as ChatChannel[]) {
      if (room.voiceParticipants[ch].has(targetId)) {
        channel = ch;
        break;
      }
    }
    if (!channel) return;

    if (muted) room.voiceMutedIds.add(targetId);
    else room.voiceMutedIds.delete(targetId);

    for (const socketId of this.voiceSocketIds(room, channel)) {
      this.io.to(socketId).emit("voice:muted", {
        channel,
        playerId: targetId,
        muted,
      });
    }
    this.emitRoom(room);
  }

  relayVoiceSignal(
    roomId: string,
    fromId: string,
    channel: ChatChannel,
    targetId: string,
    signal: VoiceSignalPayload
  ) {
    const room = this.getRoom(roomId);
    if (!room || isChatOnlyGame(room.gameId)) return;
    const from = room.players.find((p) => p.id === fromId);
    const target = room.players.find((p) => p.id === targetId);
    if (!from?.socketId || !target?.socketId) return;
    if (!room.voiceParticipants[channel].has(fromId)) return;
    if (!room.voiceParticipants[channel].has(targetId)) return;
    this.io.to(target.socketId).emit("voice:signal", {
      channel,
      fromId,
      signal,
    });
  }

  sendChat(
    roomId: string,
    playerId: string,
    channel: ChatChannel,
    text: string
  ) {
    const room = this.getRoom(roomId);
    if (!room) return;
    if (room.gameId === "mafia-city" && room.settings.localMode) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player) return;
    const trimmed = text.trim().slice(0, 240);
    if (!trimmed) return;

    if (channel === "graveyard" && player.alive) return;
    if (channel === "town" && !player.alive) return;
    if (
      !canAccessChannel(channel, this.channelAccessOpts(room, player))
    ) {
      return;
    }

    const message: ChatMessage = {
      id: randomUUID(),
      channel,
      playerId: player.id,
      name: player.name,
      text: trimmed,
      at: Date.now(),
    };
    room.chat.push(message);

    if (channel === "mafia") {
      this.io.to(`mafia:${room.id}`).emit("chat:message", message);
    } else if (channel === "graveyard") {
      for (const p of room.players) {
        if (!p.alive && p.socketId) this.io.to(p.socketId).emit("chat:message", message);
      }
    } else {
      this.io.to(room.id).emit("chat:message", message);
    }
  }

  private fiveAliveHandlePlayerDeparted(room: Room, playerId: string) {
    const five = room.fiveAlive;
    if (!five) return;

    if (room.phase === "fivealive_turn" && five.turnPlayerId === playerId) {
      log(room, `${room.players.find((p) => p.id === playerId)?.name ?? "Someone"} left — turn skipped.`);
      this.fiveAliveAdvanceToNextTurn(room, playerId);
      return;
    }

    if (room.phase === "fivealive_bomb" && five.bombAwaitingPlayerId === playerId) {
      const idx = five.bombResponderIds.indexOf(playerId);
      const nextAwaiting = five.bombResponderIds[idx + 1] ?? null;
      five.bombAwaitingPlayerId = nextAwaiting;
      if (!nextAwaiting) {
        const actorId = five.bombActorId;
        five.bombActorId = null;
        five.bombResponderIds = [];
        five.bombAwaitingPlayerId = null;
        if (actorId) {
          this.fiveAliveAdvanceToNextTurn(room, actorId);
        } else {
          this.fiveAliveMaybeWin(room);
        }
      }
    }
  }

  leaveRoom(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room) return;
    const player = room.players.find((p) => p.id === playerId);
    if (!player || player.isBot) return;

    const socketId = player.socketId;
    const wasHost = player.isHost;
    this.removeFromAllVoice(room, player.id);
    this.leaveMafiaRooms(player, room.id);

    if (room.gameId === "five-alive" && room.fiveAlive && room.phase !== "lobby") {
      this.fiveAliveHandlePlayerDeparted(room, player.id);
    }

    if (room.phase !== "lobby" && player.alive) {
      player.alive = false;
      if (room.gameId === "five-alive") {
        player.lives = 0;
      }
      log(room, `${player.name} left the game.`);
      this.maybeWin(room);
    } else if (room.phase === "lobby") {
      log(room, `${player.name} left the lobby.`);
    }

    // Transfer before removing so the room keeps a human host (lobby or mid-game).
    this.transferHostFrom(room, player);

    room.players = room.players.filter((p) => p.id !== playerId);
    room.afkWarnedPlayerIds = room.afkWarnedPlayerIds.filter(
      (id) => id !== playerId
    );
    this.playerRoom.delete(playerId);

    if (socketId) {
      this.io.sockets.sockets.get(socketId)?.leave(room.id);
    }

    const humansRemaining = room.players.filter((p) => !p.isBot);
    // Only close when no real players remain (bots alone do not keep a room open).
    if (humansRemaining.length === 0) {
      const reason =
        room.phase === "lobby"
          ? wasHost
            ? "host_quit"
            : "empty"
          : "ended_empty";
      void this.closeLobby(room, reason);
      return;
    }

    this.ensureHumanHost(room);

    if (room.phase === "lobby") {
      this.promoteConnectedHostIfNeeded(room);
      this.syncLobbyHostOfflineIdle(room);
    }

    this.emitRoom(room);
  }

  kick(roomId: string, hostId: string, targetId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.requireHost(room, hostId)) return;
    const target = room.players.find((p) => p.id === targetId);
    if (!target || target.isHost) return;

    if (room.phase === "lobby") {
      room.players = room.players.filter((p) => p.id !== targetId);
      if (target.socketId) {
        this.io.to(target.socketId).emit("room:error", { message: "Kicked by host" });
        this.io.sockets.sockets.get(target.socketId)?.leave(room.id);
      }
      this.playerRoom.delete(targetId);
      this.emitRoom(room);
      return;
    }

    if (target.alive) {
      target.alive = false;
      if (room.gameId === "five-alive") {
        target.lives = 0;
      }
      log(room, `${target.name} was removed from the city.`);
      this.leaveMafiaRooms(target, room.id);
      this.removeFromAllVoice(room, target.id);
    }
    room.afkWarnedPlayerIds = room.afkWarnedPlayerIds.filter((id) => id !== targetId);
    this.emitRoom(room);
    this.maybeWin(room);
  }

  pause(roomId: string, hostId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.requireHost(room, hostId)) return;
    if (room.paused) return;
    // Timed phases store remaining ms; untimed games (e.g. Spot It) pause without a clock.
    if (room.phaseEndsAt) {
      room.pausedRemainingMs = Math.max(0, room.phaseEndsAt - Date.now());
      room.phaseEndsAt = null;
    } else {
      room.pausedRemainingMs = null;
    }
    room.paused = true;
    this.clearTimer(room);
    log(room, "The host paused the game.");
    this.emitRoom(room);
  }

  resume(roomId: string, hostId: string) {
    const room = this.getRoom(roomId);
    if (!room || !this.requireHost(room, hostId)) return;
    if (!room.paused) return;
    room.paused = false;
    const ms = room.pausedRemainingMs;
    room.pausedRemainingMs = null;
    if (typeof ms === "number") {
      room.phaseEndsAt = Date.now() + ms;
    }
    log(room, "The host resumed the game.");
    this.schedule(room);
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  returnToLobby(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.phase !== "gameover") return;
    if (!this.requireHost(room, playerId)) return;
    this.clearTimer(room);
    for (const p of room.players) {
      p.role = undefined;
      p.fakeRole = undefined;
      p.jugglerUsed = undefined;
      p.poisoned = undefined;
      p.alive = true;
      if (room.gameId === "five-alive") {
        p.lives = 5;
      } else {
        p.lives = undefined;
      }
      p.ready = true;
      p.afkCount = 0;
      p.blackmailed = false;
      p.bulletsLeft = undefined;
      this.leaveMafiaRooms(p, room.id);
    }
    room.phase = "lobby";
    room.cycle = 0;
    room.phaseEndsAt = null;
    room.daySubPhase = null;
    room.paused = false;
    room.winner = null;
    room.logs = [];
    room.votes = {};
    room.nightActions = [];
    room.detectiveByPlayer = {};
    room.afkWarnedPlayerIds = [];
    room.chronicle = [];
    room.announcement = null;
    room.mafiaNightIntel = {};
    room.dayIntelByPlayer = {};
    room.afkGraceEndsAt = null;
    room.afkGracePlayerId = null;
    room.fiveAlive = undefined;
    room.explodingKittens = undefined;
    room.spotIt = undefined;
    room.ttt = undefined;
    room.connect4 = undefined;
    room.battleship = undefined;
    room.boardWinnerId = null;
    room.boardDraw = false;
    room.voiceParticipants = emptyVoiceChannels();
    room.voiceMutedIds = new Set();
    this.emitRoom(room);
  }

  private startSpotIt(room: Room) {
    const generated = generateDobbleDeck(7);
    const deck = shuffleCards(generated.cards);
    const piles: Record<string, number[][]> = {};
    for (const p of room.players) {
      const card = deck.pop();
      if (!card) throw new Error("Deck too small for players");
      piles[p.id] = [card];
      p.alive = true;
      p.ready = false;
      p.role = "villager";
    }
    room.spotIt = {
      deck,
      piles,
      matchSeq: 0,
      startedAt: Date.now(),
    };
    room.boardWinnerId = null;
    room.boardDraw = false;
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    log(room, "Spot It — find the match. First click wins the card.");
    this.setPhase(room, "spotit_play", null);
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  submitSpotItMatch(roomId: string, playerId: string, symbolId: number) {
    const room = this.getRoom(roomId);
    if (!room || room.gameId !== "spot-it" || room.phase !== "spotit_play") return;
    if (room.paused || !room.spotIt) return;
    const spot = room.spotIt;
    const center = spot.deck[0];
    const playerCard = spot.piles[playerId]?.[0];
    const player = room.players.find((p) => p.id === playerId);
    if (!center || !playerCard || !player) return;

    const expected = sharedSymbol(playerCard, center);
    if (expected == null || expected !== symbolId) {
      if (player.socketId) {
        this.io.to(player.socketId).emit("spotit:reject", {
          message: "That’s not the matching symbol.",
        });
      }
      return;
    }

    spot.matchSeq += 1;
    const claimed = spot.deck.shift()!;
    spot.piles[playerId] = [claimed, ...(spot.piles[playerId] ?? [])];
    log(room, `${player.name} claimed a card.`);
    this.io.to(room.id).emit("spotit:matchResolved", {
      winnerId: playerId,
      symbolId,
      matchSeq: spot.matchSeq,
    });

    if (spot.deck.length === 0) {
      const ranked = room.players
        .map((p) => ({
          id: p.id,
          score: spot.piles[p.id]?.length ?? 0,
        }))
        .sort((a, b) => b.score - a.score);
      const top = ranked[0]?.score ?? 0;
      const winners = ranked.filter((r) => r.score === top);
      room.boardDraw = winners.length > 1;
      room.boardWinnerId = winners.length === 1 ? winners[0]!.id : null;
      room.phase = "gameover";
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.clearBotTimers(room);
      log(
        room,
        room.boardDraw
          ? "Spot It ended in a draw."
          : `${room.players.find((p) => p.id === room.boardWinnerId)?.name ?? "Someone"} wins Spot It!`
      );
      this.emitRoom(room);
      return;
    }

    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private startTicTacToe(room: Room) {
    if (room.players.length !== 2) {
      throw new Error("Tic-Tac-Toe needs exactly 2 players");
    }
    const [a, b] = room.players;
    for (const p of room.players) {
      p.alive = true;
      p.ready = false;
      p.role = "villager";
    }
    // Randomize who opens — host is not guaranteed first / X.
    const first = Math.random() < 0.5 ? a! : b!;
    const second = first.id === a!.id ? b! : a!;
    room.ttt = {
      board: emptyTttBoard(),
      turnPlayerId: first.id,
      marks: { [first.id]: "X", [second.id]: "O" },
      winningLine: null,
      lastMove: null,
      result: "ongoing",
      winnerId: null,
    };
    room.boardWinnerId = null;
    room.boardDraw = false;
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    log(room, `Tic-Tac-Toe — ${first.name} (X) goes first.`);
    this.setPhase(room, "ttt_play", boardTurnSeconds(room.settings.daySeconds));
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  submitTttMove(roomId: string, playerId: string, cellIndex: number) {
    const room = this.getRoom(roomId);
    if (!room || room.gameId !== "tic-tac-toe" || room.phase !== "ttt_play") return;
    if (room.paused || !room.ttt || room.ttt.result !== "ongoing") return;
    const ttt = room.ttt;
    if (ttt.turnPlayerId !== playerId) return;
    const mark = ttt.marks[playerId];
    if (!mark) return;
    const next = applyTttMove(ttt.board, cellIndex, mark);
    if (!next) return;
    ttt.board = next;
    ttt.lastMove = cellIndex;
    const win = checkTttWin(ttt.board);
    if (win) {
      ttt.winningLine = win.line;
      ttt.result = "win";
      ttt.winnerId = playerId;
      room.boardWinnerId = playerId;
      room.boardDraw = false;
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.clearBotTimers(room);
      log(room, `${room.players.find((p) => p.id === playerId)?.name ?? "Player"} wins!`);
      this.emitRoom(room);
      this.scheduleBoardGameOver(room.id, "tic-tac-toe");
      return;
    }
    if (isTttDraw(ttt.board)) {
      ttt.result = "draw";
      room.boardDraw = true;
      room.boardWinnerId = null;
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.clearBotTimers(room);
      log(room, "Tic-Tac-Toe draw.");
      this.emitRoom(room);
      this.scheduleBoardGameOver(room.id, "tic-tac-toe");
      return;
    }
    const other = room.players.find((p) => p.id !== playerId);
    if (other) ttt.turnPlayerId = other.id;
    this.setPhase(room, "ttt_play", boardTurnSeconds(room.settings.daySeconds));
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private scheduleBoardGameOver(
    roomId: string,
    gameId: "connect-4" | "tic-tac-toe" | "battleship",
    delayMs = 700
  ) {
    setTimeout(() => {
      const room = this.getRoom(roomId);
      if (!room || room.gameId !== gameId) return;
      if (gameId === "connect-4") {
        if (room.phase !== "connect4_play") return;
        if (!room.connect4 || room.connect4.result === "ongoing") return;
      } else if (gameId === "tic-tac-toe") {
        if (room.phase !== "ttt_play") return;
        if (!room.ttt || room.ttt.result === "ongoing") return;
      } else if (gameId === "battleship") {
        if (
          room.phase !== "battleship_play" &&
          room.phase !== "gameover"
        ) {
          return;
        }
        if (!room.battleship || room.battleship.phase !== "gameover") return;
      }
      room.phase = "gameover";
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.emitRoom(room);
    }, delayMs);
  }

  private startConnect4(room: Room) {
    if (room.players.length !== 2) {
      throw new Error("Connect 4 needs exactly 2 players");
    }
    const [a, b] = room.players;
    for (const p of room.players) {
      p.alive = true;
      p.ready = false;
      p.role = "villager";
    }
    room.connect4 = {
      board: emptyC4Board(),
      turnPlayerId: a!.id,
      colors: { [a!.id]: "R", [b!.id]: "Y" },
      winningCells: null,
      lastDrop: null,
      result: "ongoing",
      winnerId: null,
    };
    room.boardWinnerId = null;
    room.boardDraw = false;
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    log(room, "Connect 4 — Red drops first.");
    this.setPhase(room, "connect4_play", boardTurnSeconds(room.settings.daySeconds));
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  submitConnect4Drop(roomId: string, playerId: string, column: number) {
    const room = this.getRoom(roomId);
    if (!room || room.gameId !== "connect-4" || room.phase !== "connect4_play") {
      return;
    }
    if (room.paused || !room.connect4 || room.connect4.result !== "ongoing") return;
    const c4 = room.connect4;
    if (c4.turnPlayerId !== playerId) return;
    const color = c4.colors[playerId];
    if (!color) return;
    const dropped = dropC4(c4.board, column, color);
    if (!dropped) return;
    c4.board = dropped.board;
    c4.lastDrop = { col: column, row: dropped.row };
    const win = checkC4Win(c4.board, dropped.row, column);
    if (win) {
      c4.winningCells = win.cells;
      c4.result = "win";
      c4.winnerId = playerId;
      room.boardWinnerId = playerId;
      room.boardDraw = false;
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.clearBotTimers(room);
      log(room, `${room.players.find((p) => p.id === playerId)?.name ?? "Player"} wins!`);
      this.emitRoom(room);
      this.scheduleBoardGameOver(room.id, "connect-4");
      return;
    }
    if (isC4Draw(c4.board)) {
      c4.result = "draw";
      room.boardDraw = true;
      room.boardWinnerId = null;
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.clearBotTimers(room);
      log(room, "Connect 4 draw.");
      this.emitRoom(room);
      this.scheduleBoardGameOver(room.id, "connect-4");
      return;
    }
    const other = room.players.find((p) => p.id !== playerId);
    if (other) c4.turnPlayerId = other.id;
    this.setPhase(room, "connect4_play", boardTurnSeconds(room.settings.daySeconds));
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private startBattleship(room: Room) {
    if (room.players.length !== 2) {
      throw new Error("Tactical Battleship needs exactly 2 players");
    }
    room.cycle = 1;
    room.winner = null;
    room.logs = [];
    room.boardWinnerId = null;
    room.boardDraw = false;
    for (const p of room.players) {
      p.role = undefined;
      p.alive = true;
      p.ready = false;
      p.lives = undefined;
      this.leaveMafiaRooms(p, room.id);
    }
    const ids = room.players.map((p) => p.id) as [string, string];
    room.battleship = beginBattleship(ids);
    log(room, "Tactical Battleship — place your fleets.");
    this.setPhase(room, "battleship_setup", Math.max(60, boardTurnSeconds(room.settings.daySeconds) * 3));
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private afterBattleshipAction(room: Room) {
    const bs = room.battleship;
    if (!bs) return;
    for (const line of bs.lastActionLog) {
      log(room, line);
    }
    if (bs.phase === "gameover" && bs.winnerId) {
      room.boardWinnerId = bs.winnerId;
      room.phaseEndsAt = null;
      this.clearTimer(room);
      this.clearBotTimers(room);
      this.emitRoom(room);
      this.scheduleBoardGameOver(room.id, "battleship");
      return;
    }
    if (bs.phase === "battle") {
      this.setPhase(
        room,
        "battleship_play",
        boardTurnSeconds(room.settings.daySeconds)
      );
    } else if (bs.phase === "setup") {
      this.setPhase(
        room,
        "battleship_setup",
        Math.max(60, boardTurnSeconds(room.settings.daySeconds) * 3)
      );
    }
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  submitBattleshipReady(
    roomId: string,
    playerId: string,
    fleet: FleetPlacement | { type: string; cells: { col: number; row: number }[] }[]
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || room.gameId !== "battleship") return;
    if (room.phase !== "battleship_setup" || !room.battleship) return;
    const normalized: FleetPlacement = fleet.map((s) => ({
      type: s.type as FleetPlacement[number]["type"],
      cells: s.cells.map((c) => ({ col: c.col, row: c.row })),
      hits:
        "hits" in s && Array.isArray(s.hits)
          ? (s.hits as boolean[])
          : s.cells.map(() => false),
      sunk: "sunk" in s ? !!(s as { sunk?: boolean }).sunk : false,
    }));
    room.battleship = submitFleetReady(room.battleship, playerId, normalized);
    if (room.battleship.phase === "battle") {
      log(room, "Both fleets locked — battle begins!");
    }
    this.afterBattleshipAction(room);
  }

  submitBattleshipFire(
    roomId: string,
    playerId: string,
    col: number,
    row: number
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || room.gameId !== "battleship") return;
    if (room.phase !== "battleship_play" || !room.battleship) return;
    room.battleship = fireStandardShot(room.battleship, playerId, col, row);
    this.afterBattleshipAction(room);
  }

  submitBattleshipPowerUp(
    roomId: string,
    playerId: string,
    type: PowerUpType,
    opts: {
      col: number;
      row: number;
      orientation?: Orientation;
      direction?: TorpedoDirection;
    }
  ) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || room.gameId !== "battleship") return;
    if (room.phase !== "battleship_play" || !room.battleship) return;
    room.battleship = triggerPowerUp(room.battleship, playerId, type, opts);
    this.afterBattleshipAction(room);
  }

  submitBattleshipRematch(roomId: string, playerId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.gameId !== "battleship") return;
    if (room.phase !== "gameover") return;
    if (!this.requireHost(room, playerId)) return;
    if (!room.battleship) return;
    room.battleship = rematchBattleship(room.battleship);
    room.boardWinnerId = null;
    room.boardDraw = false;
    room.logs = [];
    log(room, "Rematch — place fleets again.");
    this.setPhase(
      room,
      "battleship_setup",
      Math.max(60, boardTurnSeconds(room.settings.daySeconds) * 3)
    );
    this.scheduleBots(room);
    this.emitRoom(room);
  }

  private onTimeoutBattleship(roomId: string) {
    const room = this.getRoom(roomId);
    if (!room || room.paused || room.gameId !== "battleship" || !room.battleship)
      return;
    const bs = room.battleship;
    if (room.phase === "battleship_setup") {
      for (const p of room.players) {
        if (!bs.ready[p.id]) {
          room.battleship = autoReadyRandomFleet(room.battleship, p.id);
          log(room, `${p.name} timed out — fleet auto-placed.`);
        }
      }
      this.afterBattleshipAction(room);
      return;
    }
    if (room.phase === "battleship_play" && bs.turnPlayerId) {
      const turnId = bs.turnPlayerId;
      room.battleship = applyBotBattleAction(bs, turnId);
      log(
        room,
        `${room.players.find((p) => p.id === turnId)?.name ?? "Player"} timed out — auto strike.`
      );
      this.afterBattleshipAction(room);
    }
  }

  disconnect(socketId: string) {
    for (const room of this.rooms.values()) {
      const specIdx = room.spectators.findIndex((s) => s.socketId === socketId);
      if (specIdx >= 0) {
        room.spectators.splice(specIdx, 1);
        this.emitRoom(room);
      }
    }

    const found = this.playerBySocket(socketId);
    if (!found) return;
    const { room, player } = found;
    this.removeFromAllVoice(room, player.id);
    player.socketId = null;

    // Keep seat for reconnect; move host to another connected human when possible
    // so the room does not idle-close (or lose host controls) for players still in.
    // Presence = socketId only — mouse/tab idle never reaches this path.
    this.transferHostFrom(room, player);
    this.ensureHumanHost(room);
    this.promoteConnectedHostIfNeeded(room);

    if (room.phase === "lobby") {
      // Alone / all humans offline → start 5min host_afk. New host online → clear.
      this.syncLobbyHostOfflineIdle(room);
    }
    void this.sweepExpiredLobbies();
    this.emitRoom(room);
  }
}
