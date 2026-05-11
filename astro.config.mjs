import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://agi.jetzt',
  integrations: [sitemap()],
  vite: {
    plugins: [tailwindcss()],
  },
});
