import { z } from 'zod';

export const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use the format YYYY-MM-DD');

export const passwordRule = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password needs at least one letter')
  .regex(/\d/, 'Password needs at least one number');

export const reviewBody = z.object({
  rating: z.coerce.number().int().min(1, 'Choose a rating').max(5),
  title: z.string().trim().min(3, 'Add a short title').max(90),
  body: z.string().trim().min(10, 'Tell us a little more (10+ characters)').max(1200),
});

export const paymentMethod = z.enum(['card', 'upi', 'cash', 'netbanking']);
