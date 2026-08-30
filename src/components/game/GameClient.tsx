"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type {
  ChatChannel,
  ChatMessage,
  Faction,
  NightActionType,
  PublicGameState,
  Role,
  RoomSettings,
} from "@/lib/types";
import { loadProfile } from "@/lib/profile";
import { playLobbyIdleWarning } from "@/lib/sounds";
import { getSocket, type GameSocket } from "@/lib/socket/client";
import { emitPageView } from "@/lib/analytics-beacon";
import { useKnowGame } from "@/hooks/useKnowGame";
import { ActionPrompt } from "@/components/game/ActionPrompt";
import { ActionDialog } from "@/components/game/mafia/ActionDialog";
import { PhaseResultPopup } from "@/components/game/mafia/PhaseResultPopup";
import { DayIntelPanel } from "@/components/game/mafia/DayIntelPanel";
import { AnnouncementsPanel } from "@/components/game/AnnouncementsPanel";
import { ChatPanel } from "@/components/game/ChatPanel";
import { GameHud } from "@/components/game/GameHud";
import { GameOverScreen } from "@/components/game/GameOverScreen";
import { LobbyView } from "@/components/game/LobbyView";
import { FiveAliveLobbyView } from "@/components/game/FiveAliveLobbyView";
import {
  NightActionPanel,
  PlayerGrid,
  VotePanel,
} from "@/components/game/PlayerGrid";
import { RoleRevealCard } from "@/components/game/RoleRevealCard";
import { GlassPanel, PrimaryButton } from "@/components/ui/primitives";
import { LoadingScreen } from "@/components/ui/LoadingScreen";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { availableChannels, canUseTownVoice, CHANNEL_LABELS } from "@/lib/chat-access";
import { pendingPlayerAction } from "@/lib/action-prompt";
import { isLocalMafia } from "@/lib/mafia-local-mode";
import { announcementForViewer } from "@/lib/announcement-for-viewer";
import { isMafiaRole, ROLE_META } from "@/lib/games/mafia-city/roles";
import { Mic } from "lucide-react";
import { FiveAlivePlayPanel } from "@/components/game/five-alive/FiveAlivePlayPanel";
import { FiveAliveSidebar } from "@/components/game/five-alive/FiveAliveSidebar";
import { ExplodingKittensLobbyView } from "@/components/game/exploding-kittens/ExplodingKittensLobbyView";
import { ExplodingKittensTable } from "@/components/game/exploding-kittens/ExplodingKittensTable";
import { SpotItLobbyView } from "@/components/game/SpotItLobbyView";
import { SpotItTable } from "@/components/game/spot-it/SpotItTable";
import { BoardLobbyView } from "@/components/game/board/BoardLobbyView";
import { TttBoard } from "@/components/game/tic-tac-toe/TttBoard";
import { Connect4Board } from "@/components/game/connect-4/Connect4Board";
import { BattleshipTable } from "@/components/game/battleship/BattleshipTable";
import { SpectatorBanner } from "@/components/game/mafia/SpectatorBanner";

export function GameClient({
  roomId,
}: {
  roomId: string;
}) {
  const router = useRouter();
  const [knowGame, setKnowGame] = useKnowGame();
  const [state, setState] = useState<PublicGameState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [socket, setSocket] = useState<GameSocket | null>(null);
  const [voiceInvite, setVoiceInvite] = useState<{
    channel: ChatChannel;
    fromId: string;
    fromName: string;
  } | null>(null);
  const [joinVoiceRequest, setJoinVoiceRequest] = useState<{
    nonce: number;
    channel: ChatChannel;
  } | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const clearVoiceInviteForChannel = useCallback((channel: ChatChannel) => {
    setVoiceInvite((inv) => (inv?.channel === channel ? null : inv));
    setJoinVoiceRequest((req) => (req?.channel === channel ? null : req));
  }, []);
  const [startingGame, setStartingGame] = useState(false);
  const [returningToLobby, setReturningToLobby] = useState(false);
  const [quitConfirmOpen, setQuitConfirmOpen] = useState(false);
  const [quitting, setQuitting] = useState(false);
  const [lobbyIdleWarning, setLobbyIdleWarning] = useState<{
    stage: 1 | 2 | 3;
    message: string;
    isFinal?: boolean;
  } | null>(null);
  const [dismissedAnnouncementId, setDismissedAnnouncementId] = useState<
    string | null
  >(null);
  const [dismissedActionKey, setDismissedActionKey] = useState<string | null>(
    null
  );
  const [mafiaVoiceWarning, setMafiaVoiceWarning] = useState(false);
  const [personalNightPopup, setPersonalNightPopup] = useState<{
    id: string;
    tone: "info" | "good" | "bad";
    title: string;
    detail: string;
  } | null>(null);
  const [pendingPersonalNightPopups, setPendingPersonalNightPopups] = useState<
    {
      id: string;
      tone: "info" | "good" | "bad";
      title: string;
      detail: string;
    }[]
  >([]);
  const [localReveal, setLocalReveal] = useState<{
    role: Role;
    faction: Faction;
    ability: string;
  } | null>(null);
  const quittingRef = useRef(false);
  const quitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const finishLeaveRef = useRef<() => void>(() => {});
  const shownDetectiveLogIdRef = useRef<string | null>(null);
  const detectiveLogReadyRef = useRef(false);

  const queuePersonalNightPopup = (popup: {
    id: string;
    tone: "info" | "good" | "bad";
    title: string;
    detail: string;
  }) => {
    setPendingPersonalNightPopups((prev) =>
      prev.some((p) => p.id === popup.id) ? prev : [...prev, popup]
    );
  };

  useEffect(() => {
    emitPageView({
      path: `/room/${roomId}`,
      roomId,
      onceKey: `room:${roomId}`,
    });
  }, [roomId]);

  // Seed detective log cursor so reconnect/history does not spam old popups.
  // Live investigation popups come from detective:result (before town announcements).
  useEffect(() => {
    if (!state?.detectiveLog) return;
    const latest = state.detectiveLog[state.detectiveLog.length - 1];
    shownDetectiveLogIdRef.current = latest?.id ?? null;
    detectiveLogReadyRef.current = true;
  }, [state?.detectiveLog]);

  // Personal night-power results come first — promote as soon as they arrive.
  useEffect(() => {
    if (personalNightPopup || pendingPersonalNightPopups.length === 0) return;
    const [next, ...rest] = pendingPersonalNightPopups;
    setPersonalNightPopup(next);
    setPendingPersonalNightPopups(rest);
  }, [personalNightPopup, pendingPersonalNightPopups]);

  // Skip queued popups while "know game" is on so toggling off does not flood.
  useEffect(() => {
    if (!knowGame || state?.gameId !== "five-alive") return;
    setPersonalNightPopup(null);
    setPendingPersonalNightPopups([]);
  }, [knowGame, state?.gameId]);

  useEffect(() => {
    if (!knowGame || state?.gameId !== "five-alive" || !state?.announcement) return;
    if (state.announcement.id !== dismissedAnnouncementId) {
      setDismissedAnnouncementId(state.announcement.id);
    }
  }, [knowGame, state?.gameId, state?.announcement, dismissedAnnouncementId]);

  useEffect(() => {
    const profile = loadProfile();
    if (!profile) {
      router.replace("/");
      return;
    }
    const s = getSocket(profile.playerId);
    setSocket(s);

    const onState = (next: PublicGameState) => {
      if (next.roomId !== roomId) return;
      setError(null);
      setState(next);
      if (next.you?.role) {
        const meta = ROLE_META[next.you.role];
        setLocalReveal({
          role: next.you.role,
          faction: meta.faction,
          ability: meta.ability,
        });
      }
      if (next.phase === "lobby") {
        setLocalReveal(null);
        shownDetectiveLogIdRef.current = null;
        detectiveLogReadyRef.current = false;
        setPersonalNightPopup(null);
        setPendingPersonalNightPopups([]);
        setVoiceInvite(null);
        setJoinVoiceRequest(null);
      }
    };

    const onChat = (message: ChatMessage) => {
      setState((prev) => {
        if (!prev) return prev;
        if (prev.chat.some((m) => m.id === message.id)) return prev;
        // Drop matching optimistic local message (same author/text/channel)
        const withoutOptimistic = prev.chat.filter(
          (m) =>
            !(
              m.id.startsWith("local-") &&
              m.playerId === message.playerId &&
              m.channel === message.channel &&
              m.text === message.text
            )
        );
        return {
          ...prev,
          chat: [...withoutOptimistic, message].slice(-50),
        };
      });
    };

    const onRoleReveal = (payload: {
      role: Role;
      faction: Faction;
      ability: string;
    }) => {
      setLocalReveal(payload);
    };

    const onDetectiveResult = (payload: {
      targetId: string;
      targetName: string;
      faction: Faction;
      cycle?: number;
    }) => {
      // Prefer investigation before any day-phase announcement.
      queuePersonalNightPopup({
        id: `detective-${payload.targetId}-${payload.faction}-${payload.cycle ?? "x"}`,
        tone: payload.faction === "mafia" ? "bad" : "good",
        title:
          payload.cycle != null
            ? `Night ${payload.cycle} investigation`
            : "Investigation result",
        detail: `${payload.targetName} is aligned with the ${payload.faction.toUpperCase()}.`,
      });
    };

    const onNightPowerResult = (payload: {
      id: string;
      tone: "info" | "good" | "bad";
      title: string;
      detail: string;
    }) => {
      queuePersonalNightPopup(payload);
    };

    const onErr = ({ message, code }: { message: string; code?: string }) => {
      if (quittingRef.current) {
        finishLeaveRef.current();
        return;
      }
      setError(message);
      setStartingGame(false);
      setReturningToLobby(false);
      setQuitting(false);
      setQuitConfirmOpen(false);
      if (message.toLowerCase().includes("kicked")) router.replace("/");
      // Real room teardown (empty / host-afk / last human left) — clear local
      // state so the closed screen shows. Host transfer does NOT emit this.
      if (
        code === "NOT_FOUND" ||
        code === "NOT_IN_ROOM" ||
        code === "LOBBY_CLOSED"
      ) {
        setState(null);
      }
    };

    const onInvite = (payload: {
      channel: ChatChannel;
      fromId: string;
      fromName: string;
    }) => {
      const s = stateRef.current;
      const youId = s?.you?.id;
      // Already in that channel — never surface the join popup again.
      if (youId && (s?.voiceParticipants[payload.channel] ?? []).includes(youId)) {
        return;
      }
      setVoiceInvite({
        channel: payload.channel,
        fromId: payload.fromId,
        fromName: payload.fromName,
      });
    };

    const onLobbyIdle = (payload: {
      stage: 1 | 2 | 3;
      message: string;
      isFinal?: boolean;
    }) => {
      playLobbyIdleWarning(payload.stage);
      setLobbyIdleWarning(payload);
    };

    finishLeaveRef.current = () => {
      if (quitTimeoutRef.current) {
        clearTimeout(quitTimeoutRef.current);
        quitTimeoutRef.current = null;
      }
      quittingRef.current = false;
      router.replace("/");
    };

    const onLeft = () => {
      finishLeaveRef.current();
    };

    s.on("room:state", onState);
    s.on("room:error", onErr);
    s.on("room:left", onLeft);
    s.on("voice:invite", onInvite);
    s.on("lobby:idleWarning", onLobbyIdle);
    s.on("chat:message", onChat);
    s.on("role:reveal", onRoleReveal);
    s.on("detective:result", onDetectiveResult);
    s.on("night:powerResult", onNightPowerResult);

    const join = () => {
      if (quittingRef.current) return;
      s.emit("room:rejoin", { roomId, playerId: profile.playerId });
    };
    if (s.connected) join();
    s.on("connect", join);

    return () => {
      if (quitTimeoutRef.current) {
        clearTimeout(quitTimeoutRef.current);
        quitTimeoutRef.current = null;
      }
      s.off("room:state", onState);
      s.off("room:error", onErr);
      s.off("room:left", onLeft);
      s.off("voice:invite", onInvite);
      s.off("lobby:idleWarning", onLobbyIdle);
      s.off("chat:message", onChat);
      s.off("role:reveal", onRoleReveal);
      s.off("detective:result", onDetectiveResult);
      s.off("night:powerResult", onNightPowerResult);
      s.off("connect", join);
    };
  }, [roomId, router]);

  useEffect(() => {
    if (!state) return;
    if (state.phase !== "lobby") {
      setStartingGame(false);
      setLobbyIdleWarning(null);
    }
    if (state.phase === "lobby" && !state.you?.isHost) {
      setLobbyIdleWarning(null);
    }
    if (state.phase === "lobby") setReturningToLobby(false);
  }, [state?.phase, state?.you?.isHost, state]);

  useEffect(() => {
    if (!state || state.gameId !== "mafia-city" || state.phase !== "night") {
      setMafiaVoiceWarning(false);
      return;
    }
    if (!state.you?.role || !isMafiaRole(state.you.role)) return;
    if (!state.phaseEndsAt) return;
    const endsAt = state.phaseEndsAt;
    const check = () => {
      const remaining = endsAt - Date.now();
      setMafiaVoiceWarning(remaining > 0 && remaining <= 10000);
    };
    check();
    const t = setInterval(check, 500);
    return () => clearInterval(t);
  }, [
    state?.gameId,
    state?.phase,
    state?.phaseEndsAt,
    state?.you?.role,
  ]);

  // Dismiss invite banner once you're in that channel's voice (any join path).
  useEffect(() => {
    if (!voiceInvite || !state?.you?.id) return;
    const ids = state.voiceParticipants[voiceInvite.channel] ?? [];
    if (ids.includes(state.you.id)) {
      setVoiceInvite(null);
    }
  }, [voiceInvite, state?.you?.id, state?.voiceParticipants]);

  if (error && !state) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader animate={false} />
        <div className="flex flex-1 items-center justify-center p-6">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="w-full max-w-md"
          >
            <GlassPanel className="p-8 text-center">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-crimson-glow">
                Channel closed
              </p>
              <p className="mt-3 text-ink">{error}</p>
              <PrimaryButton className="mt-6" onClick={() => router.replace("/")}>
                Back to hub
              </PrimaryButton>
            </GlassPanel>
          </motion.div>
        </div>
      </div>
    );
  }

  if (!state || !socket) {
    return (
      <div className="flex min-h-screen flex-col">
        <SiteHeader animate={false} />
        <LoadingScreen
          embedded
          message="Linking secure channel…"
          submessage="Connecting to the game server"
        />
      </div>
    );
  }

  const emitSettings = (settings: Partial<RoomSettings>) =>
    socket.emit("lobby:settings", { roomId: state.roomId, settings });
  const emitHostSettings = (settings: Partial<RoomSettings>) =>
    socket.emit("host:settings", { roomId: state.roomId, settings });
  const emitStart = () => {
    if (startingGame) return;
    setStartingGame(true);
    socket.emit("lobby:start", { roomId: state.roomId });
  };
  const emitKick = (playerId: string) =>
    socket.emit("host:kick", { roomId: state.roomId, playerId });
  const emitAddBot = (fillTo?: number) =>
    socket.emit("lobby:addBot", { roomId: state.roomId, fillTo });
  const emitRemoveBot = () =>
    socket.emit("lobby:removeBot", { roomId: state.roomId });
  const emitNight = (type: NightActionType, targetId: string) =>
    socket.emit("night:action", { roomId: state.roomId, type, targetId });
  const emitVote = (targetId: string) =>
    socket.emit("day:vote", { roomId: state.roomId, targetId });
  const emitVoteSkip = () =>
    socket.emit("day:voteSkip", { roomId: state.roomId });
  const emitJuggle = (targetIds: string[]) =>
    socket.emit("day:juggle", { roomId: state.roomId, targetIds });
  const emitFiveAlivePlay = (payload: {
    cardId?: string | null;
    wildValue?: number;
    pass?: boolean;
  }) =>
    socket.emit("fivealive:playCard", {
      roomId: state.roomId,
      cardId: payload.cardId ?? null,
      wildValue: payload.wildValue,
      pass: payload.pass,
    });
  const emitEkPlayCards = (cardIds: string[]) =>
    socket.emit("ek:playCards", { roomId: state.roomId, cardIds });
  const emitEkEndTurn = () =>
    socket.emit("ek:endTurn", { roomId: state.roomId });
  const emitEkDraw = () =>
    socket.emit("ek:draw", { roomId: state.roomId });
  const emitEkNope = (cardId: string) =>
    socket.emit("ek:nope", { roomId: state.roomId, cardId });
  const emitEkPlaceDefuse = (deckIndex: number) =>
    socket.emit("ek:placeDefuse", { roomId: state.roomId, deckIndex });
  const emitEkPickDiscard = (discardIndex: number) =>
    socket.emit("ek:pickDiscard", { roomId: state.roomId, discardIndex });
  const emitEkStealTarget = (targetId: string) =>
    socket.emit("ek:stealTarget", { roomId: state.roomId, targetId });
  const emitEkFavorTarget = (targetId: string) =>
    socket.emit("ek:favorTarget", { roomId: state.roomId, targetId });
  const emitEkFavorGive = (cardId: string) =>
    socket.emit("ek:favorGive", { roomId: state.roomId, cardId });
  const emitEkTripleDeclare = (
    targetId: string,
    cardType: import("@/lib/types").PublicEkCard["type"]
  ) =>
    socket.emit("ek:tripleDeclare", {
      roomId: state.roomId,
      targetId,
      cardType,
    });

  const isEkGame =
    state.gameId === "exploding-kittens" || state.gameId === "detonation-cats";
  const emitChat = (channel: ChatChannel, text: string) => {
    const trimmed = text.trim().slice(0, 240);
    if (!trimmed || !state.you) {
      socket.emit("chat:send", { roomId: state.roomId, channel, text });
      return;
    }
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      channel,
      playerId: state.you.id,
      name: state.you.id
        ? state.players.find((p) => p.id === state.you!.id)?.name ?? "You"
        : "You",
      text: trimmed,
      at: Date.now(),
    };
    setState((prev) =>
      prev
        ? { ...prev, chat: [...prev.chat, optimistic].slice(-50) }
        : prev
    );
    socket.emit("chat:send", { roomId: state.roomId, channel, text: trimmed });
  };

  const localMafia = isLocalMafia(state);

  const voiceChannel = (() => {
    if (localMafia || !state.you) return undefined;
    const channelOpts = {
      alive: state.you.alive,
      role: state.you.role,
      blackmailed: state.you.blackmailed,
      phase: state.phase,
      daySubPhase: state.daySubPhase,
    };
    if (state.gameId === "mafia-city") {
      return availableChannels(channelOpts).find(
        (c) => c === "town" || c === "mafia"
      );
    }
    if (
      state.gameId === "five-alive" &&
      (state.phase === "fivealive_turn" ||
        state.phase === "fivealive_bomb" ||
        state.phase === "fivealive_dealing") &&
      state.you.alive
    ) {
      return "town" as ChatChannel;
    }
    if (
      state.gameId === "tic-tac-toe" &&
      state.phase === "ttt_play" &&
      state.you.alive
    ) {
      return "town" as ChatChannel;
    }
    if (
      state.gameId === "spot-it" &&
      state.phase === "spotit_play" &&
      state.you.alive
    ) {
      return "town" as ChatChannel;
    }
    return undefined;
  })();

  const townVoiceOpen =
    !localMafia &&
    !!state.you &&
    canUseTownVoice({
      alive: state.you.alive,
      role: state.you.role,
      blackmailed: state.you.blackmailed,
      phase: state.phase,
      daySubPhase: state.daySubPhase,
    });

  const pendingAction =
    state.gameId === "mafia-city" ? pendingPlayerAction(state) : null;
  const actionKey = pendingAction
    ? `${state.phase}-${state.daySubPhase}-${pendingAction.title}`
    : null;
  const knowGameActive = knowGame && state.gameId === "five-alive";
  const showAnnouncement =
    !knowGameActive &&
    !!state.announcement &&
    state.announcement.id !== dismissedAnnouncementId &&
    !personalNightPopup &&
    pendingPersonalNightPopups.length === 0;
  const showActionDialog =
    !knowGameActive &&
    !!pendingAction &&
    actionKey !== dismissedActionKey &&
    !showAnnouncement &&
    !personalNightPopup &&
    pendingPersonalNightPopups.length === 0;

  const emitVoiceInvite = (targetId: string) => {
    if (!voiceChannel) return;
    socket.emit("voice:invite", {
      roomId: state.roomId,
      channel: voiceChannel,
      targetId,
    });
  };

  const confirmQuit = () => {
    if (quitting || !socket) return;
    setQuitting(true);
    quittingRef.current = true;
    socket.emit("room:leave", { roomId: state.roomId });
    quitTimeoutRef.current = setTimeout(() => {
      finishLeaveRef.current();
    }, 2500);
  };

  return (
    <motion.div
      data-phase={state.phase}
      animate={{ backgroundColor: "#E8DCC8" }}
      className="min-h-screen"
    >
      <SiteHeader
        animate={false}
        right={
          <GameHud
            state={state}
            knowGame={knowGame}
            onKnowGameChange={
              state.gameId === "five-alive" ? setKnowGame : undefined
            }
            onPause={() =>
              socket.emit("host:pause", {
                roomId: state.roomId,
                playerId: state.you?.id,
              })
            }
            onResume={() =>
              socket.emit("host:resume", {
                roomId: state.roomId,
                playerId: state.you?.id,
              })
            }
            onQuit={() => setQuitConfirmOpen(true)}
            onSettings={
              (state.gameId === "mafia-city" || state.gameId === "five-alive") &&
              state.you?.isHost
                ? emitHostSettings
                : undefined
            }
            quitting={quitting}
          />
        }
      />

      {lobbyIdleWarning && state.phase === "lobby" && state.you?.isHost && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-[20px]">
          <GlassPanel className="w-full max-w-md p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-crimson-glow">
              Host offline
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">
              {lobbyIdleWarning.isFinal
                ? "Lobby closing now"
                : lobbyIdleWarning.stage === 1
                  ? "Offline 30 seconds"
                  : "Offline 1 minute"}
            </h2>
            <p className="mt-3 text-sm text-ink-steel">{lobbyIdleWarning.message}</p>
            {!lobbyIdleWarning.isFinal && (
              <button
                type="button"
                onClick={() => setLobbyIdleWarning(null)}
                className="mt-6 w-full rounded-sm border border-crimson bg-crimson py-3 font-mono text-xs uppercase tracking-widest text-manila"
              >
                Got it
              </button>
            )}
          </GlassPanel>
        </div>
      )}
      {!knowGameActive && personalNightPopup && (
        <PhaseResultPopup
          announcement={{
            id: personalNightPopup.id,
            tone: personalNightPopup.tone,
            title: personalNightPopup.title,
            detail: personalNightPopup.detail,
            at: Date.now(),
          }}
          durationMs={5500}
          onDismiss={() => setPersonalNightPopup(null)}
        />
      )}
      {showAnnouncement && state.announcement && (
        <PhaseResultPopup
          announcement={announcementForViewer(state.announcement, state)}
          durationMs={state.gameId === "five-alive" ? 4500 : undefined}
          skipScrollToTop={state.gameId === "five-alive"}
          onDismiss={() =>
            setDismissedAnnouncementId(state.announcement!.id)
          }
        />
      )}
      {showActionDialog && pendingAction && (
        <ActionDialog
          title={pendingAction.title}
          detail={pendingAction.detail}
          onDismiss={() => setDismissedActionKey(actionKey)}
        />
      )}
      {mafiaVoiceWarning && (
        <div className="mx-auto mb-4 max-w-6xl px-4 md:px-8">
          <div className="rounded-sm border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson">
            Day breaks in under 10 seconds — mafia voice will close at dawn.
          </div>
        </div>
      )}

      <main
        className={`mx-auto max-w-6xl px-3 sm:px-4 md:px-8 ${
          state.gameId === "connect-4" && state.phase === "connect4_play"
            ? "pb-4"
            : state.gameId === "five-alive" &&
                state.phase !== "lobby" &&
                state.phase !== "gameover"
              ? "overflow-x-hidden pb-[max(2rem,env(safe-area-inset-bottom))] sm:pb-16"
              : "pb-8 sm:pb-16"
        }`}
      >
        {state.paused &&
          state.phase !== "lobby" &&
          state.phase !== "gameover" && (
          <div className="mb-4 rounded-sm border border-crimson/40 bg-crimson/10 px-4 py-3 text-sm text-crimson">
            Game paused by the host — timer and actions are frozen.
          </div>
        )}
        {voiceInvite &&
          (state.gameId === "mafia-city" || state.gameId === "five-alive") &&
          !localMafia &&
          !state.spectatorMode && (
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-sm border border-crimson/40 bg-crimson/10 px-4 py-3">
            <p className="text-sm text-crimson">
              <span className="font-semibold">{voiceInvite.fromName}</span> wants
              you on {CHANNEL_LABELS[voiceInvite.channel]} voice.
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setJoinVoiceRequest({
                    nonce: Date.now(),
                    channel: voiceInvite.channel,
                  });
                  setVoiceInvite(null);
                }}
                className="inline-flex items-center gap-1 rounded-sm bg-crimson/20 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-crimson"
              >
                <Mic size={12} /> Join voice
              </button>
              <button
                type="button"
                onClick={() => setVoiceInvite(null)}
                className="px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-steel"
              >
                Later
              </button>
            </div>
          </div>
        )}
        {state.gameId !== "five-alive" && <ActionPrompt state={state} />}
        {state.gameId === "mafia-city" &&
          state.spectatorMode &&
          state.phase !== "lobby" &&
          state.phase !== "gameover" && (
          <SpectatorBanner external />
        )}
        {state.gameId === "mafia-city" &&
          state.you &&
          !state.spectatorMode &&
          !state.you.alive &&
          state.phase !== "lobby" &&
          state.phase !== "gameover" && (
            <SpectatorBanner
              canVoteDead={state.you.role === "villager"}
            />
          )}
        {state.phase === "gameover" && state.gameId === "battleship" ? (
          <BattleshipTable
            state={state}
            socket={socket}
            returning={returningToLobby}
            onReturn={() => {
              if (returningToLobby) return;
              setReturningToLobby(true);
              socket.emit("lobby:return", { roomId: state.roomId });
            }}
          />
        ) : state.phase === "gameover" ? (
          <GameOverScreen
            state={state}
            returning={returningToLobby}
            onReturn={() => {
              if (returningToLobby) return;
              setReturningToLobby(true);
              socket.emit("lobby:return", { roomId: state.roomId });
            }}
          />
        ) : (
        <AnimatePresence mode="wait">
          <motion.div
            // Keep turn+bomb on one key so bomb resolution does not remount
            // under opacity:0 (blank manila screen with only the banner).
            key={
              state.gameId === "five-alive" &&
              (state.phase === "fivealive_turn" ||
                state.phase === "fivealive_bomb" ||
                state.phase === "fivealive_dealing")
                ? "five-alive-play"
                : state.phase
            }
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {state.phase === "lobby" && (
              <>
                {state.gameId === "five-alive" ? (
                  <FiveAliveLobbyView
                    state={state}
                    onStart={emitStart}
                    starting={startingGame}
                    onSettings={emitSettings}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                  />
                ) : isEkGame ? (
                  <ExplodingKittensLobbyView
                    state={state}
                    onStart={emitStart}
                    starting={startingGame}
                    onSettings={emitSettings}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                  />
                ) : state.gameId === "spot-it" ? (
                  <SpotItLobbyView
                    state={state}
                    onStart={emitStart}
                    starting={startingGame}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                  />
                ) : state.gameId === "tic-tac-toe" ? (
                  <BoardLobbyView
                    state={state}
                    title="Tic-Tac-Toe"
                    blurb="Classic 3×3. First to three in a row wins."
                    onStart={emitStart}
                    starting={startingGame}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                    onSettings={emitSettings}
                  />
                ) : state.gameId === "connect-4" ? (
                  <BoardLobbyView
                    state={state}
                    title="Connect 4"
                    blurb="Drop discs. Connect four to win."
                    onStart={emitStart}
                    starting={startingGame}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                    onSettings={emitSettings}
                  />
                ) : state.gameId === "battleship" ? (
                  <BoardLobbyView
                    state={state}
                    title="Tactical Battleship"
                    blurb="Place your fleet. Spend AP on sonar, cluster, torpedo, smoke, and recon."
                    onStart={emitStart}
                    starting={startingGame}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                    onSettings={emitSettings}
                  />
                ) : (
                  <LobbyView
                    state={state}
                    onStart={emitStart}
                    starting={startingGame}
                    onSettings={emitSettings}
                    onKick={emitKick}
                    onAddBot={emitAddBot}
                    onRemoveBot={emitRemoveBot}
                  />
                )}
              </>
            )}

            {state.spectatorMode &&
              state.gameId === "mafia-city" &&
              (state.phase === "night" || state.phase === "day") && (
                <div className="space-y-4">
                  <AnnouncementsPanel logs={state.logs} />
                  <PlayerGrid
                    state={state}
                    showVotes={state.daySubPhase === "vote"}
                  />
                </div>
              )}

            {state.spectatorMode &&
              state.gameId !== "mafia-city" &&
              state.phase !== "lobby" && (
                <GlassPanel className="p-4">
                  <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                    Live match
                  </h3>
                  <ul className="mt-2 space-y-1 text-sm text-ink-steel">
                    {state.logs.slice(-12).map((l) => (
                      <li key={l.id}>{l.text}</li>
                    ))}
                  </ul>
                </GlassPanel>
              )}

            {!state.spectatorMode &&
              state.gameId === "spot-it" &&
              state.phase === "spotit_play" && (
              <SpotItTable
                state={state}
                socket={socket}
                onMatch={(symbolId) =>
                  socket.emit("spotit:submitMatch", {
                    roomId: state.roomId,
                    symbolId,
                  })
                }
                onSendChat={emitChat}
                enableVoice={townVoiceOpen}
                joinVoiceRequest={joinVoiceRequest}
                onVoiceJoined={clearVoiceInviteForChannel}
              />
            )}

            {!state.spectatorMode &&
              state.gameId === "tic-tac-toe" &&
              state.phase === "ttt_play" && (
              <TttBoard
                state={state}
                socket={socket}
                onMove={(cellIndex) =>
                  socket.emit("ttt:move", { roomId: state.roomId, cellIndex })
                }
                onSendChat={emitChat}
                enableVoice={townVoiceOpen}
                joinVoiceRequest={joinVoiceRequest}
                onVoiceJoined={clearVoiceInviteForChannel}
              />
            )}

            {!state.spectatorMode &&
              state.gameId === "connect-4" &&
              state.phase === "connect4_play" && (
              <Connect4Board
                state={state}
                onDrop={(column) =>
                  socket.emit("connect4:drop", { roomId: state.roomId, column })
                }
              />
            )}

            {!state.spectatorMode &&
              state.gameId === "battleship" &&
              (state.phase === "battleship_setup" ||
                state.phase === "battleship_play") && (
              <BattleshipTable state={state} socket={socket} />
            )}

            {!state.spectatorMode && state.phase === "reveal" && (
              <>
                {(state.you?.role ?? localReveal?.role) ? (
                  <RoleRevealCard
                    role={(state.you?.role ?? localReveal!.role) as Role}
                    phaseEndsAt={state.phaseEndsAt}
                  />
                ) : (
                  <div className="flex min-h-[60vh] flex-col items-center justify-center">
                    <p className="font-mono text-xs uppercase tracking-[0.3em] text-crimson-glow">
                      Sealing identity…
                    </p>
                    <p className="mt-2 text-sm text-ink-steel">
                      Your role card is being delivered.
                    </p>
                  </div>
                )}
              </>
            )}

            {!state.spectatorMode &&
              state.gameId === "five-alive" &&
              (state.phase === "fivealive_dealing" ||
                state.phase === "fivealive_turn" ||
                state.phase === "fivealive_bomb") && (
              <div className="grid min-w-0 gap-3 sm:gap-6 lg:grid-cols-[1fr_340px]">
                <div className="min-w-0 overflow-x-hidden">
                  <FiveAlivePlayPanel
                    state={state}
                    paused={state.paused}
                    onPlay={(payload) => emitFiveAlivePlay(payload)}
                    onRespond={(payload) => emitFiveAlivePlay(payload)}
                    onInviteVoice={voiceChannel ? emitVoiceInvite : undefined}
                  />
                </div>
                <FiveAliveSidebar
                  state={state}
                  socket={socket}
                  onSend={emitChat}
                  logTitle={
                    state.phase === "fivealive_bomb"
                      ? "Bomb log"
                      : state.phase === "fivealive_dealing"
                        ? "Deal log"
                        : "Game log"
                  }
                  enableVoice={townVoiceOpen}
                  joinVoiceRequest={joinVoiceRequest}
                  onVoiceJoined={clearVoiceInviteForChannel}
                />
              </div>
            )}

            {!state.spectatorMode &&
              isEkGame &&
              (state.phase === "ek_turn" ||
                state.phase === "ek_defuse" ||
                state.phase === "ek_pick_discard" ||
                state.phase === "ek_steal" ||
                state.phase === "ek_favor" ||
                state.phase === "ek_triple") && (
              <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
                <ExplodingKittensTable
                  state={state}
                  onPlayCards={emitEkPlayCards}
                  onEndTurn={emitEkEndTurn}
                  onDraw={emitEkDraw}
                  onNope={emitEkNope}
                  onPlaceDefuse={emitEkPlaceDefuse}
                  onPickDiscard={emitEkPickDiscard}
                  onStealTarget={emitEkStealTarget}
                  onFavorTarget={emitEkFavorTarget}
                  onFavorGive={emitEkFavorGive}
                  onTripleDeclare={emitEkTripleDeclare}
                />
                <div className="space-y-4">
                  <GlassPanel className="p-4">
                    <h3 className="font-mono text-[10px] uppercase tracking-widest text-ink-steel">
                      Game log
                    </h3>
                    <ul className="mt-2 space-y-1 text-sm text-ink-steel">
                      {state.logs.slice(-8).map((l) => (
                        <li key={l.id}>{l.text}</li>
                      ))}
                    </ul>
                  </GlassPanel>
                  <ChatPanel
                    state={state}
                    socket={socket}
                    onSend={emitChat}
                    enableVoice={townVoiceOpen}
                    joinVoiceRequest={joinVoiceRequest}
                    onVoiceJoined={clearVoiceInviteForChannel}
                  />
                </div>
              </div>
            )}

            {state.gameId === "mafia-city" && state.phase === "night" && !state.spectatorMode && (
              <div
                className={`grid gap-6 ${
                  localMafia ? "" : "lg:grid-cols-[1fr_340px]"
                }`}
              >
                <div className="space-y-4">
                  {!localMafia && <AnnouncementsPanel logs={state.logs} />}
                  <DayIntelPanel intel={state.dayIntel} />
                  <NightActionPanel
                    state={state}
                    onAct={emitNight}
                    onInviteVoice={
                      !localMafia && voiceChannel
                        ? emitVoiceInvite
                        : undefined
                    }
                  />
                </div>
                {!localMafia && (
                  <div className="space-y-4 max-md:hidden">
                    <ChatPanel
                      state={state}
                      socket={socket}
                      onSend={emitChat}
                      joinVoiceRequest={joinVoiceRequest}
                      onVoiceJoined={clearVoiceInviteForChannel}
                    />
                  </div>
                )}
              </div>
            )}

            {state.gameId === "mafia-city" && state.phase === "day" && !state.spectatorMode && (
              <div
                className={`grid gap-6 ${
                  localMafia ? "" : "lg:grid-cols-[1fr_340px]"
                }`}
              >
                <div className="space-y-4">
                  {!localMafia && <AnnouncementsPanel logs={state.logs} />}
                  <DayIntelPanel intel={state.dayIntel} />
                  <VotePanel
                    state={state}
                    onVote={emitVote}
                    onSkipVote={emitVoteSkip}
                    onSkipDay={() =>
                      socket.emit("host:skipDay", { roomId: state.roomId })
                    }
                    onSkipTimer={() =>
                      socket.emit("host:skipTimer", { roomId: state.roomId })
                    }
                    onJuggle={emitJuggle}
                    onInviteVoice={
                      !localMafia && townVoiceOpen && voiceChannel
                        ? emitVoiceInvite
                        : undefined
                    }
                  />
                </div>
                {!localMafia && (
                  <div className="space-y-4 max-md:hidden">
                    <ChatPanel
                      state={state}
                      socket={socket}
                      onSend={emitChat}
                      joinVoiceRequest={joinVoiceRequest}
                      onVoiceJoined={clearVoiceInviteForChannel}
                    />
                  </div>
                )}
              </div>
            )}

            {state.gameId === "mafia-city" &&
              !localMafia &&
              !state.spectatorMode &&
              (state.phase === "night" || state.phase === "day") && (
                <div className="md:hidden">
                  <ChatPanel
                    state={state}
                    socket={socket}
                    onSend={emitChat}
                    enableVoice={townVoiceOpen}
                    joinVoiceRequest={joinVoiceRequest}
                    onVoiceJoined={clearVoiceInviteForChannel}
                    mobileBubble
                    hasVoiceInvite={!!voiceInvite}
                  />
                </div>
              )}

            {state.gameId === "five-alive" &&
              !state.spectatorMode &&
              (state.phase === "fivealive_turn" ||
                state.phase === "fivealive_bomb" ||
                state.phase === "fivealive_dealing") && (
                <div className="md:hidden">
                  <ChatPanel
                    state={state}
                    socket={socket}
                    onSend={emitChat}
                    enableVoice={townVoiceOpen}
                    joinVoiceRequest={joinVoiceRequest}
                    onVoiceJoined={clearVoiceInviteForChannel}
                    mobileBubble
                    hasVoiceInvite={!!voiceInvite}
                  />
                </div>
              )}
          </motion.div>
        </AnimatePresence>
        )}
      </main>
      {quitConfirmOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-[20px]"
          data-lenis-prevent
        >
          <GlassPanel className="w-full max-w-md p-8">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-crimson-glow">
              Leave session
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Quit this game?</h2>
            <p className="mt-3 text-sm text-ink-steel">
              {state.phase === "lobby"
                ? "You will leave the lobby and return to the hub."
                : "You will leave the match and return to the hub. Other players can keep playing."}
            </p>
            <div className="mt-6 flex flex-col gap-2">
              <PrimaryButton disabled={quitting} onClick={confirmQuit}>
                {quitting ? "Leaving…" : "Yes, quit"}
              </PrimaryButton>
              <button
                type="button"
                disabled={quitting}
                onClick={() => setQuitConfirmOpen(false)}
                className="rounded-sm border border-crimson/20 py-3 font-mono text-xs uppercase tracking-widest disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </GlassPanel>
        </div>
      )}

    </motion.div>
  );
}
