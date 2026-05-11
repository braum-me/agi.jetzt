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
    draft: z.boolean().default(false),
  }),
});

export const collections = {
  briefing: briefingCollection,
};
