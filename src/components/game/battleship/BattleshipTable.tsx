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

      {power && (
        <div className="rounded border border-amber-400/50 bg-amber-950/40 p-2.5 sm:p-3 text-amber-100 shadow-md flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs font-bold uppercase tracking-wider text-amber-300">
                Active Tactical: {bs.powerUps.find((p) => p.type === power)?.label}
              </span>
              <span className="rounded bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] text-amber-200">
                {bs.powerUps.find((p) => p.type === power)?.cost} AP
              </span>
            </div>
            <p className="text-[11px] text-amber-200/90">
              {power === "smoke"
                ? "Tap a cell in Your Fleet (Fleet tab on mobile) to place 3x3 smoke cover."
                : power === "torpedo"
                  ? "Select direction below and tap any edge cell on Radar to launch."
                  : power === "recon"
                    ? "Select scan orientation and tap row/col on Radar to detect ships."
                    : "Tap any cell on Radar to execute strike."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {power === "torpedo" && (
              <div className="flex gap-1">
                {(["N", "S", "E", "W"] as TorpedoDirection[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setTorpedoDir(d)}
                    className={`rounded border px-2 py-0.5 font-mono text-[9px] uppercase font-bold ${
                      torpedoDir === d
                        ? "border-amber-300 bg-amber-400 text-slate-950 shadow"
                        : "border-amber-500/40 text-amber-200 hover:bg-amber-900/40"
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}

            {power === "recon" && (
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setReconOrient("horizontal")}
                  className={`rounded border px-2 py-0.5 font-mono text-[9px] font-bold ${
                    reconOrient === "horizontal"
                      ? "border-amber-300 bg-amber-400 text-slate-950 shadow"
                      : "border-amber-500/40 text-amber-200 hover:bg-amber-900/40"
                  }`}
                >
                  Row ↔
                </button>
                <button
                  type="button"
                  onClick={() => setReconOrient("vertical")}
                  className={`rounded border px-2 py-0.5 font-mono text-[9px] font-bold ${
                    reconOrient === "vertical"
                      ? "border-amber-300 bg-amber-400 text-slate-950 shadow"
                      : "border-amber-500/40 text-amber-200 hover:bg-amber-900/40"
                  }`}
                >
                  Col ↕
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => setPower(null)}
              className="rounded border border-red-500/40 bg-red-950/40 px-2.5 py-1 font-mono text-[10px] uppercase text-red-200 hover:bg-red-900/60 transition"
            >
              Cancel Strike
            </button>
          </div>
        </div>
      )}

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
