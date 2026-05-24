import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Statische Config der 7 Deep Dives — Titel, Eyebrow, Accent-Farbe je Slug
const pages: Record<string, { eyebrow: string; title: string; accent: string }> = {
  geschichte:   { eyebrow: '12 Momente · Prognosen',          title: 'Die Chronik',              accent: '#5b3aa3' },
  kapital:      { eyebrow: 'Investment-Flows · 2026',         title: 'Das Geld',                 accent: '#b8721c' },
  laender:      { eyebrow: 'Länder & Ökosystem',              title: 'Globaler Wettlauf',        accent: '#2d5a3f' },
  compute:      { eyebrow: 'Exponential-Kurve · seit 2012',   title: 'Die Kurve',                accent: '#8b2c4d' },
  kontroversen: { eyebrow: '7 Debatten + 5 Risiken',          title: 'Die offenen Wunden',       accent: '#8b4a2c' },
  glossar:      { eyebrow: '18 Begriffe ohne Buzzword-Bingo', title: 'Das Glossar',              accent: '#3d2670' },
  methodik:     { eyebrow: 'Pipeline & Quellen-Register',     title: 'Die Pipeline',             accent: '#2d5a3f' },
};

export function getStaticPaths() {
  return Object.keys(pages).map((slug) => ({ params: { slug } }));
}

const PAPER = '#f5f1e8';
const INK = '#1a1814';
const MUTED = 'rgba(26,24,20,0.55)';

const FONTS_DIR = resolve(process.cwd(), 'src/og-fonts');
const FONT_FILES = [
  `${FONTS_DIR}/instrument-serif-latin-400-normal.ttf`,
  `${FONTS_DIR}/instrument-serif-latin-400-italic.ttf`,
  `${FONTS_DIR}/inter-tight-latin-wght-normal.ttf`,
  `${FONTS_DIR}/jetbrains-mono-latin-wght-normal.ttf`,
];

// Background pro Slug (Fallback: og-bg-master.png als Universal-Look).
// Weitere Topic-spezifische Backgrounds werden ergänzt, sobald Bilder vorhanden sind.
const BG_DIR = resolve(process.cwd(), 'public/og-templates');
const SLUG_BG: Record<string, string> = {
  compute: `${BG_DIR}/og-bg-deep-compute.png`,
};
const FALLBACK_BG = `${BG_DIR}/og-bg-master.png`;

function loadBg(slug: string): string | null {
  const path = SLUG_BG[slug] ?? FALLBACK_BG;
  if (!existsSync(path)) return null;
  return `data:image/png;base64,${readFileSync(path).toString('base64')}`;
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const GET: APIRoute = ({ params }) => {
  const slug = params.slug as string;
  const page = pages[slug];
  if (!page) return new Response('Not found', { status: 404 });

  const bgDataUri = loadBg(slug);

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${PAPER}"/>
        <stop offset="100%" stop-color="#efe9dc"/>
      </linearGradient>
      <linearGradient id="textScrim" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="#f5f1e8" stop-opacity="0.96"/>
        <stop offset="55%" stop-color="#f5f1e8" stop-opacity="0.78"/>
        <stop offset="100%" stop-color="#f5f1e8" stop-opacity="0"/>
      </linearGradient>
    </defs>

    ${bgDataUri ? `<image href="${bgDataUri}" x="0" y="0" width="1200" height="630" preserveAspectRatio="xMidYMid slice"/>` : `<rect width="1200" height="630" fill="url(#bgGrad)"/>`}
    <rect x="0" y="0" width="820" height="630" fill="url(#textScrim)"/>
    <rect x="0" y="0" width="1200" height="6" fill="${page.accent}"/>

    <!-- Brand -->
    <g transform="translate(72, 82)">
      <circle cx="18" cy="18" r="18" fill="${INK}"/>
      <text x="50" y="28" font-family="Instrument Serif, serif" font-size="28" font-weight="400" fill="${INK}">
        agi<tspan fill="${MUTED}">.</tspan><tspan font-style="italic">jetzt</tspan>
      </text>
    </g>

    <!-- Eyebrow badge -->
    <g transform="translate(72, 190)">
      <rect x="0" y="0" width="430" height="34" rx="17" fill="${page.accent}" opacity="0.14"/>
      <text x="16" y="23" font-family="JetBrains Mono, monospace" font-size="12" letter-spacing="3" fill="${page.accent}" font-weight="600">
        DEEP DIVE · ${esc(page.eyebrow.toUpperCase())}
      </text>
    </g>

    <!-- Title (groß, italic) -->
    <g transform="translate(72, 360)">
      <text x="0" y="0" font-family="Instrument Serif, serif" font-size="88" font-style="italic" font-weight="400" fill="${INK}">${esc(page.title)}</text>
    </g>

    <!-- Divider line -->
    <line x1="72" y1="420" x2="400" y2="420" stroke="${page.accent}" stroke-width="3"/>

    <!-- Tagline -->
    <g transform="translate(72, 475)">
      <text x="0" y="0" font-family="Instrument Serif, serif" font-size="22" fill="${INK}" opacity="0.7">
        Der Weg zur Künstlichen Allgemeinen Intelligenz.
      </text>
      <text x="0" y="32" font-family="Instrument Serif, serif" font-size="22" fill="${INK}" opacity="0.7">
        Trocken dokumentiert, datengetrieben, ohne Hype.
      </text>
    </g>

    <!-- Footer -->
    <g transform="translate(0, 580)">
      <line x1="72" y1="0" x2="1128" y2="0" stroke="${INK}" stroke-opacity="0.12" stroke-width="1"/>
      <text x="72" y="30" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="2" fill="${INK}" opacity="0.72">agi.jetzt/${slug}</text>
      <text x="1128" y="30" font-family="JetBrains Mono, monospace" font-size="13" letter-spacing="2" fill="${page.accent}" opacity="0.88" text-anchor="end" font-weight="600">STEFAN BRAUM</text>
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
