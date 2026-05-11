import rss from '@astrojs/rss';
import type { APIContext } from 'astro';
import newsData from '../data/news.json';

export async function GET(context: APIContext) {
  const sortedNews = [...newsData].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  return rss({
    title: 'agi.jetzt — Live AGI News Feed',
    description:
      'Der Weg zur Künstlichen Allgemeinen Intelligenz. Kuratierte Headlines aus Research, Industrie und Politik. Kuratiert von KI, gebaut von Menschen.',
    site: context.site || 'https://agi.jetzt',
    items: sortedNews.map((n: any) => ({
      title: n.headline,
      pubDate: new Date(n.date),
      description: n.summary,
      link: n.source_url || '/',
      customData: `<source>${escapeXml(n.source)}</source><category>${escapeXml(n.category)}</category>`,
    })),
    customData: `<language>de-DE</language><webMaster>https://braum.consulting (Stefan Braum)</webMaster>`,
  });
}

function escapeXml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
