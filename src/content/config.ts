import { defineCollection, z } from 'astro:content';

const mixtapesCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    notes: z.string().optional(),
    coverImage: z.string().optional(),
    spotifyUrl: z.string().optional(),
    published: z.boolean().optional().default(true),
    tracks: z.array(z.object({
      title: z.string(),
      artist: z.string(),
    })),
  }),
});

export const collections = {
  'mixtapes': mixtapesCollection,
};