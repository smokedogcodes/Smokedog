"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { motion } from "framer-motion";
import { RefreshCw, Search, Users } from "lucide-react";
import { LoadingSpinner } from "@/components/ui/LoadingSpinner";
import { PlayerAvatar } from "@/components/ui/PlayerAvatar";
import { GlassPanel, PrimaryButton } from "@/components/ui/primitives";
import { fadeUp } from "@/components/ui/motion";
import { getSocket } from "@/lib/socket/client";
import { ensurePlayerId, loadProfile } from "@/lib/profile";
import { gameLabel } from "@/lib/games/labels";
import type { LiveGameListing, OpenLobby } from "@/lib/types";

type PartyFilter = "open" | "all";

type PartyRow =
  | { kind: "open"; lobby: OpenLobby }
  | { kind: "live"; game: LiveGameListing };

function MetaChip({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "live" | "progress";
}) {
  const tones = {
    neutral: "border-crimson/30 text-crimson/80 bg-manila",
    live: "border-crimson/50 text-crimson bg-crimson/5",
    progress: "border-crimson/40 text-crimson/90 bg-manila",
  };
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-sm border px-3 py-1 font-mono text-xs uppercase tracking-[0.14em] ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

function PartyCard({
  roomId,
  hostName,
  hostAvatarId,
  metaLine,
  chips,
  action,
}: {
  roomId: string;
  hostName: string;
  hostAvatarId: number;
  metaLine: string;
  chips: ReactNode;
  action: ReactNode;
}) {
  return (
    <GlassPanel
      variant="paper"
      className="flex flex-wrap items-center justify-between gap-5 p-5 md:p-6"
    >
      <div className="flex min-w-0 items-center gap-4 md:gap-5">
        <PlayerAvatar id={hostAvatarId} size={56} />
        <div className="min-w-0">
          <p className="font-mono text-xl font-bold tracking-[0.22em] text-crimson md:text-2xl">
            {roomId}
          </p>
          <p className="mt-1.5 text-base text-ink md:text-lg">
            Host{" "}
            <span className="font-display text-lg font-bold text-crimson md:text-xl">
              {hostName}
            </span>
          </p>
          <p className="mt-1 font-mono text-sm uppercase tracking-[0.16em] text-ink-steel">
            {metaLine}
          </p>
        </div>
      </div>
      <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto sm:justify-end">
        {chips}
        {action}
      </div>
    </GlassPanel>
  );
}

export function OpenLobbies({
  onJoin,
  onNeedProfile,
  joiningCode = null,
  joinPending = false,
}: {
  onJoin: (code: string) => void;
  onNeedProfile: (code?: string) => void;
  joiningCode?: string | null;
  joinPending?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PartyFilter>("open");
  const [lobbies, setLobbies] = useState<OpenLobby[]>([]);
  const [liveGames, setLiveGames] = useState<LiveGameListing[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const playerId = ensurePlayerId();
    const socket = getSocket(playerId);
    const onList = ({ lobbies: next }: { lobbies: OpenLobby[] }) => {
      setLobbies(next);
      setLoading(false);
    };
    const onLive = ({ games: next }: { games: LiveGameListing[] }) => {
      setLiveGames(next);
      setLoading(false);
    };
    socket.on("lobbies:list", onList);
    socket.on("games:live", onLive);
    socket.emit("lobbies:list");
    socket.emit("games:listLive");
    const poll = setInterval(() => {
      socket.emit("lobbies:list");
      socket.emit("games:listLive");
    }, 4000);
    return () => {
      socket.off("lobbies:list", onList);
      socket.off("games:live", onLive);
      clearInterval(poll);
    };
  }, []);

  const rows = useMemo((): PartyRow[] => {
    const q = query.trim().toUpperCase();
    const matchesQuery = (roomId: string, hostName: string) =>
      !q || roomId.includes(q) || hostName.toUpperCase().includes(q);

    const openRows: PartyRow[] = lobbies
      .filter((l) => matchesQuery(l.roomId, l.hostName))
      .map((lobby) => ({ kind: "open", lobby }));

    if (filter === "open") return openRows;

    const liveRows: PartyRow[] = liveGames
      .filter((g) => matchesQuery(g.roomId, g.hostName))
      .map((game) => ({ kind: "live", game }));

    return [...liveRows, ...openRows];
  }, [lobbies, liveGames, query, filter]);

  const firstJoinable = rows.find((r) => r.kind === "open");
  const busy = joinPending;

  const join = (code: string) => {
    if (busy) return;
    const profile = loadProfile();
    if (!profile?.name || profile.name.trim().length < 2) {
      onNeedProfile(code);
      return;
    }
    onJoin(code);
  };

  const quickAction = () => {
    if (firstJoinable?.kind === "open") join(firstJoinable.lobby.roomId);
  };

  const quickJoinTarget =
    firstJoinable?.kind === "open" ? firstJoinable.lobby.roomId : null;
  const quickLoading =
    joinPending && quickJoinTarget && joiningCode === quickJoinTarget;

  const joinButtonClass =
    "inline-flex min-w-[96px] items-center justify-center gap-2 rounded-sm bg-crimson px-5 py-3 font-display text-sm font-bold uppercase tracking-wider text-manila shadow-glow transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50";

  return (
    <motion.section variants={fadeUp} className="mt-2">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs uppercase tracking-[0.22em] text-crimson-glow">
            Index
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold md:text-3xl">
            Open case files
          </h2>
          <p className="mt-1 text-base text-ink-steel">
            {filter === "open"
              ? "Live rooms with empty seats — stamp in."
              : "All active parties — join open seats; in-progress matches are listed for awareness only."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            const s = getSocket(ensurePlayerId());
            s.emit("lobbies:list");
            s.emit("games:listLive");
          }}
          className="inline-flex items-center gap-2 rounded-sm border border-crimson/20 px-4 py-2.5 font-mono text-xs uppercase tracking-widest text-ink-steel transition hover:text-ink"
        >
          <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
      </div>

      <div className="mt-5 flex flex-col gap-3 lg:flex-row lg:items-stretch">
        <label className="relative min-w-0 flex-1">
          <Search
            size={16}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-steel"
          />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value.toUpperCase())}
            placeholder="Search by code or host name"
            className="h-full w-full rounded-sm border border-crimson/30 bg-manila py-3.5 pl-10 pr-3 font-mono text-base tracking-wider text-crimson outline-none focus:border-crimson"
          />
        </label>
        <div
          className="inline-flex shrink-0 self-center rounded-sm border border-crimson/30 bg-manila p-1"
          role="group"
          aria-label="Party filter"
        >
          <button
            type="button"
            onClick={() => setFilter("open")}
            className={`rounded-sm px-4 py-3 font-mono text-xs uppercase tracking-widest transition ${
              filter === "open"
                ? "bg-crimson text-manila shadow-glow"
                : "text-crimson hover:bg-crimson/5"
            }`}
          >
            Open seats
          </button>
          <button
            type="button"
            onClick={() => setFilter("all")}
            className={`rounded-sm px-4 py-3 font-mono text-xs uppercase tracking-widest transition ${
              filter === "all"
                ? "bg-crimson text-manila shadow-glow"
                : "text-crimson hover:bg-crimson/5"
            }`}
          >
            All active
          </button>
        </div>
        <PrimaryButton
          className="shrink-0 self-center text-sm lg:w-auto"
          loading={!!quickLoading}
          disabled={!firstJoinable || busy}
          onClick={quickAction}
        >
          {quickLoading ? "Joining…" : "Quick stamp"}
        </PrimaryButton>
      </div>

      <div className="mt-5 space-y-3">
        {loading &&
          Array.from({ length: 3 }, (_, i) => (
            <GlassPanel
              key={`skeleton-${i}`}
              variant="paper"
              className="flex animate-pulse items-center gap-5 p-6"
            >
              <div className="size-14 rounded-full bg-crimson/10" />
              <div className="flex-1 space-y-3">
                <div className="h-4 w-28 rounded bg-crimson/10" />
                <div className="h-4 w-48 rounded bg-crimson/10" />
                <div className="h-3 w-36 rounded bg-crimson/10" />
              </div>
            </GlassPanel>
          ))}
        {rows.length === 0 && !loading && (
          <GlassPanel
            variant="paper"
            className="p-8 text-center font-mono text-sm uppercase tracking-widest text-ink-steel"
          >
            {query
              ? `No parties match “${query}”`
              : filter === "open"
                ? "No open parties right now. Create one and wait for operators."
                : "No active parties right now."}
          </GlassPanel>
        )}
        {rows.map((row) =>
          row.kind === "open" ? (
            <motion.div
              key={row.lobby.roomId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PartyCard
                roomId={row.lobby.roomId}
                hostName={row.lobby.hostName}
                hostAvatarId={row.lobby.hostAvatarId}
                metaLine={`${gameLabel(row.lobby.gameId)} · Lobby`}
                chips={
                  <>
                    <MetaChip tone="live">
                      <Users size={12} />
                      {row.lobby.gameId === "mafia-city" || row.lobby.maxPlayers >= 99
                        ? `${row.lobby.playerCount} seated`
                        : `${row.lobby.playerCount}/${row.lobby.maxPlayers}`}
                    </MetaChip>
                    <MetaChip>{row.lobby.openSlots} open</MetaChip>
                  </>
                }
                action={
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => join(row.lobby.roomId)}
                    className={joinButtonClass}
                  >
                    {joinPending && joiningCode === row.lobby.roomId ? (
                      <>
                        <LoadingSpinner size={14} className="text-manila" />
                        Joining
                      </>
                    ) : (
                      "Join"
                    )}
                  </button>
                }
              />
            </motion.div>
          ) : (
            <motion.div
              key={row.game.roomId}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <PartyCard
                roomId={row.game.roomId}
                hostName={row.game.hostName}
                hostAvatarId={row.game.hostAvatarId}
                metaLine={`${gameLabel(row.game.gameId)} · ${row.game.phase.replace(/_/g, " ")}${
                  row.game.cycle > 0 ? ` · round ${row.game.cycle}` : ""
                }`}
                chips={
                  <>
                    <MetaChip tone="live">
                      <Users size={12} />
                      {row.game.playerCount} playing
                    </MetaChip>
                    <MetaChip tone="progress">In progress</MetaChip>
                  </>
                }
                action={
                  <span className="inline-flex min-w-[96px] items-center justify-center rounded-sm border border-crimson/20 px-5 py-3 font-mono text-xs uppercase tracking-widest text-ink-steel">
                    Locked
                  </span>
                }
              />
            </motion.div>
          )
        )}
      </div>
    </motion.section>
  );
}
