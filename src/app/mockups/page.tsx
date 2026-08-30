"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { fadeUp, stagger } from "@/components/ui/motion";
import { SiteHeader } from "@/components/ui/SiteHeader";

const EK_MOCKUPS = [
  {
    href: "/mockups/ledger-fan",
    title: "Ledger Wide Fan",
    style: "Exploding Kittens",
    layout: "Play only",
    description: "Wide fan arc — tap to play toward discard pile.",
  },
  {
    href: "/mockups/playful-rail",
    title: "Playful Scroll Rail",
    style: "Exploding Kittens",
    layout: "Play only",
    description: "Horizontal rail with zero overlap.",
  },
  {
    href: "/mockups/weeb-grid",
    title: "Weeb Two-Row Grid",
    style: "Exploding Kittens",
    layout: "Play only",
    description: "4×2 grid, every card face-up.",
  },
  {
    href: "/mockups/style-compare",
    title: "Style Compare",
    style: "Exploding Kittens",
    layout: "Play only",
    description: "Toggle Ledger / Playful / Weeb on one layout.",
  },
];

const FIVE_ALIVE_MOCKUPS = [
  {
    href: "/mockups/5alive/table",
    title: "Table — Play & Auto-Draw",
    style: "5 Alive",
    layout: "Fly animations + draw count",
    description:
      "Official deck art. Cards fly hand → center. +1/+2 auto-draw for Player 2.",
  },
  {
    href: "/mockups/5alive/card-designs",
    title: "Full Deck Gallery",
    style: "5 Alive",
    layout: "Every card in the deck",
    description: "All number, action, and wild cards matching the physical deck.",
  },
];

function MockupGrid({ items }: { items: typeof EK_MOCKUPS }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {items.map((mockup) => (
        <Link
          key={mockup.href}
          href={mockup.href}
          className="group rounded-2xl border border-crimson/20 bg-crimson/[0.03] p-6 transition hover:border-crimson/40 hover:bg-crimson/[0.06]"
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <span className="rounded-full border border-crimson/25 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest text-crimson/70">
              {mockup.style}
            </span>
            <ArrowRight className="size-4 text-crimson/40 transition group-hover:translate-x-0.5 group-hover:text-crimson" />
          </div>
          <h2 className="font-display text-xl font-bold">{mockup.title}</h2>
          <p className="mt-1 font-mono text-xs text-crimson/50">{mockup.layout}</p>
          <p className="mt-3 font-sans text-sm text-crimson/65">{mockup.description}</p>
        </Link>
      ))}
    </div>
  );
}

export default function MockupsIndexPage() {
  return (
    <div className="min-h-screen bg-manila text-crimson">
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-4 pb-16 pt-8">
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="space-y-12"
        >
          <motion.div variants={fadeUp} className="space-y-3">
            <p className="font-mono text-xs uppercase tracking-[0.25em] text-crimson/50">
              Smokedog Arena
            </p>
            <h1 className="font-display text-4xl font-bold">Card UI Mockups</h1>
            <p className="max-w-2xl font-sans text-crimson/70">
              Interactive prototypes for card games. Exploding Kittens mockups focus on
              play animation; 5 Alive mockups add draw-pile interaction, live counts, and
              richer card art.
            </p>
          </motion.div>

          <motion.section variants={fadeUp} className="space-y-4">
            <h2 className="font-display text-2xl font-bold">5 Alive</h2>
            <p className="font-sans text-sm text-crimson/60">
              Official Hasbro-style cards. Play animations, draw pile count, forced draws on +1/+2.
            </p>
            <MockupGrid items={FIVE_ALIVE_MOCKUPS} />
          </motion.section>

          <motion.section variants={fadeUp} className="space-y-4">
            <h2 className="font-display text-2xl font-bold">Exploding Kittens</h2>
            <p className="font-sans text-sm text-crimson/60">
              Hand layout and play-to-discard animation explorations.
            </p>
            <MockupGrid items={EK_MOCKUPS} />
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
