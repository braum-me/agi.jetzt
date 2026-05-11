import type { APIRoute } from 'astro';
import { Resvg } from '@resvg/resvg-js';

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

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

export const GET: APIRoute = ({ params }) => {
  const slug = params.slug as string;
  const page = pages[slug];
  if (!page) return new Response('Not found', { status: 404 });

  const svg = `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${PAPER}"/>
        <stop offset="100%" stop-color="#efe9dc"/>
      </linearGradient>
    </defs>
    <rect width="1200" height="630" fill="url(#bg)"/>
    <rect x="0" y="0" width="1200" height="6" fill="${page.accent}"/>

    <!-- Brand -->
    <g transform="translate(72, 82)">
      <circle cx="18" cy="18" r="18" fill="${INK}"/>
      <text x="50" y="26" font-family="Georgia, serif" font-size="26" font-weight="500" fill="${INK}">
        agi<tspan fill="${MUTED}">.</tspan><tspan font-style="italic">jetzt</tspan>
      </text>
    </g>

    <!-- Eyebrow badge -->
    <g transform="translate(72, 190)">
      <rect x="0" y="0" width="400" height="34" rx="17" fill="${page.accent}" opacity="0.12"/>
      <text x="16" y="22" font-family="ui-monospace, 'JetBrains Mono', monospace" font-size="12" letter-spacing="3" fill="${page.accent}" font-weight="600">
        DEEP DIVE · ${esc(page.eyebrow.toUpperCase())}
      </text>
    </g>

    <!-- Title (groß, italic) — Baseline 360, Ascender bei 88pt ≈ 70 → Top 290, Gap zu Badge (ends 224) = 66 -->
    <g transform="translate(72, 360)">
      <text x="0" y="0" font-family="Georgia, 'Instrument Serif', serif" font-size="88" font-style="italic" font-weight="400" fill="${INK}">${esc(page.title)}</text>
    </g>

    <!-- Divider line -->
    <line x1="72" y1="420" x2="400" y2="420" stroke="${page.accent}" stroke-width="3"/>

    <!-- Tagline -->
    <g transform="translate(72, 475)">
      <text x="0" y="0" font-family="Georgia, serif" font-size="22" fill="${INK}" opacity="0.65">
        Der Weg zur Künstlichen Allgemeinen Intelligenz.
      </text>
      <text x="0" y="32" font-family="Georgia, serif" font-size="22" fill="${INK}" opacity="0.65">
        Trocken dokumentiert, datengetrieben, ohne Hype.
      </text>
    </g>

    <!-- Footer -->
    <g transform="translate(0, 580)">
      <line x1="72" y1="0" x2="1128" y2="0" stroke="${INK}" stroke-opacity="0.12" stroke-width="1"/>
      <text x="72" y="30" font-family="ui-monospace, monospace" font-size="13" letter-spacing="2" fill="${INK}" opacity="0.7">agi.jetzt/${slug}</text>
      <text x="1128" y="30" font-family="ui-monospace, monospace" font-size="13" letter-spacing="2" fill="${page.accent}" opacity="0.85" text-anchor="end" font-weight="600">STEFAN BRAUM</text>
    </g>
  </svg>`;

  const png = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 }, font: { loadSystemFonts: true } }).render().asPng();

  return new Response(png, {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
