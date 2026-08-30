"use client";

import Link from "next/link";
import { useCallback, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { fadeUp } from "@/components/ui/motion";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { FiveAliveDrawPile } from "./FiveAliveDrawPile";
import {
  FiveAliveCenterPile,
  FiveAliveMockHand,
  FiveAliveOpponentHand,
  FiveAliveRunningTotal,
} from "./FiveAliveMockHand";
import {
  FiveAliveFlyingCard,
  type FlyPayload,
  type FlyRect,
} from "./FiveAliveFlyingCard";
import { FiveAliveLifePile } from "./FiveAliveLifePile";
import {
  cloneDrawPool,
  cloneP2Hand,
  cloneStartHand,
  FIVE_ALIVE_INITIAL_DRAW_COUNT,
  FIVE_ALIVE_MAX_LIVES,
  mockRunningTotalAfterPlay,
  type FiveAliveSampleCard,
} from "@/lib/mockups/five-alive-sample";

function rectOf(el: HTMLElement | null): FlyRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function FiveAliveTableMockup({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  const [hand, setHand] = useState(() => cloneStartHand());
  const [p2Hand, setP2Hand] = useState(() => cloneP2Hand());
  const [drawPool, setDrawPool] = useState(() => cloneDrawPool());
  const [drawCount, setDrawCount] = useState(FIVE_ALIVE_INITIAL_DRAW_COUNT);
  const [center, setCenter] = useState<FiveAliveSampleCard[]>([]);
  const [runningTotal, setRunningTotal] = useState(12);
  const [p1Lives, setP1Lives] = useState(FIVE_ALIVE_MAX_LIVES);
  const [p2Lives, setP2Lives] = useState(FIVE_ALIVE_MAX_LIVES);
  const [activePlayer, setActivePlayer] = useState<1 | 2>(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const [centerPlaceholder, setCenterPlaceholder] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [drawingFromPile, setDrawingFromPile] = useState(false);
  const [fly, setFly] = useState<FlyPayload | null>(null);
  const [log, setLog] = useState<string[]>([
    "Player 1's turn — tap a card to play it to the center pile.",
    "Each member starts with 5 Alive (heart) life cards — busting removes one.",
    "Running total starts at 12 from prior plays.",
  ]);

  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const centerRef = useRef<HTMLDivElement | null>(null);
  const drawRef = useRef<HTMLDivElement | null>(null);
  const p2DrawTargetRef = useRef<HTMLDivElement | null>(null);
  const drawPoolRef = useRef(drawPool);
  const pendingDrawsRef = useRef(0);
  drawPoolRef.current = drawPool;

  const pushLog = (line: string) =>
    setLog((prev) => [line, ...prev].slice(0, 8));

  const popDrawCard = useCallback((): FiveAliveSampleCard | null => {
    const pool = drawPoolRef.current;
    if (pool.length === 0) return null;
    const drawn = pool[pool.length - 1];
    const next = pool.slice(0, -1);
    drawPoolRef.current = next;
    setDrawPool(next);
    setDrawCount((c) => c - 1);
    return drawn;
  }, []);

  const startForcedDraw = useCallback(() => {
    if (pendingDrawsRef.current <= 0) {
      setDrawingFromPile(false);
      setIsBusy(false);
      setActivePlayer(1);
      pushLog("Player 1's turn again.");
      return;
    }

    const card = popDrawCard();
    if (!card) {
      pendingDrawsRef.current = 0;
      setDrawingFromPile(false);
      setIsBusy(false);
      pushLog("Draw pile empty — no more forced draws.");
      return;
    }

    const from = rectOf(drawRef.current);
    const to = rectOf(p2DrawTargetRef.current);
    if (!from || !to) {
      setP2Hand((prev) => [...prev, card]);
      pendingDrawsRef.current -= 1;
      startForcedDraw();
      return;
    }

    setDrawingFromPile(true);
    setFly({
      card,
      from,
      to: { ...to, width: 76, height: (76 * 7) / 5 },
      kind: "draw",
    });
  }, [popDrawCard]);

  const onFlyComplete = useCallback(
    (completed: FlyPayload) => {
      if (completed.kind === "play") {
        const played = completed.card;
        setHand((prev) => prev.filter((c) => c.id !== played.id));
        setCenter((prev) => [...prev, played]);
        const nextTotal = mockRunningTotalAfterPlay(runningTotal, played);
        setRunningTotal(nextTotal);
        pushLog(
          `Played ${played.type === "number" ? played.value : played.type} — total now ${nextTotal}.`
        );
        if (nextTotal > 21) {
          setP1Lives((l) => {
            const remaining = Math.max(0, l - 1);
            pushLog(
              remaining > 0
                ? `Bust! Player 1 loses 1 life (${remaining} heart cards left).`
                : "Bust! Player 1 is out — no lives remaining."
            );
            return remaining;
          });
          setRunningTotal(0);
          pushLog("Running total reset to 0 after bust.");
        }
        setHiddenCardId(null);
        setCenterPlaceholder(false);
        setSelectedId(null);
        setFly(null);
        setActivePlayer(2);

        const forced =
          played.type === "draw1" ? 1 : played.type === "draw2" ? 2 : 0;
        if (forced > 0) {
          pendingDrawsRef.current = forced;
          pushLog(
            `+${forced} played — Player 2 draws ${forced} from the pile automatically.`
          );
          startForcedDraw();
        } else {
          setIsBusy(false);
          setActivePlayer(1);
        }
        return;
      }

      const drawn = completed.card;
      setP2Hand((prev) => [...prev, drawn]);
      setFly(null);
      pendingDrawsRef.current -= 1;
      pushLog(
        `Player 2 received ${drawn.type === "number" ? drawn.value : drawn.type}.`
      );
      startForcedDraw();
    },
    [startForcedDraw, runningTotal]
  );

  const handlePlay = useCallback(
    (card: FiveAliveSampleCard) => {
      if (isBusy || activePlayer !== 1 || p1Lives <= 0) return;

      const fromEl = cardRefs.current.get(card.id);
      const toEl = centerRef.current;
      const from = rectOf(fromEl ?? null);
      const to = rectOf(toEl ?? null);
      if (!from || !to) return;

      setIsBusy(true);
      setSelectedId(card.id);
      setHiddenCardId(card.id);
      setCenterPlaceholder(true);
      setFly({
        card,
        from,
        to: { ...to, width: 96, height: (96 * 7) / 5 },
        kind: "play",
      });
    },
    [isBusy, activePlayer, p1Lives]
  );

  const reset = () => {
    const pool = cloneDrawPool();
    drawPoolRef.current = pool;
    setHand(cloneStartHand());
    setP2Hand(cloneP2Hand());
    setDrawPool(pool);
    setDrawCount(FIVE_ALIVE_INITIAL_DRAW_COUNT);
    setCenter([]);
    setRunningTotal(12);
    setP1Lives(FIVE_ALIVE_MAX_LIVES);
    setP2Lives(FIVE_ALIVE_MAX_LIVES);
    setActivePlayer(1);
    setSelectedId(null);
    setHiddenCardId(null);
    setCenterPlaceholder(false);
    setIsBusy(false);
    setDrawingFromPile(false);
    setFly(null);
    pendingDrawsRef.current = 0;
    setLog([
      "Reset — hands restored, 5 life cards each, draw pile back to 38.",
    ]);
  };

  const centerTop = center[center.length - 1] ?? null;
  const showCenterCard = centerTop && !centerPlaceholder;

  return (
    <div className="min-h-screen bg-[#1a0f0a] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="space-y-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-2">
              <Link
                href="/mockups"
                className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-white/50 hover:text-white"
              >
                <ArrowLeft className="size-3.5" />
                All mockups
              </Link>
              <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">
                5 Alive · Official deck art
              </p>
              <h1 className="font-display text-3xl font-bold text-white">{title}</h1>
              <p className="max-w-xl font-sans text-sm text-white/60">{description}</p>
            </div>
            <button
              type="button"
              onClick={reset}
              className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-4 py-2 font-sans text-sm text-white/80 transition hover:bg-white/5"
            >
              <RotateCcw className="size-4" />
              Reset table
            </button>
          </div>

          <div
            className="rounded-2xl border border-white/10 px-4 py-8 shadow-inner"
            style={{
              background:
                "linear-gradient(180deg, rgba(42,24,16,0.95) 0%, rgba(26,15,10,1) 100%)",
            }}
          >
            <div className="mb-6 flex items-center justify-center gap-3">
              <span
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                  activePlayer === 1
                    ? "bg-white text-black"
                    : "border border-white/20 text-white/50"
                }`}
              >
                Player 1 (you)
              </span>
              <span className="text-white/25">·</span>
              <span
                className={`rounded-full px-3 py-1 font-mono text-[10px] uppercase tracking-widest ${
                  activePlayer === 2
                    ? "bg-white text-black"
                    : "border border-white/20 text-white/50"
                }`}
              >
                Player 2
              </span>
            </div>

            <div className="mb-4 flex flex-wrap items-start justify-between gap-6">
              <FiveAliveLifePile
                lives={p2Lives}
                maxLives={FIVE_ALIVE_MAX_LIVES}
                heartColor={3}
                label="Player 2 lives"
              />
              <FiveAliveLifePile
                lives={p1Lives}
                maxLives={FIVE_ALIVE_MAX_LIVES}
                heartColor={6}
                label="Player 1 lives"
              />
            </div>

            <FiveAliveOpponentHand
              cards={p2Hand}
              label="Player 2 hand"
              drawTargetRef={(el) => {
                p2DrawTargetRef.current = el;
              }}
            />

            <div className="relative mt-4 flex flex-wrap items-end justify-center gap-12 pb-8">
              <FiveAliveDrawPile
                ref={drawRef}
                count={drawCount}
                drawing={drawingFromPile}
              />
              <div className="flex flex-col items-center gap-4">
                <FiveAliveCenterPile
                  card={showCenterCard ? centerTop : null}
                  pileCount={center.length}
                  centerRef={(el) => {
                    centerRef.current = el;
                  }}
                  placeholder={centerPlaceholder}
                />
                <FiveAliveRunningTotal total={runningTotal} />
              </div>
            </div>

            <p className="mb-3 text-center font-mono text-[10px] uppercase tracking-widest text-white/40">
              Player 1 — your hand
            </p>
            <FiveAliveMockHand
              cards={hand}
              selectedId={selectedId}
              hiddenCardId={hiddenCardId}
              disabled={isBusy || activePlayer !== 1 || p1Lives <= 0}
              onSelect={handlePlay}
              registerCardRef={(id, el) => {
                if (el) cardRefs.current.set(id, el);
                else cardRefs.current.delete(id);
              }}
            />

            <p className="mt-4 text-center font-sans text-xs text-white/40">
              Heart cards are member lives (not in your hand). Bust over 21 costs 1 life.
              Play cards fly hand → center ({drawCount} in draw pile). +1/+2 auto-draw for P2.
            </p>

            <ul className="mx-auto mt-6 max-w-lg space-y-1 border-t border-white/10 pt-4">
              {log.map((line, i) => (
                <li key={i} className="font-mono text-[11px] text-white/45">
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </motion.div>
      </main>

      {fly ? (
        <FiveAliveFlyingCard payload={fly} onComplete={() => onFlyComplete(fly)} />
      ) : null}
    </div>
  );
}
