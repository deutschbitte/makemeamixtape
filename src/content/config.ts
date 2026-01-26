import { defineCollection, z } from 'astro:content';

const trackSchema = z.object({
  title: z.string(),
  artist: z.string(),
});

const mixtapesCollection = defineCollection({
  type: 'data',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    format: z.enum(['cd', 'cassette', 'playlist']).optional().default('cd'),
    notes: z.string().optional(),
    coverImage: z.string().optional(),
    spotifyUrl: z.string().optional(),
    artOfTheMixUrl: z.string().optional(),
    published: z.boolean().optional().default(true),
    tracks: z.array(trackSchema),
    sideA: z.array(trackSchema).optional(),
    sideB: z.array(trackSchema).optional(),
  }),
});

export const collections = {
  'mixtapes': mixtapesCollection,
};