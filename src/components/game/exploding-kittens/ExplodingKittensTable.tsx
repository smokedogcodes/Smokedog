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

function describeSelection(
  hand: PublicEkCard[],
  selectedIds: string[]
): {
  valid: boolean;
  label: string;
  description: string;
} {
  if (selectedIds.length === 0) {
    return {
      valid: false,
      label: "No cards selected",
      description: "Select an action card, a pair, 3-of-a-kind, or 5 cards to play.",
    };
  }
  const selected = hand.filter((c) => selectedIds.includes(c.id));
  if (selected.length === 1) {
    const card = selected[0]!;
    switch (card.type) {
      case "skip":
        return {
          valid: true,
          label: "Skip",
          description: "End your turn immediately without drawing a card.",
        };
      case "attack":
        return {
          valid: true,
          label: "Attack (2x)",
          description:
            "End your turn without drawing; next player must take 2 turns in a row.",
        };
      case "see_future":
        return {
          valid: true,
          label: "See the Future",
          description: "Privately view the top 3 cards in the draw pile.",
        };
      case "shuffle":
        return {
          valid: true,
          label: "Shuffle",
          description: "Randomly shuffle the draw pile.",
        };
      case "favor":
        return {
          valid: true,
          label: "Favor",
          description: "Force any player to give you 1 card of their choice.",
        };
      case "nope":
        return {
          valid: false,
          label: "Nope",
          description:
            "Can only be played during an active Nope window to cancel an action.",
        };
      case "defuse":
        return {
          valid: false,
          label: "Defuse",
          description:
            "Kept in hand automatically to defuse an Exploding Kitten if drawn.",
        };
      case "exploding_kitten":
        return {
          valid: false,
          label: "Exploding Kitten",
          description: "Cannot be played! Drawing one requires a Defuse card.",
        };
      default:
        return {
          valid: false,
          label: "Cat Card",
          description:
            "Cat cards have no effect alone. Match 2, 3, or 5 cards for special combos!",
        };
    }
  }
  if (selected.length === 2) {
    const allSameCat = selected.every(
      (c) => isCatType(c.type) && c.type === selected[0]!.type
    );
    if (allSameCat) {
      return {
        valid: true,
        label: "Two-of-a-Kind (Pair)",
        description: "Steal a random card from another player.",
      };
    }
    return {
      valid: false,
      label: "Invalid Pair",
      description: "Pairs must be 2 matching cat cards of the same type.",
    };
  }
  if (selected.length === 3) {
    const allSameCat = selected.every(
      (c) => isCatType(c.type) && c.type === selected[0]!.type
    );
    if (allSameCat) {
      return {
        valid: true,
        label: "Three-of-a-Kind",
        description:
          "Name a specific card and steal it from a player if they have it.",
      };
    }
    return {
      valid: false,
      label: "Invalid Triple",
      description: "Triples must be 3 matching cat cards of the same type.",
    };
  }
  if (selected.length === 5) {
    const types = new Set(selected.map((c) => c.type));
    if (types.size === 5) {
      return {
        valid: true,
        label: "5-Card Special",
        description: "Pick any card of your choice from the discard pile.",
      };
    }
    return {
      valid: false,
      label: "Invalid 5-Card Set",
      description: "All 5 cards must have distinct icons/types.",
    };
  }
  return {
    valid: false,
    label: "Invalid Selection",
    description:
      "Select 1 action card, 2 or 3 matching cats, or 5 distinct cards.",
  };
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
  const hand = useMemo(() => ek?.yourHand ?? [], [ek?.yourHand]);

  const nopeCardId = useMemo(
    () => hand.find((c) => c.type === "nope")?.id ?? null,
    [hand]
  );

  const selectionInfo = useMemo(
    () => describeSelection(hand, selectedIds),
    [hand, selectedIds]
  );

  if (!ek || !isEkGame(state.gameId)) return null;

  const playPhase = yourTurn && ek.subPhase === "play" && !ek.nopeWindowEndsAt;
  const drawPhase = yourTurn && ek.subPhase === "draw" && !ek.nopeWindowEndsAt;
  const canAct = yourTurn && you?.alive && !ek.nopeWindowEndsAt;
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
    if (!selectedIds.length || isPlaying || !selectionInfo.valid) return;
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
          canDraw={canAct}
          onDraw={onDraw}
        />
      </GlassPanel>

      {ek.seeFutureCards && ek.seeFutureCards.length > 0 && yourTurn ? (
        <EkSeeFutureModal cards={ek.seeFutureCards} />
      ) : null}

      <GlassPanel className="p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="font-display text-xl font-bold">Your hand</h3>
            <p className="mt-0.5 text-xs text-ink-steel">
              {hand.length} cards {yourTurn ? "• Your turn" : "• Waiting for opponent"}
            </p>
          </div>
          {canAct && (
            <span className="rounded-full bg-crimson/15 px-3 py-1 font-mono text-[10px] font-bold uppercase tracking-wider text-crimson animate-pulse">
              Active Turn
            </span>
          )}
        </div>

        <div className="mt-4">
          <EkPlayerHand
            cards={hand}
            selectedIds={selectedIds}
            disabled={handDisabled}
            throwingCardId={throwingCardId}
            onToggle={toggleCard}
          />
        </div>

        {canAct ? (
          <div className="mt-4 space-y-3 rounded-md border border-crimson/20 bg-manila/60 p-3">
            {/* Combo & Selection Helper Banner */}
            <div
              className={`rounded border px-3 py-2 text-xs transition ${
                selectionInfo.valid
                  ? "border-emerald-600/40 bg-emerald-500/10 text-emerald-900"
                  : selectedIds.length > 0
                    ? "border-amber-600/40 bg-amber-500/10 text-amber-900"
                    : "border-crimson/15 bg-manila/80 text-ink-steel"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-bold uppercase tracking-wider">
                  {selectionInfo.label}
                </span>
                {selectedIds.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="font-mono text-[10px] text-crimson underline hover:text-crimson-dark"
                  >
                    Clear selection
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[11px] leading-relaxed opacity-90">
                {selectionInfo.description}
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-wrap items-center gap-2">
              {selectedIds.length > 0 && playPhase && (
                <PrimaryButton
                  type="button"
                  disabled={!selectionInfo.valid || isPlaying}
                  onClick={playSelected}
                  className="!bg-emerald-700 hover:!bg-emerald-600 !text-white font-bold shadow-md"
                >
                  {isPlaying ? "Playing..." : `Play Selected (${selectedIds.length})`}
                </PrimaryButton>
              )}

              <button
                type="button"
                disabled={isPlaying}
                onClick={onDraw}
                className="group relative flex items-center gap-2 rounded-sm bg-gradient-to-r from-crimson to-crimson-dark px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider text-manila shadow-md hover:from-crimson-glow hover:to-crimson transition active:scale-95 disabled:opacity-50"
              >
                <span>Draw Card & End Turn</span>
                <span className="rounded bg-black/30 px-1.5 py-0.5 font-mono text-[10px]">
                  {ek.drawPileCount} cards left
                </span>
              </button>

              {playPhase && selectedIds.length === 0 && (
                <button
                  type="button"
                  disabled={isPlaying}
                  onClick={onEndTurn}
                  className="rounded-sm border border-crimson/30 px-3 py-2 font-mono text-[10px] uppercase tracking-widest text-ink-steel hover:bg-crimson/5 hover:text-crimson"
                >
                  Pass to Draw Phase
                </button>
              )}
            </div>
          </div>
        ) : null}
      </GlassPanel>
    </div>
  );
}
