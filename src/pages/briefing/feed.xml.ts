import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import { getCollection } from 'astro:content';

export async function GET(context: APIContext) {
  const now = new Date();
  const briefings = await getCollection('briefing', ({ data }) => !data.draft && data.date.valueOf() <= now.valueOf());
  const sorted = briefings.sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());

  return rss({
    title: 'agi.jetzt — Wöchentliches KI-Briefing',
    description:
      'Jeden Freitag: Die wichtigsten Entwicklungen der KI-Welt, eingeordnet und auf den Punkt gebracht. Von Stefan Braum.',
    site: context.site?.toString() || 'https://agi.jetzt',
    items: sorted.map((b) => ({
      title: `${b.data.title}: ${b.data.subtitle}`,
      pubDate: b.data.date,
      description: b.data.summary,
      link: `/briefing/${b.slug}/`,
      categories: b.data.tags,
      customData: `<author>${b.data.author}</author>`,
    })),
    customData: `<language>de-DE</language><webMaster>https://braum.consulting (Stefan Braum)</webMaster>`,
  });
}
