import fs from 'node:fs/promises';
import path from 'node:path';
import { NextResponse } from 'next/server';

const TYPES: Record<string, string> = { jpg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Serves uploaded photos from /uploads (works in dev and production, no rebuild needed). */
export async function GET(_req: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  const m = /^[a-f0-9]{24}\.(jpg|png|webp)$/.exec(name);
  if (!m) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  try {
    const data = await fs.readFile(path.join(process.cwd(), 'uploads', name));
    return new Response(data, { headers: { 'Content-Type': TYPES[m[1]], 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff' } });
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}
