"use client";

import { useMemo, useState } from "react";
import type { PublicEkCard, PublicGameState } from "@/lib/types";
import { isCatType } from "@/lib/games/exploding-kittens/cards";
import { GlassPanel, PrimaryButton } from "@/components/ui/primitives";
import { useEkPlayAnimation } from "@/components/mockups/ek/EkPlayAnimation";
import { EkCenterPiles } from "./EkCenterPiles";
import { EkOpponentSeats } from "./EkOpponentSeats";
import { EkPlayerHand } from "./EkPlayerHand";
import { EkStatusHud } from "./EkStatusHud";
import { EkSeeFutureModal, EkNopeBar } from "./EkSeeFutureModal";
import { EkDefuseSlider } from "./EkDefuseSlider";
import { EkDiscardBrowserModal } from "./EkDiscardBrowserModal";
import { EkFavorModals, EkTripleDeclareModal } from "./EkFavorModals";

function canSelectTogether(
  hand: PublicEkCard[],
  selectedIds: string[],
  card: PublicEkCard
): boolean {
  if (selectedIds.length === 0) return true;
  if (selectedIds.includes(card.id)) return true;
  if (selectedIds.length >= 5) return false;

  const selected = hand.filter((c) => selectedIds.includes(c.id));
  const allCats = selected.every((c) => isCatType(c.type));
  const cardIsCat = isCatType(card.type);

  if (allCats && cardIsCat) {
    const types = new Set(selected.map((c) => c.type));
    if (types.size === 1) {
      return selected[0]!.type === card.type && selected.length < 3;
    }
    if (types.has(card.type)) return false;
    return selected.length < 5;
  }

  return false;
}

function isEkGame(gameId: string) {
  return gameId === "exploding-kittens" || gameId === "detonation-cats";
}

export function ExplodingKittensTable({
  state,
  onPlayCards,
  onEndTurn,
  onDraw,
  onNope,
  onPlaceDefuse,
  onPickDiscard,
  onStealTarget,
  onFavorTarget,
  onFavorGive,
  onTripleDeclare,
}: {
  state: PublicGameState;
  onPlayCards: (cardIds: string[]) => void;
  onEndTurn: () => void;
  onDraw: () => void;
  onNope: (cardId: string) => void;
  onPlaceDefuse: (deckIndex: number) => void;
  onPickDiscard: (discardIndex: number) => void;
  onStealTarget: (targetId: string) => void;
  onFavorTarget: (targetId: string) => void;
  onFavorGive: (cardId: string) => void;
  onTripleDeclare: (targetId: string, cardType: PublicEkCard["type"]) => void;
}) {
  const ek = state.explodingKittens;
  const you = state.you;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const { throwingCardId, playCard, isPlaying } = useEkPlayAnimation();

  const yourTurn = !!ek && ek.turnPlayerId === you?.id;
  const hand = ek?.yourHand ?? [];

  const nopeCardId = useMemo(
    () => hand.find((c) => c.type === "nope")?.id ?? null,
    [hand]
  );

  if (!ek || !isEkGame(state.gameId)) return null;

  const playPhase = yourTurn && ek.subPhase === "play" && !ek.nopeWindowEndsAt;
  const drawPhase = yourTurn && ek.subPhase === "draw" && !ek.nopeWindowEndsAt;
  const handDisabled = !playPhase && !(ek.nopeEligible && !!ek.nopeWindowEndsAt);

  const toggleCard = (card: PublicEkCard) => {
    if (ek.nopeEligible && ek.nopeWindowEndsAt && card.type === "nope") {
      onNope(card.id);
      return;
    }
    if (!playPhase || !you?.alive) return;
    setSelectedIds((prev) => {
      if (prev.includes(card.id)) {
        return prev.filter((id) => id !== card.id);
      }
      if (!canSelectTogether(hand, prev, card)) return [card.id];
      return [...prev, card.id];
    });
  };

  const playSelected = () => {
    if (!selectedIds.length || isPlaying) return;
    const ids = [...selectedIds];
    playCard(ids[0]!, () => {
      onPlayCards(ids);
      setSelectedIds([]);
    });
  };

  if (state.phase === "ek_defuse" && ek.awaitingDefuse) {
    return (
      <EkDefuseSlider
        deckSize={ek.drawPileCount}
        onPlace={onPlaceDefuse}
      />
    );
  }

  if (state.phase === "ek_pick_discard" && ek.awaitingPickDiscard) {
    return (
      <EkDiscardBrowserModal
        cards={ek.discardPreview}
        onPick={(previewIndex) => {
          const offset = Math.max(0, ek.discardCount - ek.discardPreview.length);
          onPickDiscard(offset + previewIndex);
        }}
      />
    );
  }

  if (state.phase === "ek_steal" && ek.awaitingStealTarget) {
    return (
      <GlassPanel className="space-y-4 p-4">
        <h3 className="font-display text-xl font-bold">Steal a card</h3>
        <p className="text-sm text-ink-steel">Two of a Kind — pick a player.</p>
        <div className="flex flex-wrap gap-2">
          {ek.stealTargetIds.map((id) => {
            const p = state.players.find((x) => x.id === id);
            if (!p) return null;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onStealTarget(id)}
                className="rounded-sm border border-crimson/25 px-4 py-2 font-mono text-xs uppercase hover:bg-crimson/5"
              >
                {p.name} ({ek.opponentHandCounts[id] ?? 0})
              </button>
            );
          })}
        </div>
      </GlassPanel>
    );
  }

  if (state.phase === "ek_favor" && ek.awaitingFavorTarget) {
    return (
      <EkFavorModals state={state} mode="target" onTarget={onFavorTarget} onGive={onFavorGive} />
    );
  }

  if (state.phase === "ek_favor" && ek.awaitingFavorGive) {
    return (
      <EkFavorModals state={state} mode="give" onTarget={onFavorTarget} onGive={onFavorGive} />
    );
  }

  if (state.phase === "ek_triple" && ek.awaitingTripleDeclare) {
    return <EkTripleDeclareModal state={state} onDeclare={onTripleDeclare} />;
  }

  return (
    <div className="space-y-4">
      {ek.nopeWindowEndsAt && ek.nopeEligible ? (
        <EkNopeBar
          endsAt={ek.nopeWindowEndsAt}
          eligible={ek.nopeEligible}
          nopeCardId={nopeCardId}
          onNope={() => nopeCardId && onNope(nopeCardId)}
        />
      ) : null}

      <GlassPanel className="p-4">
        <EkOpponentSeats state={state} ek={ek} />
      </GlassPanel>

      <GlassPanel className="space-y-4 p-6">
        <EkStatusHud state={state} ek={ek} />
        <EkCenterPiles
          ek={ek}
          canDraw={!!drawPhase && you?.alive}
          onDraw={onDraw}
        />
      </GlassPanel>

      {ek.seeFutureCards && ek.seeFutureCards.length > 0 && yourTurn ? (
        <EkSeeFutureModal cards={ek.seeFutureCards} />
      ) : null}

      <GlassPanel className="p-4">
        <h3 className="font-display text-xl font-bold">Your hand</h3>
        <p className="mt-1 text-sm text-ink-steel">{hand.length} cards</p>
        <div className="mt-4">
          <EkPlayerHand
            cards={hand}
            selectedIds={selectedIds}
            disabled={handDisabled}
            throwingCardId={throwingCardId}
            onToggle={toggleCard}
          />
        </div>
        {playPhase && you?.alive ? (
          <div className="mt-4 flex flex-wrap gap-2">
            <PrimaryButton
              type="button"
              disabled={selectedIds.length === 0 || isPlaying}
              onClick={playSelected}
            >
              Play selected
            </PrimaryButton>
            <button
              type="button"
              disabled={isPlaying}
              onClick={onEndTurn}
              className="rounded-sm border border-crimson/30 px-4 py-2 font-mono text-[10px] uppercase tracking-widest text-crimson hover:bg-crimson/5"
            >
              {drawPhase ? "Draw" : "End play phase"}
            </button>
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}
