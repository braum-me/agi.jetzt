import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { formatNewsStand } from '../lib/news-stand';

const INK = '#1a1814';
const ACCENT = '#5b3aa3';
const BURGUNDY = '#8b2c4d';
const MUTED = 'rgba(26,24,20,0.55)';

const FONTS_DIR = resolve(process.cwd(), 'src/og-fonts');
const FONT_FILES = [
  `${FONTS_DIR}/instrument-serif-latin-400-normal.ttf`,
  `${FONTS_DIR}/instrument-serif-latin-400-italic.ttf`,
  `${FONTS_DIR}/inter-tight-latin-wght-normal.ttf`,
  `${FONTS_DIR}/jetbrains-mono-latin-wght-normal.ttf`,
];

const BG_PATH = resolve(process.cwd(), 'public/og-templates/og-bg-master.png');
const BG_DATA_URI = existsSync(BG_PATH)
  ? `data:image/png;base64,${readFileSync(BG_PATH).toString('base64')}`
  : null;

export const GET: APIRoute = () => {
  const stand = formatNewsStand();

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="accentBar" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${BURGUNDY}"/>
        <stop offset="100%" stop-color="${ACCENT}"/>
      </linearGradient>
      <linearGradient id="textScrim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#f5f1e8" stop-opacity="0.97"/>
        <stop offset="55%" stop-color="#f5f1e8" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="#f5f1e8" stop-opacity="0"/>
      </linearGradient>
    </defs>

    ${BG_DATA_URI ? `<image href="${BG_DATA_URI}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="1200" height="630" fill="#f5f1e8"/>`}
    <rect x="0" y="0" width="820" height="630" fill="url(#textScrim)"/>
    <rect x="0" y="0" width="1200" height="6" fill="url(#accentBar)"/>

    <!-- Brand -->
    <g transform="translate(72, 82)">
      <circle cx="18" cy="18" r="18" fill="${INK}"/>
      <text x="50" y="28" font-family="Instrument Serif, serif" font-size="28" font-weight="400" fill="${INK}">
        agi<tspan fill="${MUTED}">.</tspan><tspan font-style="italic">jetzt</tspan>
      </text>
    </g>

    <!-- Live-Stand eyebrow -->
    <g transform="translate(72, 170)">
      <rect x="0" y="0" width="290" height="34" rx="17" fill="${ACCENT}" opacity="0.14"/>
      <circle cx="18" cy="17" r="4" fill="${ACCENT}"/>
      <text x="34" y="23" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="3" fill="${ACCENT}" font-weight="600">
        LIVE · NEWS-STAND ${stand}
      </text>
    </g>

    <!-- Headline -->
    <g transform="translate(72, 290)" font-family="Instrument Serif, serif" fill="${INK}">
      <text x="0" y="0" font-size="74" font-weight="400">Der Weg zur</text>
      <text x="0" y="86" font-size="74" font-style="italic" fill="${ACCENT}">Allgemeinen Intelligenz</text>
    </g>

    <!-- Subline -->
    <g transform="translate(72, 470)">
      <text x="0" y="0" font-family="Inter Tight, sans-serif" font-size="20" fill="${INK}" opacity="0.78">
        Live-Tracking der wichtigsten Technologierevolution unserer Zeit.
      </text>
      <text x="0" y="28" font-family="Inter Tight, sans-serif" font-size="20" fill="${INK}" opacity="0.78">
        News täglich · Dashboard quartalsweise · ohne Hype.
      </text>
    </g>

    <!-- Footer -->
    <g transform="translate(0, 580)">
      <line x1="72" y1="0" x2="1128" y2="0" stroke="${INK}" stroke-opacity="0.12" stroke-width="1"/>
      <text x="72" y="30" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="3" fill="${INK}" opacity="0.72">
        KURATIERT VON KI · GEBAUT VON STEFAN BRAUM
      </text>
      <text x="1128" y="30" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="2" fill="${BURGUNDY}" opacity="0.88" text-anchor="end" font-weight="600">agi.jetzt</text>
    </g>
  </svg>`;

  const png = new Resvg(svg, {
    fitTo: { mode: 'width', value: 1200 },
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: 'Instrument Serif',
    },
  }).render().asPng();

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
