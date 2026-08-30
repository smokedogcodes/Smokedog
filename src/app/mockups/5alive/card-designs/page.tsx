"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { fadeUp, stagger } from "@/components/ui/motion";
import { SiteHeader } from "@/components/ui/SiteHeader";
import { FiveAliveDeckCard, FiveAliveDeckCardBack } from "@/components/mockups/five-alive/FiveAliveDeckCard";
import {
  FIVE_ALIVE_LIFE_GALLERY,
  FIVE_ALIVE_PLAY_GALLERY,
  cardTypeName,
} from "@/lib/mockups/five-alive-sample";

function CardGrid({ cards }: { cards: typeof FIVE_ALIVE_PLAY_GALLERY }) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
      {cards.map((card) => (
        <div
          key={card.id}
          className="flex flex-col items-center gap-2 rounded-xl border border-white/10 bg-black/20 p-4"
        >
          <FiveAliveDeckCard card={card} width={88} />
          <p className="text-center font-display text-sm font-bold">{cardTypeName(card)}</p>
        </div>
      ))}
    </div>
  );
}

export default function FiveAliveCardDesignsPage() {
  return (
    <div className="min-h-screen bg-[#1a0f0a] text-white">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 pb-16 pt-8">
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-10">
          <motion.div variants={fadeUp} className="space-y-2">
            <Link
              href="/mockups"
              className="inline-flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-white/50 hover:text-white"
            >
              <ArrowLeft className="size-3.5" />
              All mockups
            </Link>
            <p className="font-mono text-[10px] uppercase tracking-[0.25em] text-white/35">
              5 Alive · Official deck
            </p>
            <h1 className="font-display text-3xl font-bold">Full Deck Gallery</h1>
            <p className="max-w-2xl font-sans text-sm text-white/60">
              Play cards go in your hand. Alive heart cards track each member&apos;s lives
              (5 per player) — they sit beside you, not in the draw pile.
            </p>
          </motion.div>

          <motion.div variants={fadeUp} className="flex justify-center">
            <div className="text-center">
              <FiveAliveDeckCardBack width={100} />
              <p className="mt-2 font-mono text-[10px] uppercase tracking-widest text-white/45">
                Card back
              </p>
            </div>
          </motion.div>

          <motion.section variants={fadeUp} className="space-y-4">
            <h2 className="font-display text-xl font-bold">Play deck</h2>
            <p className="font-sans text-sm text-white/50">
              Numbers, actions, and the death skull — drawn and played from your hand.
            </p>
            <CardGrid cards={FIVE_ALIVE_PLAY_GALLERY} />
          </motion.section>

          <motion.section variants={fadeUp} className="space-y-4">
            <h2 className="font-display text-xl font-bold">Alive — member lives</h2>
            <p className="font-sans text-sm text-white/50">
              Each player starts with 5 heart cards. Busting or failing a bomb costs one life.
              Color varies by card art — all hearts mean the same thing.
            </p>
            <CardGrid cards={FIVE_ALIVE_LIFE_GALLERY} />
          </motion.section>
        </motion.div>
      </main>
    </div>
  );
}
