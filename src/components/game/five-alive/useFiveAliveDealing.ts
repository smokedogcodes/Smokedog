"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type {
  FlyPayload,
  FlyRect,
} from "@/components/mockups/five-alive/FiveAliveFlyingCard";
import {
  dealAnimationDurationMs,
  FA_ROUND_BANNER_MS,
} from "@/lib/games/5-alive/dealing";
import { playCardDeal, playRoundComplete } from "@/lib/sounds";
import type { FiveAliveDealEvent, PublicFiveAliveCard } from "@/lib/types";

function rectOf(el: HTMLElement | null): FlyRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

const PLACEHOLDER_CARD: PublicFiveAliveCard = {
  id: "deal-fly",
  type: "number",
  value: 0,
};

export type DealFly = FlyPayload & {
  id: string;
  playerId: string;
  stepIndex: number;
};

export function useFiveAliveDealing({
  dealEvent,
  phase,
  youId,
  drawRef,
  handTargetRef,
  seatRefs,
}: {
  dealEvent: FiveAliveDealEvent | null | undefined;
  phase: string;
  youId: string | null;
  drawRef: React.RefObject<HTMLElement | null>;
  handTargetRef: React.RefObject<HTMLElement | null>;
  seatRefs: React.MutableRefObject<Map<string, HTMLElement>>;
}) {
  const [bannerVisible, setBannerVisible] = useState(false);
  const [isDealing, setIsDealing] = useState(false);
  const [flies, setFlies] = useState<DealFly[]>([]);
  const [revealedLocalCards, setRevealedLocalCards] = useState<
    PublicFiveAliveCard[]
  >([]);
  const [opponentStacks, setOpponentStacks] = useState<Record<string, number>>(
    {}
  );

  const seqRef = useRef<number | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const pendingLandCountRef = useRef(0);
  const startedCountRef = useRef(0);
  const [startedCount, setStartedCount] = useState(0);
  const stepsRef = useRef<FiveAliveDealEvent["steps"]>([]);
  const youIdRef = useRef(youId);
  youIdRef.current = youId;

  const clearTimers = useCallback(() => {
    for (const t of timersRef.current) clearTimeout(t);
    timersRef.current = [];
  }, []);

  const finishDealing = useCallback(() => {
    clearTimers();
    setFlies([]);
    setIsDealing(false);
    setBannerVisible(false);
    pendingLandCountRef.current = 0;
    startedCountRef.current = 0;
    setStartedCount(0);
  }, [clearTimers]);

  const landStep = useCallback(
    (step: FiveAliveDealEvent["steps"][number], flyId: string) => {
      const isLocal = step.playerId === youIdRef.current;
      if (isLocal && step.card) {
        setRevealedLocalCards((prev) =>
          prev.some((c) => c.id === step.card!.id)
            ? prev
            : [...prev, step.card!]
        );
      } else if (!isLocal) {
        setOpponentStacks((prev) => ({
          ...prev,
          [step.playerId]: (prev[step.playerId] ?? 0) + 1,
        }));
      }
      setFlies((prev) => prev.filter((f) => f.id !== flyId));
      pendingLandCountRef.current = Math.max(0, pendingLandCountRef.current - 1);
      if (pendingLandCountRef.current === 0) {
        setIsDealing(false);
        setBannerVisible(false);
      }
    },
    []
  );

  const startStepFly = useCallback(
    (
      step: FiveAliveDealEvent["steps"][number],
      flyId: string,
      stepIndex: number,
      retry = 0
    ) => {
      const from = rectOf(drawRef.current);
      const isLocal = step.playerId === youIdRef.current;
      const seatEl = isLocal
        ? handTargetRef.current
        : seatRefs.current.get(step.playerId) ?? null;
      const to = rectOf(seatEl);

      // Seat/draw targets can mount a frame late on shuffle redeal — retry briefly.
      if ((!from || !to) && retry < 8) {
        timersRef.current.push(
          setTimeout(
            () => startStepFly(step, flyId, stepIndex, retry + 1),
            50 + retry * 25
          )
        );
        return;
      }

      if (!from || !to) {
        playCardDeal();
        startedCountRef.current += 1;
        setStartedCount(startedCountRef.current);
        landStep(step, flyId);
        return;
      }

      playCardDeal();
      startedCountRef.current += 1;
      setStartedCount(startedCountRef.current);
      const card = step.card ?? PLACEHOLDER_CARD;
      setFlies((prev) => [
        ...prev,
        {
          id: flyId,
          playerId: step.playerId,
          stepIndex,
          card,
          from,
          to: {
            ...to,
            width: isLocal ? 72 : 52,
            height: isLocal ? (72 * 7) / 5 : (52 * 7) / 5,
          },
          kind: "deal",
          flipToFace: isLocal && !!step.card,
        },
      ]);
    },
    [drawRef, handTargetRef, landStep, seatRefs]
  );

  useEffect(() => {
    if (!dealEvent || dealEvent.steps.length === 0) {
      if (pendingLandCountRef.current > 0) return;
      finishDealing();
      return;
    }

    if (seqRef.current === dealEvent.seq) return;
    seqRef.current = dealEvent.seq;

    clearTimers();
    setFlies([]);
    setRevealedLocalCards([]);
    setOpponentStacks({});
    setIsDealing(true);
    stepsRef.current = dealEvent.steps;
    pendingLandCountRef.current = dealEvent.steps.length;
    startedCountRef.current = 0;
    setStartedCount(0);

    const stagger = dealEvent.staggerMs;
    // Match server duration: show banner whenever one is provided (incl. shuffle).
    const showBanner = !!dealEvent.banner;
    const startDelay = showBanner ? FA_ROUND_BANNER_MS : 160;

    if (showBanner) {
      setBannerVisible(true);
      playRoundComplete();
      timersRef.current.push(
        setTimeout(() => setBannerVisible(false), FA_ROUND_BANNER_MS)
      );
    } else {
      setBannerVisible(false);
    }

    dealEvent.steps.forEach((step, i) => {
      const flyId = `deal:${dealEvent.seq}:${i}`;
      timersRef.current.push(
        setTimeout(
          () => startStepFly(step, flyId, i),
          startDelay + i * stagger
        )
      );
    });

    const safetyMs =
      dealAnimationDurationMs(dealEvent.steps.length, showBanner) + 2500;
    timersRef.current.push(
      setTimeout(() => {
        if (pendingLandCountRef.current > 0) {
          // Drain remaining steps so UI doesn't stick mid-deal.
          const remaining = stepsRef.current.slice(startedCountRef.current);
          for (const step of remaining) {
            const isLocal = step.playerId === youIdRef.current;
            if (isLocal && step.card) {
              setRevealedLocalCards((prev) =>
                prev.some((c) => c.id === step.card!.id)
                  ? prev
                  : [...prev, step.card!]
              );
            } else if (!isLocal) {
              setOpponentStacks((prev) => ({
                ...prev,
                [step.playerId]: (prev[step.playerId] ?? 0) + 1,
              }));
            }
          }
          finishDealing();
        }
      }, safetyMs)
    );

    return () => {
      clearTimers();
    };
  }, [dealEvent, clearTimers, finishDealing, startStepFly]);

  // Server ended dealing phase — drain stuck animation state.
  useEffect(() => {
    if (phase === "fivealive_dealing") return;
    if (!dealEvent && pendingLandCountRef.current === 0 && flies.length === 0) {
      finishDealing();
    }
  }, [phase, dealEvent, flies.length, finishDealing]);

  const onFlyComplete = useCallback(
    (flyId: string) => {
      const match = /^deal:(\d+):(\d+)$/.exec(flyId);
      const stepIndex = match ? Number(match[2]) : NaN;
      const step = Number.isFinite(stepIndex)
        ? stepsRef.current[stepIndex]
        : undefined;
      if (step) {
        landStep(step, flyId);
      } else {
        setFlies((prev) => prev.filter((f) => f.id !== flyId));
        pendingLandCountRef.current = Math.max(
          0,
          pendingLandCountRef.current - 1
        );
        if (pendingLandCountRef.current === 0) {
          setIsDealing(false);
          setBannerVisible(false);
        }
      }
    },
    [landStep]
  );

  const sourceCount = dealEvent?.sourceCount ?? dealEvent?.steps.length ?? 0;
  const dealPileRemaining = Math.max(0, sourceCount - startedCount);

  return {
    bannerVisible,
    bannerText: dealEvent?.banner ?? null,
    isDealing,
    flies,
    onFlyComplete,
    revealedLocalCards,
    opponentStacks,
    drawingFromPile: flies.length > 0,
    dealPileRemaining,
  };
}
