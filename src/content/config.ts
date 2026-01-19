import { defineCollection, z } from 'astro:content';

const mixtapesCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    year: z.string(),
    coverImage: z.string().optional(),
    spotifyUrl: z.string().optional(),
    tracks: z.array(z.object({
      title: z.string(),
      artist: z.string(),
    })),
  }),
});

export const collections = {
  'mixtapes': mixtapesCollection,
};