import { defineCollection, z } from 'astro:content';

const briefingCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    subtitle: z.string(),
    date: z.date(),
    kw: z.number(),
    year: z.number(),
    author: z.string().default('Stefan Braum'),
    summary: z.string(),
    topStory: z.string(),
    statsHighlight: z.object({
      value: z.string(),
      label: z.string(),
      context: z.string(),
    }),
    tags: z.array(z.string()),
    // PR review is the publish gate. Omitted values default to published;
    // an explicit `draft: true` is invalid and must never reach production.
    draft: z.literal(false).default(false),
  }),
});

export const collections = {
  briefing: briefingCollection,
};
