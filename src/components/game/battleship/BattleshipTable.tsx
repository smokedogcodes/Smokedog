"use client";

import { useEffect, useRef, useState } from "react";
import type { GameSocket } from "@/lib/socket/client";
import type { PublicGameState } from "@/lib/types";
import type { PowerUpType, TorpedoDirection } from "@/lib/games/battleship/powerups";
import {
  playBattleshipHit,
  playBattleshipMiss,
  playBattleshipSink,
} from "@/lib/sounds";
import { BattleshipGrid } from "./BattleshipGrid";
import { BattleshipHud } from "./BattleshipHud";
import { BattleshipPlacement } from "./BattleshipPlacement";
import { BattleshipPowerBar } from "./BattleshipPowerBar";
import { BattleshipGameOver } from "./BattleshipGameOver";

export function BattleshipTable({
  state,
  socket,
  onReturn,
  returning,
}: {
  state: PublicGameState;
  socket: GameSocket;
  onReturn?: () => void;
  returning?: boolean;
}) {
  const bs = state.battleship;
  const [mobileTab, setMobileTab] = useState<"target" | "fleet">("target");
  const [power, setPower] = useState<PowerUpType | null>(null);
  const [torpedoDir, setTorpedoDir] = useState<TorpedoDirection>("E");
  const [reconOrient, setReconOrient] = useState<"horizontal" | "vertical">(
    "horizontal"
  );
  const logRef = useRef<string>("");

  useEffect(() => {
    if (!bs?.lastActionLog?.length) return;
    const line = bs.lastActionLog[bs.lastActionLog.length - 1] ?? "";
    if (!line || line === logRef.current) return;
    logRef.current = line;
    const lower = line.toLowerCase();
    if (lower.includes("sunk") || lower.includes("sink")) playBattleshipSink();
    else if (lower.includes("hit")) playBattleshipHit();
    else if (lower.includes("miss") || lower.includes("splash"))
      playBattleshipMiss();
  }, [bs?.lastActionLog]);

  if (!bs || !state.you) return null;

  if (bs.phase === "gameover" || state.phase === "gameover") {
    return (
      <BattleshipGameOver
        state={state}
        returning={returning}
        onRematch={() =>
          socket.emit("battleship:rematch", { roomId: state.roomId })
        }
        onReturn={() => onReturn?.()}
      />
    );
  }

  if (state.phase === "battleship_setup" || bs.phase === "setup") {
    return (
      <div className="mx-auto max-w-md space-y-3">
        <BattleshipHud
          setup
          yourTurn={!bs.yourReady}
          phaseEndsAt={state.phaseEndsAt}
          log={bs.lastActionLog}
        />
        <BattleshipPlacement
          alreadyReady={bs.yourReady}
          onReady={(fleet) =>
            socket.emit("battleship:ready", {
              roomId: state.roomId,
              fleet,
            })
          }
        />
      </div>
    );
  }

  const myTurn = bs.turnPlayerId === state.you.id;
  const interactive = myTurn && !state.paused;

  const onRadarClick = (col: number, row: number) => {
    if (!interactive) return;
    if (!power) {
      socket.emit("battleship:fire", { roomId: state.roomId, col, row });
      return;
    }
    if (power === "smoke") return;
    socket.emit("battleship:powerup", {
      roomId: state.roomId,
      type: power,
      col,
      row,
      orientation: power === "recon" ? reconOrient : undefined,
      direction: power === "torpedo" ? torpedoDir : undefined,
    });
    setPower(null);
  };

  const onFriendlyClick = (col: number, row: number) => {
    if (!interactive || power !== "smoke") return;
    socket.emit("battleship:powerup", {
      roomId: state.roomId,
      type: "smoke",
      col,
      row,
    });
    setPower(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-3 rounded-sm border border-cyan-700/40 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 p-2.5 sm:p-3">
      <BattleshipHud
        yourTurn={myTurn}
        phaseEndsAt={state.phaseEndsAt}
        log={bs.lastActionLog}
      />

      <div className="flex gap-1.5 md:hidden">
        {(["target", "fleet"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setMobileTab(tab)}
            className={`flex-1 rounded-sm border py-1.5 font-mono text-[9px] uppercase tracking-widest ${
              mobileTab === tab
                ? "border-cyan-400 bg-cyan-500/20 text-cyan-100"
                : "border-cyan-900 text-cyan-400/70"
            }`}
          >
            {tab === "target" ? "Target" : "Fleet"}
          </button>
        ))}
      </div>

      {(power === "torpedo" || power === "recon") && (
        <div className="flex flex-wrap gap-1.5">
          {power === "torpedo"
            ? (["N", "S", "E", "W"] as TorpedoDirection[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setTorpedoDir(d)}
                  className={`rounded-sm border px-2.5 py-1 font-mono text-[9px] ${
                    torpedoDir === d
                      ? "border-amber-400 bg-amber-500/20 text-amber-100"
                      : "border-cyan-800 text-cyan-300"
                  }`}
                >
                  Torpedo {d}
                </button>
              ))
            : (
                <>
                  <button
                    type="button"
                    onClick={() => setReconOrient("horizontal")}
                    className={`rounded-sm border px-2.5 py-1 font-mono text-[9px] ${
                      reconOrient === "horizontal"
                        ? "border-amber-400 bg-amber-500/20"
                        : "border-cyan-800 text-cyan-300"
                    }`}
                  >
                    Recon row
                  </button>
                  <button
                    type="button"
                    onClick={() => setReconOrient("vertical")}
                    className={`rounded-sm border px-2.5 py-1 font-mono text-[9px] ${
                      reconOrient === "vertical"
                        ? "border-amber-400 bg-amber-500/20"
                        : "border-cyan-800 text-cyan-300"
                    }`}
                  >
                    Recon column
                  </button>
                </>
              )}
        </div>
      )}
      {power === "smoke" ? (
        <p className="text-[11px] text-violet-300">
          Smoke selected — switch to Fleet and tap a center cell.
        </p>
      ) : null}

      <div className="grid justify-items-center gap-3 md:grid-cols-2 md:items-start">
        <div className={mobileTab === "target" ? "block" : "hidden md:block"}>
          <BattleshipGrid
            title="Radar — enemy waters"
            cells={bs.radarGrid}
            interactive={interactive && power !== "smoke"}
            onCellClick={onRadarClick}
            compact
          />
        </div>
        <div className={mobileTab === "fleet" ? "block" : "hidden md:block"}>
          <BattleshipGrid
            title="Your fleet"
            cells={bs.yourGrid}
            interactive={interactive && power === "smoke"}
            onCellClick={onFriendlyClick}
            compact
          />
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <div className="rounded-sm border border-cyan-900/50 bg-slate-950/60 p-2 sm:p-2.5">
          <p className="font-mono text-[8px] uppercase tracking-widest text-cyan-500">
            Your ships
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-cyan-100">
            {bs.yourShips.map((s) => (
              <li key={s.type} className={s.sunk ? "line-through opacity-50" : ""}>
                {s.type} {s.hits}/{s.length}
              </li>
            ))}
          </ul>
        </div>
        <div className="rounded-sm border border-cyan-900/50 bg-slate-950/60 p-2 sm:p-2.5">
          <p className="font-mono text-[8px] uppercase tracking-widest text-cyan-500">
            Enemy ships
          </p>
          <ul className="mt-1 space-y-0.5 text-[11px] text-cyan-100">
            {bs.opponentShips.map((s) => (
              <li key={s.type} className={s.sunk ? "text-amber-400" : ""}>
                {s.type} {s.sunk ? "SUNK" : `${s.hits}/${s.length}`}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <BattleshipPowerBar
        bs={bs}
        selected={power}
        onSelect={(t) => {
          setPower(t);
          if (t === "smoke") setMobileTab("fleet");
          else if (t) setMobileTab("target");
        }}
        disabled={!interactive}
      />
    </div>
  );
}
