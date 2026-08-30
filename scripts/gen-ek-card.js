/**
 * Generate Exploding Kittens hub card art matching the parchment/ink style
 * of the other /public/games/*.jpg cards (gritty sketch, crimson splatters).
 */
const sharp = require("sharp");
const path = require("path");

const W = 512;
const H = 343;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <filter id="grain">
      <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="4" stitchTiles="stitch"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.45  0 0 0 0 0.35  0 0 0 0 0.25  0 0 0 0.18 0"/>
    </filter>
    <filter id="bleed">
      <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="2" result="n"/>
      <feDisplacementMap in="SourceGraphic" in2="n" scale="3" xChannelSelector="R" yChannelSelector="G"/>
    </filter>
    <filter id="sketch">
      <feTurbulence type="fractalNoise" baseFrequency="0.7" numOctaves="3" result="t"/>
      <feDisplacementMap in="SourceGraphic" in2="t" scale="1.8"/>
    </filter>
    <radialGradient id="s1" cx="18%" cy="28%" r="42%">
      <stop offset="0%" stop-color="#c9b896" stop-opacity="0.45"/>
      <stop offset="100%" stop-color="#ebe4d4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="s2" cx="82%" cy="72%" r="38%">
      <stop offset="0%" stop-color="#b9a888" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#ebe4d4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="s3" cx="60%" cy="12%" r="28%">
      <stop offset="0%" stop-color="#d6c8a8" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="#ebe4d4" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <!-- Aged parchment -->
  <rect width="${W}" height="${H}" fill="#ebe4d4"/>
  <rect width="${W}" height="${H}" fill="url(#s1)"/>
  <rect width="${W}" height="${H}" fill="url(#s2)"/>
  <rect width="${W}" height="${H}" fill="url(#s3)"/>
  <rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.55"/>

  <!-- Crease / fold hints -->
  <path d="M0 90 Q256 78 512 95" fill="none" stroke="#c4b59a" stroke-width="18" opacity="0.25"/>
  <path d="M40 0 Q55 170 30 343" fill="none" stroke="#c4b59a" stroke-width="22" opacity="0.18"/>

  <!-- Dossier / fuse metadata (faint) -->
  <g fill="#6b3a32" opacity="0.14" font-family="Courier New, monospace" font-size="9">
    <text x="16" y="26">(12, 88, 201)</text>
    <text x="16" y="40">(41, -7, 55)</text>
    <text x="16" y="54">(03, 19, 104)</text>
    <text x="16" y="68">(77, 2, -18)</text>
    <text x="390" y="38">FUSE   00:03</text>
    <text x="390" y="52">DECK      56</text>
    <text x="390" y="66">LIVES     ??</text>
    <text x="390" y="290">SCORE</text>
    <text x="390" y="306">2  07  91</text>
    <text x="390" y="320">DEFUSE  ???</text>
  </g>

  <!-- Heavy crimson + black ink splatters (five-alive energy) -->
  <g filter="url(#bleed)">
    <path d="M380 20 C420 10 480 30 500 70 C510 100 470 120 440 95 C400 70 360 50 380 20Z"
          fill="#9b2c2c" opacity="0.72"/>
    <path d="M450 50 C470 40 505 55 508 85 C500 110 470 100 455 80Z"
          fill="#3a1814" opacity="0.55"/>
    <ellipse cx="470" cy="55" rx="28" ry="20" fill="#c0392b" opacity="0.55"/>
    <circle cx="500" cy="40" r="10" fill="#8b1e1e" opacity="0.7"/>
    <circle cx="430" cy="100" r="7" fill="#9b2c2c" opacity="0.55"/>
    <circle cx="490" cy="110" r="4" fill="#3a1814" opacity="0.55"/>
    <path d="M400 80 L415 55 L420 78 L445 60 L428 85 L450 95 L422 98 L415 120 L408 98 L385 105 L400 88Z"
          fill="#c0392b" opacity="0.5"/>

    <path d="M-10 220 C40 200 90 240 110 280 C120 310 70 330 40 300 C10 270 -20 250 -10 220Z"
          fill="#9b2c2c" opacity="0.58"/>
    <ellipse cx="50" cy="250" rx="40" ry="28" fill="#8b1e1e" opacity="0.45"/>
    <circle cx="20" cy="210" r="9" fill="#c0392b" opacity="0.55"/>
    <circle cx="95" cy="300" r="6" fill="#3a1814" opacity="0.5"/>
    <circle cx="130" cy="260" r="4" fill="#9b2c2c" opacity="0.5"/>

    <ellipse cx="260" cy="310" rx="70" ry="22" fill="#9b2c2c" opacity="0.28"/>
    <circle cx="180" cy="40" r="5" fill="#c0392b" opacity="0.45"/>
    <circle cx="320" cy="30" r="3" fill="#8b1e1e" opacity="0.5"/>
  </g>

  <!-- Main sketch: exploding kitten -->
  <g transform="translate(250,168)" filter="url(#sketch)" opacity="0.92">
    <!-- Blast rays (ink brush) -->
    <g stroke="#2a1814" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.7">
      <path d="M2 -105 L6 -62"/>
      <path d="M-4 -102 L-8 -60"/>
      <path d="M78 -78 L48 -48"/>
      <path d="M102 2 L62 4"/>
      <path d="M80 78 L48 48"/>
      <path d="M0 108 L2 64"/>
      <path d="M-78 80 L-48 48"/>
      <path d="M-105 0 L-62 -2"/>
      <path d="M-80 -78 L-48 -46"/>
    </g>
    <g fill="#9b2c2c" opacity="0.75">
      <path d="M0 -118 L12 -64 L0 -74 L-12 -64 Z"/>
      <path d="M118 0 L64 12 L74 0 L64 -12 Z"/>
      <path d="M0 118 L-12 64 L0 74 L12 64 Z"/>
      <path d="M-118 0 L-64 -12 L-74 0 L-64 12 Z"/>
      <path d="M86 -86 L48 -54 L56 -44 Z"/>
      <path d="M88 86 L56 46 L46 56 Z"/>
      <path d="M-86 88 L-46 56 L-56 46 Z"/>
      <path d="M-88 -86 L-56 -44 L-46 -54 Z"/>
    </g>
    <!-- spark dots -->
    <g fill="#2a1814" opacity="0.55">
      <circle cx="58" cy="-58" r="3.5"/>
      <circle cx="70" cy="38" r="2.5"/>
      <circle cx="-65" cy="52" r="3"/>
      <circle cx="-52" cy="-62" r="2.5"/>
      <circle cx="18" cy="-92" r="2"/>
      <circle cx="-22" cy="95" r="2.5"/>
      <circle cx="95" cy="-20" r="2"/>
    </g>

    <!-- Cat — open ink outline, cross-hatch, no solid white fill -->
    <g fill="none" stroke="#2a1814" stroke-width="2.6" stroke-linejoin="round" stroke-linecap="round">
      <!-- ears -->
      <path d="M-30 -42 L-42 -82 L-6 -52"/>
      <path d="M30 -42 L42 -82 L6 -52"/>
      <!-- head -->
      <path d="M-36 -18 Q-38 -55 0 -58 Q38 -55 36 -18 Q34 18 0 22 Q-34 18 -36 -18Z"/>
      <!-- body -->
      <path d="M-34 18 Q-42 55 0 62 Q42 55 34 18"/>
      <!-- front paws hint -->
      <path d="M-18 55 Q-22 72 -10 74"/>
      <path d="M18 55 Q22 72 10 74"/>
      <!-- tail -->
      <path d="M32 40 Q58 28 62 8 Q66 -8 52 -4"/>
    </g>
    <!-- ear fill (crimson wash) -->
    <path d="M-28 -46 L-36 -72 L-12 -54 Z" fill="#9b2c2c" opacity="0.5" stroke="none"/>
    <path d="M28 -46 L36 -72 L12 -54 Z" fill="#9b2c2c" opacity="0.5" stroke="none"/>

    <!-- Face -->
    <g stroke="#2a1814" stroke-width="2.2" fill="none" stroke-linecap="round">
      <ellipse cx="-14" cy="-22" rx="10" ry="12"/>
      <ellipse cx="14" cy="-22" rx="10" ry="12"/>
      <circle cx="-12" cy="-20" r="3.5" fill="#2a1814" stroke="none"/>
      <circle cx="16" cy="-20" r="3.5" fill="#2a1814" stroke="none"/>
      <!-- eyebrows raised / panic -->
      <path d="M-24 -36 Q-14 -40 -4 -36"/>
      <path d="M4 -36 Q14 -40 24 -36"/>
      <!-- nose -->
      <path d="M0 -10 L-5 -3 L5 -3 Z" fill="#9b2c2c" stroke="#2a1814" stroke-width="1.5"/>
      <!-- open mouth -->
      <path d="M-10 4 Q0 18 10 4"/>
      <ellipse cx="0" cy="10" rx="5" ry="4" fill="#9b2c2c" opacity="0.55" stroke="#2a1814" stroke-width="1.4"/>
    </g>
    <g stroke="#2a1814" stroke-width="1.5" opacity="0.75" stroke-linecap="round">
      <path d="M-20 -2 L-52 -12"/>
      <path d="M-20 4 L-54 4"/>
      <path d="M-20 10 L-50 18"/>
      <path d="M20 -2 L52 -12"/>
      <path d="M20 4 L54 4"/>
      <path d="M20 10 L50 18"/>
    </g>

    <!-- Cross-hatch shading -->
    <g stroke="#2a1814" stroke-width="1.1" opacity="0.28">
      <path d="M-22 22 L-8 52"/>
      <path d="M-12 20 L2 54"/>
      <path d="M4 22 L14 50"/>
      <path d="M-28 -28 L-16 -4"/>
      <path d="M20 -30 L30 -6"/>
      <path d="M-32 30 L-24 48"/>
      <path d="M28 28 L22 48"/>
    </g>

    <!-- Bomb with lit fuse -->
    <g transform="translate(48,12)">
      <circle cx="0" cy="10" r="18" fill="#2a1814" opacity="0.88"/>
      <rect x="-5" y="-12" width="10" height="10" rx="1.5" fill="#2a1814"/>
      <path d="M0 -12 Q10 -24 6 -36" fill="none" stroke="#c0392b" stroke-width="2.8" stroke-linecap="round"/>
      <g fill="#c0392b">
        <path d="M6 -40 L10 -30 L6 -33 L2 -30 Z"/>
        <path d="M6 -40 L14 -38 L8 -35 L12 -28 Z" opacity="0.7"/>
        <circle cx="8" cy="-42" r="3" opacity="0.6"/>
      </g>
      <ellipse cx="-6" cy="6" rx="4" ry="7" fill="#ebe4d4" opacity="0.18"/>
      <!-- fuse sparks -->
      <circle cx="14" cy="-28" r="2" fill="#c0392b" opacity="0.7"/>
      <circle cx="-2" cy="-34" r="1.5" fill="#9b2c2c" opacity="0.5"/>
    </g>
  </g>

  <!-- Torn edge darkening -->
  <rect x="0" y="0" width="${W}" height="10" fill="#c4b59a" opacity="0.25"/>
  <rect x="0" y="${H - 12}" width="${W}" height="12" fill="#b8a888" opacity="0.3"/>
  <rect x="0" y="0" width="10" height="${H}" fill="#c4b59a" opacity="0.22"/>
  <rect x="${W - 12}" y="0" width="12" height="${H}" fill="#b8a888" opacity="0.28"/>
  <!-- irregular edge bites -->
  <path d="M0 0 L20 0 Q12 8 0 14 Z" fill="#d4c8b0" opacity="0.5"/>
  <path d="M512 0 L492 0 Q500 10 512 18 Z" fill="#d4c8b0" opacity="0.45"/>
  <path d="M0 343 L18 343 Q10 330 0 325 Z" fill="#c9b896" opacity="0.5"/>
</svg>`;

async function main() {
  const out = path.join(__dirname, "..", "public", "games", "exploding-kittens.jpg");
  await sharp(Buffer.from(svg))
    .jpeg({ quality: 90, mozjpeg: true })
    .toFile(out);
  const meta = await sharp(out).metadata();
  console.log("Wrote", out, `${meta.width}x${meta.height}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
