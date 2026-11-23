import { z } from 'zod';

export const slugify = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60);

export const roomTypeBody = z.object({
  name: z.string().trim().min(3, 'Name is too short').max(80),
  slug: z.string().trim().max(60).optional(),
  tagline: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10, 'Add a longer description').max(2000),
  basePrice: z.coerce.number().positive('Price must be above 0').max(1000000),
  maxAdults: z.coerce.number().int().min(1).max(8),
  maxChildren: z.coerce.number().int().min(0).max(6),
  sizeSqm: z.coerce.number().int().min(11, 'Size must be above 10 m²').max(1000),
  bedType: z.string().trim().min(2).max(40),
  viewType: z.string().trim().min(2).max(60),
  imageUrl: z.string().trim().min(1, 'Add a photo').max(400)
    .refine((u) => /^https:\/\//.test(u) || /^\/api\/media\/[a-f0-9]{24}\.(jpg|png|webp)$/.test(u), 'Photo must be an https:// URL or an uploaded image'),
  amenityIds: z.array(z.coerce.number().int().positive()).max(30).default([]),
});
