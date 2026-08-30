import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { makeCard } from "./cards";
import { createExplodingKittensState } from "./setup";
import type { EkGameState, EkPlayerRef } from "./state";
import {
  ekDraw,
  ekMaybeWin,
  ekPickDiscard,
  ekPlaceDefuse,
  ekPlayCards,
  ekResolveNopeWindow,
  ekStealTarget,
  ekTripleDeclare,
} from "./reducer";

const players: EkPlayerRef[] = [
  { id: "a", name: "Alice", alive: true },
  { id: "b", name: "Bob", alive: true },
  { id: "c", name: "Carol", alive: true },
];

function freshState(): EkGameState {
  return createExplodingKittensState(players, () => 0.5);
}

describe("exploding-kittens reducer", () => {
  it("deals 8 cards per player (1 defuse + 7)", () => {
    const s = freshState();
    for (const p of players) {
      assert.equal(s.handsByPlayerId[p.id]!.length, 8);
      assert.ok(s.handsByPlayerId[p.id]!.some((c) => c.type === "defuse"));
    }
  });

  it("attack stacks turns on next player", () => {
    const s = freshState();
    const actor = s.turnPlayerId!;
    s.handsByPlayerId[actor] = [makeCard("attack")];
    s.turnsRemaining = 1;
    const attack = makeCard("attack");
    ekPlayCards(s, players, actor, [attack]);
    s.nopeWindowEndsAt = null;
    s.nopeStack = [];
    ekResolveNopeWindow(s, players);
    assert.notEqual(s.turnPlayerId, actor);
    assert.equal(s.turnsRemaining, 3);
  });

  it("skip ends turn without draw", () => {
    const s = freshState();
    const actor = s.turnPlayerId!;
    const idx = s.turnOrder.indexOf(actor);
    const expectedNext = s.turnOrder[(idx + 1) % s.turnOrder.length]!;
    s.handsByPlayerId[actor] = [makeCard("skip")];
    ekPlayCards(s, players, actor, [makeCard("skip")]);
    s.nopeWindowEndsAt = null;
    ekResolveNopeWindow(s, players);
    assert.equal(s.turnPlayerId, expectedNext);
    assert.equal(s.subPhase, "play");
  });

  it("draw safe card advances turn", () => {
    const s = freshState();
    const actor = s.turnPlayerId!;
    s.drawDeck = [makeCard("skip")];
    s.subPhase = "draw";
    const handBefore = s.handsByPlayerId[actor]!.length;
    ekDraw(s, players, actor);
    assert.equal(s.handsByPlayerId[actor]!.length, handBefore + 1);
    assert.equal(s.subPhase, "play");
  });

  it("exploding kitten without defuse eliminates player", () => {
    const s = freshState();
    const actor = s.turnPlayerId!;
    s.handsByPlayerId[actor] = s.handsByPlayerId[actor]!.filter(
      (c) => c.type !== "defuse"
    );
    s.drawDeck = [makeCard("exploding_kitten")];
    s.subPhase = "draw";
    ekDraw(s, players, actor);
    const p = players.find((x) => x.id === actor)!;
    assert.equal(p.alive, false);
    assert.equal(s.handsByPlayerId[actor]!.length, 0);
  });

  it("defuse insert at index 0 and deck length", () => {
    const s = freshState();
    const actor = s.turnPlayerId!;
    const kitten = makeCard("exploding_kitten");
    const defuse = makeCard("defuse");
    s.defusePlayerId = actor;
    s.pendingKitten = kitten;
    s.pendingDefuseCard = defuse;
    s.drawDeck = [makeCard("skip"), makeCard("shuffle")];
    ekPlaceDefuse(s, players, actor, 0);
    assert.equal(s.drawDeck[0]!.type, "exploding_kitten");
    ekPlaceDefuse(
      {
        ...s,
        defusePlayerId: actor,
        pendingKitten: kitten,
        pendingDefuseCard: defuse,
        drawDeck: [makeCard("skip")],
      },
      players,
      actor,
      1
    );
  });

  it("steal blocked when target hand empty", () => {
    const s = freshState();
    s.stealActorId = "a";
    s.handsByPlayerId["b"] = [];
    const result = ekStealTarget(s, players, "a", "b");
    assert.deepEqual(result.logs, []);
  });

  it("five-card discard pick adds card to hand", () => {
    const s = freshState();
    const actor = s.turnPlayerId!;
    const picked = makeCard("taco_cat");
    s.discardPile = [picked, makeCard("skip")];
    s.pickDiscardPlayerId = actor;
    const before = s.handsByPlayerId[actor]!.length;
    ekPickDiscard(s, players, actor, 0);
    assert.equal(s.handsByPlayerId[actor]!.length, before + 1);
    assert.equal(s.subPhase, "draw");
  });

  it("triple declare transfers matching card", () => {
    const s = freshState();
    const skip = makeCard("skip");
    s.handsByPlayerId["b"] = [skip];
    s.handsByPlayerId["a"] = [];
    ekTripleDeclare(s, players, "a", "b", "skip");
    assert.ok(s.handsByPlayerId["a"]!.some((c) => c.type === "skip"));
  });

  it("single survivor wins", () => {
    const ps: EkPlayerRef[] = [
      { id: "a", name: "Alice", alive: true },
      { id: "b", name: "Bob", alive: false },
      { id: "c", name: "Carol", alive: false },
    ];
    const winner = ekMaybeWin(ps, ["a", "b", "c"]);
    assert.equal(winner, "a");
  });
});
