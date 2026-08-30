"use client";

import { useCallback, useRef, useState } from "react";
import type { FlyPayload, FlyRect } from "@/components/mockups/five-alive/FiveAliveFlyingCard";
import type { PublicFiveAliveCard } from "@/lib/types";

function rectOf(el: HTMLElement | null): FlyRect | null {
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return { left: r.left, top: r.top, width: r.width, height: r.height };
}

export function useFiveAliveCardFly() {
  const [fly, setFly] = useState<FlyPayload | null>(null);
  const [hiddenCardId, setHiddenCardId] = useState<string | null>(null);
  const [centerPlaceholder, setCenterPlaceholder] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const cardRefs = useRef<Map<string, HTMLButtonElement>>(new Map());
  const centerRef = useRef<HTMLDivElement | null>(null);
  const pendingCompleteRef = useRef<(() => void) | null>(null);

  const registerCardRef = useCallback((id: string, el: HTMLButtonElement | null) => {
    if (el) cardRefs.current.set(id, el);
    else cardRefs.current.delete(id);
  }, []);

  const startPlayFly = useCallback(
    (card: PublicFiveAliveCard, onComplete: () => void): boolean => {
      if (isBusy) return false;

      const from = rectOf(cardRefs.current.get(card.id) ?? null);
      const to = rectOf(centerRef.current);
      if (!from || !to) {
        onComplete();
        return true;
      }

      pendingCompleteRef.current = onComplete;
      setIsBusy(true);
      setHiddenCardId(card.id);
      setCenterPlaceholder(true);
      setFly({
        card,
        from,
        to: { ...to, width: 96, height: (96 * 7) / 5 },
        kind: "play",
      });
      return true;
    },
    [isBusy]
  );

  const onFlyComplete = useCallback(() => {
    pendingCompleteRef.current?.();
    pendingCompleteRef.current = null;
    setHiddenCardId(null);
    setCenterPlaceholder(false);
    setFly(null);
    setIsBusy(false);
  }, []);

  return {
    fly,
    hiddenCardId,
    centerPlaceholder,
    isBusy,
    centerRef,
    registerCardRef,
    startPlayFly,
    onFlyComplete,
  };
}
