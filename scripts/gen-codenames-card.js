/**
 * Generate Codenames hub card art (noir spy / red vs blue aesthetic).
 */
const sharp = require("sharp");
const path = require("path");

const W = 512;
const H = 343;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#121016"/>
      <stop offset="50%" stop-color="#18141d"/>
      <stop offset="100%" stop-color="#0d0b10"/>
    </linearGradient>
    <linearGradient id="redCard" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#dc2626"/>
      <stop offset="100%" stop-color="#991b1b"/>
    </linearGradient>
    <linearGradient id="blueCard" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#2563eb"/>
      <stop offset="100%" stop-color="#1e40af"/>
    </linearGradient>
    <linearGradient id="neutralCard" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#d6d3d1"/>
      <stop offset="100%" stop-color="#a8a29e"/>
    </linearGradient>
    <filter id="shadow" x="-10%" y="-10%" width="120%" height="120%">
      <feDropShadow dx="0" dy="8" stdDeviation="6" flood-color="#000000" flood-opacity="0.6"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="100%" height="100%" fill="url(#bg)"/>

  <!-- Subtle grid lines background -->
  <g stroke="#ffffff" stroke-width="0.75" opacity="0.05" fill="none">
    ${Array.from({ length: 12 }, (_, i) => `<line x1="0" y1="${i * 32}" x2="${W}" y2="${i * 32}"/>`).join("")}
    ${Array.from({ length: 16 }, (_, i) => `<line x1="${i * 32}" y1="0" x2="${i * 32}" y2="${H}"/>`).join("")}
  </g>

  <!-- Dramatic Red & Blue Spotlight Glows -->
  <circle cx="110" cy="170" r="140" fill="#dc2626" opacity="0.18"/>
  <circle cx="400" cy="170" r="140" fill="#2563eb" opacity="0.18"/>

  <!-- 3D Overlapping Codenames Word Cards in the Center -->
  <!-- Neutral Card Left Behind -->
  <g transform="translate(90, 80) rotate(-14)" filter="url(#shadow)">
    <rect width="90" height="120" rx="8" fill="url(#neutralCard)"/>
    <rect x="6" y="6" width="78" height="108" rx="6" fill="#f5f5f4" opacity="0.15"/>
    <text x="45" y="70" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#44403c" text-anchor="middle" letter-spacing="1">AGENT</text>
  </g>

  <!-- Blue Agent Card Right -->
  <g transform="translate(330, 85) rotate(12)" filter="url(#shadow)">
    <rect width="90" height="120" rx="8" fill="url(#blueCard)"/>
    <rect x="6" y="6" width="78" height="108" rx="6" fill="#ffffff" opacity="0.1"/>
    <text x="45" y="70" font-family="Arial, sans-serif" font-weight="900" font-size="11" fill="#ffffff" text-anchor="middle" letter-spacing="1">SECRET</text>
  </g>

  <!-- Red Agent Card Center-Left -->
  <g transform="translate(160, 95) rotate(-5)" filter="url(#shadow)">
    <rect width="95" height="125" rx="8" fill="url(#redCard)"/>
    <rect x="6" y="6" width="83" height="113" rx="6" fill="#ffffff" opacity="0.15"/>
    <text x="47" y="72" font-family="Arial, sans-serif" font-weight="900" font-size="12" fill="#ffffff" text-anchor="middle" letter-spacing="1">DANGER</text>
  </g>

  <!-- Assassin Card Center-Right (Black / Skull) -->
  <g transform="translate(255, 95) rotate(4)" filter="url(#shadow)">
    <rect width="95" height="125" rx="8" fill="#09090b" stroke="#ef4444" stroke-width="1.5"/>
    <!-- Stylized Skull -->
    <circle cx="47" cy="50" r="14" fill="#ef4444"/>
    <rect x="40" y="60" width="14" height="10" rx="2" fill="#ef4444"/>
    <circle cx="42" cy="48" r="3.5" fill="#09090b"/>
    <circle cx="52" cy="48" r="3.5" fill="#09090b"/>
    <text x="47" y="95" font-family="Arial, sans-serif" font-weight="900" font-size="10" fill="#fca5a5" text-anchor="middle" letter-spacing="1">ASSASSIN</text>
  </g>

  <!-- Magnifying Glass / Spy Silhouette motif -->
  <circle cx="256" cy="160" r="65" fill="none" stroke="#eab308" stroke-width="3" opacity="0.4"/>
  <line x1="302" y1="206" x2="340" y2="244" stroke="#eab308" stroke-width="6" stroke-linecap="round" opacity="0.4"/>

  <!-- Title Badge Banner -->
  <rect x="136" y="270" width="240" height="44" rx="22" fill="#000000" fill-opacity="0.8" stroke="#eab308" stroke-width="1.5"/>
  <text x="256" y="298" font-family="'Trebuchet MS', Arial, sans-serif" font-size="20" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">CODENAMES</text>
</svg>`;

async function main() {
  const out = path.join(__dirname, "..", "public", "games", "codenames.jpg");
  await sharp(Buffer.from(svg)).jpeg({ quality: 90 }).toFile(out);
  console.log("Wrote", out);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
