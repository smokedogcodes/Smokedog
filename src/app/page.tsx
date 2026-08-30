"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { ArrowRight, Clock, Users } from "lucide-react";
import { OpenLobbies } from "@/components/hub/OpenLobbies";
import { ProfileModal } from "@/components/hub/ProfileModal";
import { GameRulesModal } from "@/components/game/mafia/GameRulesModal";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { fadeUp, stagger } from "@/components/ui/motion";
import {
  ensurePlayerId,
  loadProfile,
  randomAvatarId,
  saveProfile,
} from "@/lib/profile";
import { getSocket } from "@/lib/socket/client";
import { getGameModule } from "@/lib/games/registry";
import { emitPageView } from "@/lib/analytics-beacon";
import type { PublicGameState } from "@/lib/types";

type HubPending = "create" | "join" | null;

type GameCard = {
  id: string;
  title: string;
  pitch: string;
  players: string;
  duration: string;
  image: string;
  badge: string;
  badgeTone?: "crimson" | "amber" | "steel";
  disabled?: boolean;
  moreInfo?: boolean;
};

function resolveGameCard(card: GameCard): GameCard {
  if (card.id === "mafia-city") return card;

  try {
    const mod = getGameModule(card.id);
    if (mod.status === "maintenance") {
      return {
        ...card,
        badge: "Under maintenance",
        badgeTone: "amber",
        disabled: true,
      };
    }
    if (mod.status === "coming_soon") {
      return {
        ...card,
        badge: "Coming soon",
        badgeTone: "steel",
        disabled: false,
      };
    }
    if (mod.status === "live") {
      return {
        ...card,
        badge: "Live",
        badgeTone: undefined,
        disabled: false,
      };
    }
  } catch {
    /* registry will validate on create */
  }

  return card;
}

const GAME_CARDS: GameCard[] = [
  {
    id: "mafia-city",
    title: "Mafia City",
    pitch: "The city's last night. Trust no one. Vote wisely.",
    players: "4+ Players",
    duration: "15–30 Min",
    image: "/games/mafia-city.jpg",
    badge: "Featured",
    moreInfo: true,
  },
  {
    id: "spot-it",
    title: "Spot It",
    pitch: "Race to match the one shared symbol. First click claims the card.",
    players: "2–8 Players",
    duration: "Real-time",
    image: "/games/spot-it.jpg",
    badge: "Live",
    moreInfo: true,
  },
  {
    id: "tic-tac-toe",
    title: "Tic-Tac-Toe",
    pitch: "Classic 3×3 duel. Hover to preview. First to three wins.",
    players: "2 Players",
    duration: "Turn-based",
    image: "/games/tic-tac-toe.jpg",
    badge: "Live",
    moreInfo: true,
  },
  {
    id: "connect-4",
    title: "Connect 4",
    pitch: "Drop discs with gravity. Connect four in a row to win.",
    players: "2 Players",
    duration: "Turn-based",
    image: "/games/connect-4.jpg",
    badge: "Live",
    moreInfo: true,
  },
  {
    id: "five-alive",
    title: "5 Alive",
    pitch: "Keep it under 21. Busts cost lives. Bombs demand instant 0s.",
    players: "2–6 Players",
    duration: "Turn-based",
    image: "/games/five-alive.jpg",
    badge: "Live",
    moreInfo: true,
  },
  {
    id: "exploding-kittens",
    title: "Exploding Kittens",
    pitch: "Draw carefully. Defuse the kitten. Last player standing wins.",
    players: "2–5 Players",
    duration: "Turn-based",
    image: "/games/exploding-kittens.jpg",
    badge: "Live",
    moreInfo: true,
  },
];

export default function HomePage() {
  const router = useRouter();
  const [modal, setModal] = useState(false);
  const [modalMode, setModalMode] = useState<"create" | "join">("create");
  const [profileOnly, setProfileOnly] = useState(false);
  const [prefillCode, setPrefillCode] = useState("");
  const [createGameId, setCreateGameId] = useState<string>("mafia-city");
  const createGameIdRef = useRef<string>("mafia-city");
  const [profile, setProfile] = useState(() => loadProfile());
  const [guestAvatarId] = useState(() => randomAvatarId());
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<HubPending>(null);
  const pendingRef = useRef<HubPending>(null);
  const pendingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [joiningCode, setJoiningCode] = useState<string | null>(null);
  const [rulesGameId, setRulesGameId] = useState<string | null>(null);

  useEffect(() => {
    emitPageView({ path: "/", onceKey: "hub" });
  }, []);

  const setHubPending = (next: HubPending) => {
    pendingRef.current = next;
    setPending(next);
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
  };

  const clearHubPending = () => {
    if (pendingTimerRef.current) {
      clearTimeout(pendingTimerRef.current);
      pendingTimerRef.current = null;
    }
    pendingRef.current = null;
    setPending(null);
  };

  const beginHubPending = (next: HubPending) => {
    setHubPending(next);
    pendingTimerRef.current = setTimeout(() => {
      if (!pendingRef.current) return;
      clearHubPending();
      setJoiningCode(null);
      setError(
        "Game server timed out. Check your connection and try again."
      );
    }, 20_000);
  };

  const setPendingGameId = (gameId: string) => {
    createGameIdRef.current = gameId;
    setCreateGameId(gameId);
  };

  const hubBoundRef = useRef(false);

  const bindHubSocket = (playerId: string) => {
    const socket = getSocket(playerId);
    if (hubBoundRef.current) return socket;

    const onError = ({ message }: { message: string }) => {
      if (!pendingRef.current) return;
      clearHubPending();
      setJoiningCode(null);
      setError(message);
    };

    const onConnectError = (err: Error) => {
      if (!pendingRef.current) return;
      clearHubPending();
      setJoiningCode(null);
      setError(`Could not reach game server: ${err.message}`);
    };

    const onState = (state: PublicGameState) => {
      if (!pendingRef.current) return;
      const mode = pendingRef.current;
      if (mode === "create") {
        const requested = createGameIdRef.current;
        if (requested && state.gameId !== requested) {
          clearHubPending();
          setJoiningCode(null);
          setError(
            `Server started ${state.gameId} instead of ${requested}. The game server may need a redeploy — try again in a minute.`
          );
          return;
        }
      }
      setError(null);
      clearHubPending();
      setJoiningCode(null);
      router.push(`/room/${state.roomId}`);
    };

    socket.on("room:error", onError);
    socket.on("connect_error", onConnectError);
    socket.on("room:state", onState);
    hubBoundRef.current = true;
    return socket;
  };

  useEffect(() => {
    setProfile(loadProfile());
    const p = loadProfile();
    if (p) bindHubSocket(p.playerId);
    return () => {
      if (pendingTimerRef.current) {
        clearTimeout(pendingTimerRef.current);
        pendingTimerRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router]);

  const persist = (name: string, avatarId: number) => {
    const playerId = ensurePlayerId();
    const next = { playerId, name, avatarId };
    saveProfile(next);
    setProfile(next);
    bindHubSocket(playerId);
    return next;
  };

  const emitHub = (playerId: string) => getSocket(playerId);

  const onCreate = (
    name: string,
    avatarId: number,
    opts?: { localMode?: boolean }
  ) => {
    if (pending) return;
    try {
      const mod = getGameModule(createGameIdRef.current);
      if (mod.status === "maintenance") {
        setError(`${mod.displayName} is under maintenance.`);
        return;
      }
    } catch {
      /* server will validate */
    }
    setError(null);
    beginHubPending("create");
    setJoiningCode(null);
    const p = persist(name, avatarId);
    const socket = emitHub(p.playerId);
    const payload = {
      playerId: p.playerId,
      name: p.name,
      avatarId: p.avatarId,
      gameId: createGameIdRef.current,
      localMode:
        createGameIdRef.current === "mafia-city"
          ? !!opts?.localMode
          : undefined,
    };
    const send = () => socket.emit("room:create", payload);
    if (socket.connected) send();
    else socket.once("connect", send);
  };

  const onJoin = (name: string, avatarId: number, code: string) => {
    if (pending) return;
    setError(null);
    beginHubPending("join");
    setJoiningCode(code);
    const p = persist(name, avatarId);
    const socket = emitHub(p.playerId);
    const payload = {
      roomId: code,
      playerId: p.playerId,
      name: p.name,
      avatarId: p.avatarId,
    };
    const send = () => socket.emit("room:join", payload);
    if (socket.connected) send();
    else socket.once("connect", send);
  };

  const joinWithProfile = (code: string) => {
    if (pending) return;
    const p = loadProfile();
    if (!p?.name) {
      setPrefillCode(code);
      setModalMode("join");
      setModal(true);
      return;
    }
    onJoin(p.name, p.avatarId, code);
  };

  const openCreate = (gameId: string) => {
    if (pending) return;
    try {
      const mod = getGameModule(gameId);
      if (mod.status === "maintenance") {
        setError(`${mod.displayName} is under maintenance.`);
        return;
      }
    } catch {
      /* ignore */
    }
    setError(null);
    setPendingGameId(gameId);
    setPrefillCode("");
    setProfileOnly(false);
    setModalMode("create");
    setModal(true);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-manila">
      <div className="pointer-events-none absolute inset-0 animate-pulse-slow bg-[radial-gradient(ellipse_at_top,rgba(139,30,30,0.12),transparent_55%)]" />
      <SiteHeader
        avatarId={profile?.avatarId ?? guestAvatarId}
        onAvatarClick={() => {
          setProfileOnly(true);
          setPrefillCode("");
          setPendingGameId("");
          setModalMode("create");
          setModal(true);
        }}
      />

      <motion.main
        variants={stagger}
        initial="hidden"
        animate="show"
        className="relative mx-auto max-w-6xl px-6 pb-16 pt-6 md:px-10 md:pt-8"
      >
        <OpenLobbies
          onJoin={joinWithProfile}
          joiningCode={joiningCode}
          joinPending={pending === "join"}
          onNeedProfile={(code) => {
            if (pending) return;
            setError(null);
            setPrefillCode(code ?? "");
            setModalMode("join");
            setModal(true);
          }}
        />

        <motion.div variants={fadeUp} className="mt-14">
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-crimson-glow">
            Operations
          </p>
          <h2 className="mt-2 font-display text-3xl font-bold">
            Select your battlefield
          </h2>
        </motion.div>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {GAME_CARDS.map((raw) => {
            const card = resolveGameCard(raw);
            return (
            <div key={card.id} className="relative">
              <motion.button
                variants={fadeUp}
                type="button"
                disabled={card.disabled || !!pending}
                onClick={() => {
                  if (card.disabled) return;
                  openCreate(card.id);
                }}
                whileHover={card.disabled ? undefined : { scale: 1.01 }}
                whileTap={card.disabled ? undefined : { scale: 0.995 }}
                className={`group relative w-full overflow-hidden rounded-sm text-left ${
                  card.disabled ? "cursor-not-allowed opacity-60" : ""
                }`}
              >
                <img
                  src={card.image}
                  alt=""
                  className="h-[240px] w-full object-cover object-center opacity-50 transition duration-700 group-hover:scale-105 md:h-[320px]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-manila via-manila/70 to-transparent" />
                <div className="absolute inset-0 p-6 md:p-8">
                  <span
                    className={`rounded-sm px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                      card.badgeTone === "amber"
                        ? "border border-crimson bg-manila text-crimson"
                        : "bg-crimson text-manila"
                    }`}
                  >
                    {card.badge}
                  </span>
                  <h3 className="mt-5 font-display text-3xl font-bold text-crimson md:text-4xl">
                    {card.title}
                  </h3>
                  <p className="mt-2 max-w-lg text-sm text-crimson/75 md:text-base">
                    {card.pitch}
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-5 font-mono text-xs uppercase tracking-wider text-crimson/60">
                    <span className="inline-flex items-center gap-2">
                      <Users size={14} /> {card.players}
                    </span>
                    <span className="inline-flex items-center gap-2">
                      <Clock size={14} /> {card.duration}
                    </span>
                  </div>
                  <span className="mt-6 inline-flex items-center gap-2 font-mono text-xs font-bold uppercase tracking-widest text-crimson">
                    {card.disabled ? "Unavailable" : "Play now"}{" "}
                    {!card.disabled && (
                      <ArrowRight
                        size={16}
                        className="transition group-hover:translate-x-1"
                      />
                    )}
                  </span>
                </div>
              </motion.button>
              {card.moreInfo && (
                <button
                  type="button"
                  onClick={() => setRulesGameId(card.id)}
                  className="absolute bottom-6 right-6 z-10 rounded-sm border border-crimson/40 bg-manila/90 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-crimson transition hover:border-crimson hover:bg-manila md:bottom-8 md:right-8"
                >
                  More info
                </button>
              )}            </div>
            );
          })}
        </div>
      </motion.main>
      <GameRulesModal
        open={!!rulesGameId}
        gameId={rulesGameId}
        onClose={() => setRulesGameId(null)}
      />

      <ProfileModal
        open={modal}
        defaultName={profile?.name ?? ""}
        defaultAvatar={profile?.avatarId ?? guestAvatarId}
        createGameId={profileOnly ? undefined : createGameId}
        error={error}
        initialCode={prefillCode}
        initialMode={modalMode}
        pending={pending}
        profileOnly={profileOnly}
        onClose={() => {
          setModal(false);
          setProfileOnly(false);
          setError(null);
          setHubPending(null);
          setJoiningCode(null);
        }}
        onSaveProfile={(name, avatarId) => {
          persist(name, avatarId);
          setModal(false);
          setProfileOnly(false);
        }}
        onCreate={onCreate}
        onJoin={onJoin}
      />

      {pending && !modal && (
        <div className="fixed inset-x-0 bottom-6 z-40 flex justify-center px-4">
          <div className="inline-flex items-center gap-2 rounded-sm border border-crimson/20 bg-surface/95 px-4 py-3 font-mono text-[10px] uppercase tracking-widest text-ink shadow-lg backdrop-blur-md">
            <LoadingSpinner size={14} />
            {pending === "create" ? "Creating party…" : "Joining party…"}
          </div>
        </div>
      )}
    </div>
  );
}
