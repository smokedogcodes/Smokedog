"use client";

import { GlassPanel } from "@/components/ui/primitives";

type RulesSection = { title: string; body: string };

type GameRules = {
  title: string;
  sections: RulesSection[];
};

const RULES_BY_GAME: Record<string, GameRules> = {
  "mafia-city": {
    title: "Mafia City — how it works",
    sections: [
      {
        title: "The setup",
        body: "Four or more players get secret roles. Hosts pick the lineup — everyone else is a Villager. Mafia want to outnumber Town without getting caught.",
      },
      {
        title: "Night",
        body: "Special roles act in secret. Mafia pick a kill. Doctor and Bodyguard protect. Detective investigates. Vigilante can shoot or skip a night. Blackmailer silences someone for the next day. Poisoner blocks a target’s power for one night (Doctor clearing the same person removes poison). Soldier shrugs off the mafia kill unless poisoned that night.",
      },
      {
        title: "Day",
        body: "Discuss first, then vote in the final 15 seconds. Whoever has the most votes alone is voted out — a tie spares everyone. Skip is an option and wins only if it leads alone. Miss your vote twice and you die from AFK. Juggler may once pick four players; town sees the targets, only the Juggler learns how many are evil.",
      },
      {
        title: "Drunk & succession",
        body: "Drunk believes they hold a town power role (that real role is removed from the deck) — their results are usually wrong. If the Mafia Boss dies with no Goon left, a living Poisoner or Blackmailer is promoted to Goon and loses their old power. All mafia see their teammates.",
      },
      {
        title: "Local mode",
        body: "Choose Local at intake or in the lobby for a table-side game on multiple phones: no chat, voice, or day discussion. Deaths and vote results appear as popups only — remember them. Online mode keeps the full experience.",
      },
      {
        title: "Voice & chat",
        body: "In Online mode, town chat and voice open during day discussion. Mafia get a private channel at night only. Dead players use the graveyard. Personal intel is shown once as a popup and via an eye icon for that day only.",
      },
      {
        title: "Winning",
        body: "Town wins when all Mafia are eliminated. Mafia win when they strictly outnumber the remaining Town.",
      },
    ],
  },
  "spot-it": {
    title: "Spot It — how it works",
    sections: [
      {
        title: "The race",
        body: "Every player sees their own card and one shared center card. Exactly one symbol matches. Spot it and claim before anyone else.",
      },
      {
        title: "Claiming",
        body: "Tap the matching symbol on your card. First valid claim takes the center card into your pile and flips a new center.",
      },
      {
        title: "Tower",
        body: "Keep stacking wins. The tallest tower at the end of the deck wins the match.",
      },
      {
        title: "Comms",
        body: "Public chat and voice stay open for the whole match so you can talk while you race.",
      },
    ],
  },
  "tic-tac-toe": {
    title: "Tic-Tac-Toe — how it works",
    sections: [
      {
        title: "The board",
        body: "Classic 3×3 grid. You and one opponent take turns placing marks. Hover a cell to preview your mark before committing.",
      },
      {
        title: "Turns",
        body: "Who opens is random each match — the host is not guaranteed first. A turn timer (10–60s) keeps the duel moving.",
      },
      {
        title: "Comms",
        body: "Public chat and voice stay open for the whole match so you can talk while you play.",
      },
      {
        title: "Winning",
        body: "First to three in a row — horizontal, vertical, or diagonal — wins. Full board with no line is a draw.",
      },
    ],
  },
  "connect-4": {
    title: "Connect 4 — how it works",
    sections: [
      {
        title: "The drop",
        body: "Pick a column; your disc falls with gravity to the lowest open slot. Hover a column to preview the landing spot.",
      },
      {
        title: "Turns",
        body: "Players alternate drops under a turn timer. Plan ahead — blocking and traps matter as much as your own four.",
      },
      {
        title: "Winning",
        body: "Connect four discs in a row — horizontal, vertical, or diagonal. Fill the grid with no four and it's a draw.",
      },
    ],
  },
  battleship: {
    title: "Tactical Battleship — how it works",
    sections: [
      {
        title: "Fleet placement",
        body: "Each player secretly places five ships (Carrier 5 through Destroyer 2) on a 10×10 grid. Randomize or place by hand, then lock in.",
      },
      {
        title: "Combat & AP",
        body: "Take turns striking. Misses award 1 AP, hits 2, sinks 3. Spend AP on Sonar (scan), Cluster (+), Torpedo (row/col until hit), Smoke (hide 3×3 for 2 turns), or Recon (reveal a line).",
      },
      {
        title: "Winning",
        body: "Sink every enemy ship cell to win. Host can rematch from the debrief without leaving the room.",
      },
    ],
  },
  "five-alive": {
    title: "5 Alive — how it works",
    sections: [
      {
        title: "The stack",
        body: "Keep a running total under 21. Play numbers carefully — busts cost lives.",
      },
      {
        title: "Bombs",
        body: "Bombs demand an instant 0. Miss the window and you take the hit.",
      },
      {
        title: "Wild cards",
        body: "Skip, reverse, draw +1/+2, and bombs shake up the pile. Wild cards let you reset the running total when you're in trouble.",
      },
    ],
  },
  "exploding-kittens": {
    title: "Exploding Kittens — how it works",
    sections: [
      {
        title: "Turn structure",
        body: "Play any number of valid cards, then draw one card from the pile. If you draw an Exploding Kitten without a Defuse, you're out.",
      },
      {
        title: "Combos & interrupts",
        body: "Match cat pairs to steal, triples to demand a card type, or five different cats to pick from discard. Nope cards cancel actions during a short reaction window.",
      },
      {
        title: "Attack & Favor",
        body: "Attack passes multiple turns to the next player. Favor forces an opponent to give you a card of their choice.",
      },
    ],
  },
  "detonation-cats": {
    title: "Exploding Kittens — how it works",
    sections: [
      {
        title: "Turn structure",
        body: "Play any number of valid cards, then draw one card from the pile. If you draw an Exploding Kitten without a Defuse, you're out.",
      },
      {
        title: "Combos & interrupts",
        body: "Match cat pairs to steal, triples to demand a card type, or five different cats to pick from discard. Nope cards cancel actions during a short reaction window.",
      },
      {
        title: "Attack & Favor",
        body: "Attack passes multiple turns to the next player. Favor forces an opponent to give you a card of their choice.",
      },
    ],
  },
};

export function GameRulesModal({
  open,
  gameId,
  onClose,
}: {
  open: boolean;
  gameId: string | null;
  onClose: () => void;
}) {
  if (!open || !gameId) return null;

  const rules = RULES_BY_GAME[gameId] ?? {
    title: "How it works",
    sections: [
      {
        title: "Field note",
        body: "Rules for this operation are still being drafted. Create a room and learn on the floor.",
      },
    ],
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-void/70 p-4 backdrop-blur-[20px]"
      data-lenis-prevent
      onClick={onClose}
    >
      <div onClick={(e) => e.stopPropagation()}>
        <GlassPanel
          variant="paper"
          className="max-h-[85vh] w-full max-w-lg overflow-y-auto p-6 sm:p-8"
        >
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-crimson">
            Field manual
          </p>
          <h2 className="mt-2 font-display text-2xl font-bold text-crimson">
            {rules.title}
          </h2>

          <div className="mt-6 space-y-4 text-sm text-crimson/70">
            {rules.sections.map((section) => (
              <section key={section.title}>
                <h3 className="font-display text-base font-semibold text-crimson">
                  {section.title}
                </h3>
                <p className="mt-1">{section.body}</p>
              </section>
            ))}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="mt-6 w-full rounded-sm border border-crimson/40 py-3 font-mono text-xs uppercase tracking-widest text-crimson"
          >
            Close dossier
          </button>
        </GlassPanel>
      </div>
    </div>
  );
}
