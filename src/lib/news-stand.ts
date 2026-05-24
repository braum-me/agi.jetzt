import newsItems from '../data/news.json';

export function getNewestNewsDate(): string {
  const sorted = [...(newsItems as Array<{ date: string }>)].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return sorted[0]?.date ?? '';
}

export function formatNewsStand(): string {
  const date = getNewestNewsDate();
  if (!date) return '';
  return new Date(date).toLocaleDateString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
