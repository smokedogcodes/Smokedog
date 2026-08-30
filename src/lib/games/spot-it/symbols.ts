/** 57 Spot It symbols — colorful emoji figures (index = symbolId). */
export const SPOT_IT_EMOJIS = [
  "🍎",
  "🐶",
  "🐱",
  "🦄",
  "🐸",
  "🐵",
  "🦁",
  "🐼",
  "🐙",
  "🦋",
  "🌸",
  "🌲",
  "🌵",
  "🍄",
  "⭐",
  "🌙",
  "☀️",
  "⚡",
  "🔥",
  "💧",
  "❄️",
  "🌈",
  "⚽",
  "🏀",
  "🎯",
  "🎵",
  "🎸",
  "🎨",
  "🎭",
  "🎩",
  "👓",
  "👑",
  "💎",
  "🔑",
  "🔔",
  "⏰",
  "💡",
  "📷",
  "🚗",
  "✈️",
  "🚀",
  "⛵",
  "🏠",
  "🎃",
  "👻",
  "🤖",
  "👽",
  "🍕",
  "🍩",
  "🍦",
  "🎂",
  "🎁",
  "🎈",
  "🍀",
  "🌺",
  "🐠",
  "🐞",
] as const;

export type SpotItEmoji = (typeof SPOT_IT_EMOJIS)[number];

/** @deprecated Prefer `symbolEmoji` — kept for any leftover key-based callers. */
export const SPOT_IT_SYMBOLS = SPOT_IT_EMOJIS;

export type SpotItSymbolKey = SpotItEmoji;

export function symbolEmoji(id: number): SpotItEmoji {
  const n = SPOT_IT_EMOJIS.length;
  return SPOT_IT_EMOJIS[((id % n) + n) % n]!;
}

export function symbolKey(id: number): SpotItSymbolKey {
  return symbolEmoji(id);
}

/** Twemoji SVG code path (jdecked/twemoji). */
export function emojiToTwemojiCode(emoji: string): string {
  const cps: number[] = [];
  for (const ch of emoji) {
    const cp = ch.codePointAt(0);
    if (cp == null) continue;
    // Drop VS16 — Twemoji asset names omit it for most simple emoji.
    if (cp === 0xfe0f) continue;
    cps.push(cp);
  }
  return cps.map((c) => c.toString(16)).join("-");
}

export function twemojiSvgUrl(emoji: string): string {
  return `https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg/${emojiToTwemojiCode(emoji)}.svg`;
}
