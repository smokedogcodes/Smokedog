import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  beginBattleship,
  fireStandardShot,
  submitFleetReady,
  triggerPowerUp,
} from "./actions";
import { remainingCells } from "./placement";
import { generateRandomFleetLayout, placeShip } from "./placement";
import { projectBattleshipPublic } from "./selectors";
import { TOTAL_SHIP_CELLS } from "./ships";

function rngSeq(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

describe("battleship engine", () => {
  it("generates a complete random fleet of 17 cells", () => {
    const fleet = generateRandomFleetLayout(rngSeq(42));
    assert.equal(fleet.length, 5);
    assert.equal(remainingCells(fleet), TOTAL_SHIP_CELLS);
  });

  it("rejects overlapping placement", () => {
    let fleet = placeShip([], "destroyer", { col: 0, row: 0 }, "horizontal");
    assert.ok(fleet);
    const bad = placeShip(fleet!, "submarine", { col: 0, row: 0 }, "vertical");
    assert.equal(bad, null);
  });

  it("starts battle when both fleets ready", () => {
    let s = beginBattleship(["a", "b"]);
    s = submitFleetReady(s, "a", generateRandomFleetLayout(rngSeq(1)));
    assert.equal(s.phase, "setup");
    s = submitFleetReady(s, "b", generateRandomFleetLayout(rngSeq(2)), "a");
    assert.equal(s.phase, "battle");
    assert.equal(s.turnPlayerId, "a");
  });

  it("awards AP on miss and switches turn", () => {
    let s = beginBattleship(["a", "b"]);
    const fa = generateRandomFleetLayout(rngSeq(3));
    const fb = generateRandomFleetLayout(rngSeq(4));
    s = submitFleetReady(s, "a", fa, "a");
    s = submitFleetReady(s, "b", fb, "a");
    const occupied = new Set(
      fb.flatMap((ship) => ship.cells.map((c) => `${c.col},${c.row}`))
    );
    let miss = { col: 0, row: 0 };
    outer: for (let r = 0; r < 10; r++) {
      for (let c = 0; c < 10; c++) {
        if (!occupied.has(`${c},${r}`)) {
          miss = { col: c, row: r };
          break outer;
        }
      }
    }
    s = fireStandardShot(s, "a", miss.col, miss.row);
    assert.equal(s.ap.a, 1);
    assert.equal(s.turnPlayerId, "b");
  });

  it("sonar does not damage and reports ping", () => {
    let s = beginBattleship(["a", "b"]);
    s = submitFleetReady(s, "a", generateRandomFleetLayout(rngSeq(5)), "a");
    s = submitFleetReady(s, "b", generateRandomFleetLayout(rngSeq(6)), "a");
    s = { ...s, ap: { ...s.ap, a: 10 } };
    s = triggerPowerUp(s, "a", "sonar", { col: 4, row: 4 });
    assert.ok(s.privateIntel.a?.kind === "sonar");
    assert.equal(s.turnPlayerId, "b");
    assert.equal(remainingCells(s.fleets.b!), TOTAL_SHIP_CELLS);
  });

  it("hides opponent ships from public projection until gameover", () => {
    let s = beginBattleship(["a", "b"]);
    s = submitFleetReady(s, "a", generateRandomFleetLayout(rngSeq(7)), "a");
    s = submitFleetReady(s, "b", generateRandomFleetLayout(rngSeq(8)), "a");
    const pub = projectBattleshipPublic(s, "a");
    const hasOppShip = pub.radarGrid.some((row) =>
      row.some((cell) => cell.ship)
    );
    assert.equal(hasOppShip, false);
    assert.equal(pub.revealedOpponentFleet, null);
  });

  it("wins when all opponent cells are hit", () => {
    let s = beginBattleship(["a", "b"]);
    const fb = generateRandomFleetLayout(rngSeq(9));
    s = submitFleetReady(s, "a", generateRandomFleetLayout(rngSeq(10)), "a");
    s = submitFleetReady(s, "b", fb, "a");

    const cells = fb.flatMap((ship) => ship.cells);
    for (const cell of cells) {
      if (s.phase === "gameover") break;
      if (s.turnPlayerId === "b") {
        // opponent auto-pass turn by forcing
        s = { ...s, turnPlayerId: "a" };
      }
      if (s.turnPlayerId === "a" && s.phase === "battle") {
        s = fireStandardShot(s, "a", cell.col, cell.row);
      }
    }
    assert.equal(s.phase, "gameover");
    assert.equal(s.winnerId, "a");
    assert.equal(remainingCells(s.fleets.b!), 0);
  });
});
