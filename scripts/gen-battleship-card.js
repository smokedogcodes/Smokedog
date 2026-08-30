/**
 * Generate Tactical Battleship hub card art (parchment / crimson ink style).
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
    <radialGradient id="s1" cx="20%" cy="30%" r="45%">
      <stop offset="0%" stop-color="#c9b896" stop-opacity="0.4"/>
      <stop offset="100%" stop-color="#ebe4d4" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="100%" height="100%" fill="#ebe4d4"/>
  <rect width="100%" height="100%" fill="url(#s1)"/>
  <rect width="100%" height="100%" filter="url(#grain)" opacity="0.55"/>
  <!-- Grid -->
  <g stroke="#3a2f28" stroke-width="1.2" opacity="0.55" fill="none">
    ${Array.from({ length: 8 }, (_, i) => {
      const x = 70 + i * 28;
      const y = 55 + i * 28;
      return `<line x1="${x}" y1="55" x2="${x}" y2="279"/><line x1="70" y1="${y}" x2="294" y2="${y}"/>`;
    }).join("")}
    <rect x="70" y="55" width="224" height="224"/>
  </g>
  <!-- Ships as ink bars -->
  <g fill="#8b1e1e" opacity="0.85">
    <rect x="98" y="83" width="140" height="14" rx="2"/>
    <rect x="126" y="139" width="112" height="14" rx="2"/>
    <rect x="182" y="195" width="84" height="14" rx="2" transform="rotate(90 182 195)"/>
    <rect x="98" y="223" width="56" height="14" rx="2"/>
  </g>
  <!-- Hits -->
  <g fill="none" stroke="#8b1e1e" stroke-width="2.5">
    <circle cx="161" cy="146" r="7"/>
    <circle cx="189" cy="146" r="7"/>
    <line x1="240" y1="100" x2="255" y2="115"/>
    <line x1="255" y1="100" x2="240" y2="115"/>
  </g>
  <!-- Radar sweep hint -->
  <path d="M360 90 A90 90 0 0 1 450 180" fill="none" stroke="#8b1e1e" stroke-width="3" opacity="0.5"/>
  <circle cx="360" cy="180" r="8" fill="#8b1e1e"/>
  <text x="330" y="300" font-family="Georgia, serif" font-size="22" fill="#3a2f28" opacity="0.75">TACTICAL</text>
</svg>`;

async function main() {
  const out = path.join(__dirname, "..", "public", "games", "battleship.jpg");
  await sharp(Buffer.from(svg)).jpeg({ quality: 88 }).toFile(out);
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
