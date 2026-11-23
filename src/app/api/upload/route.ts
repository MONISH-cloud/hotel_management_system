import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { route, ApiError } from '@/lib/api';
import { requirePerm } from '@/lib/auth';

export const dynamic = 'force-dynamic';
const MAX = 4 * 1024 * 1024;

/** Detects the real image type from the file's magic bytes (the browser-supplied type is not trusted). */
function sniff(b: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (b.length > 12 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (b.length > 12 && b.subarray(0, 4).toString() === 'RIFF' && b.subarray(8, 12).toString() === 'WEBP') return 'webp';
  return null;
}

export const POST = route(async (req) => {
  await requirePerm('inventory.manage');
  const form = await req.formData().catch(() => null);
  const file = form?.get('file');
  if (!(file instanceof File)) throw new ApiError(400, 'Attach an image file.');
  if (file.size > MAX) throw new ApiError(413, 'Image is too large (max 4 MB).');
  const buf = Buffer.from(await file.arrayBuffer());
  const ext = sniff(buf);
  if (!ext) throw new ApiError(415, 'Only JPEG, PNG or WebP images are allowed.');
  const name = `${crypto.randomBytes(12).toString('hex')}.${ext}`;
  await fs.mkdir(path.join(process.cwd(), 'uploads'), { recursive: true });
  await fs.writeFile(path.join(process.cwd(), 'uploads', name), buf);
  return { url: `/api/media/${name}` };
});
