import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';
import { assertWeeklyFreeze } from './scripts/legacy-weekly-freeze.mjs';

// Weekly-Archiv-Freeze (scripts/legacy-weekly-freeze.json): Im Zustand „open" lässt der Check alles
// zu. Im Zustand „frozen" läuft er, bevor Astro irgendetwas baut — jede Abweichung vom
// festgeschriebenen Archiv bricht `astro build` (und damit den Production-Build im Dockerfile) mit
// Exit-Code ≠ 0 ab; es entsteht kein `dist/` und kein neues Image.
const weeklyArchiveFreeze = {
  name: 'weekly-archive-freeze',
  hooks: {
    'astro:config:setup': () => {
      assertWeeklyFreeze(fileURLToPath(new URL('.', import.meta.url)));
    },
  },
};

export default defineConfig({
  site: 'https://agi.jetzt',
  integrations: [weeklyArchiveFreeze, sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
