import { NextResponse, type NextRequest } from 'next/server';
import type { ZodType } from 'zod';

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<unknown>;

/** Wraps a route handler: JSON in/out, uniform error format, MySQL SIGNAL messages surfaced to the client. */
export function route<C = { params: Promise<Record<string, string>> }>(handler: Handler<C>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const out = await handler(req, ctx);
      return out instanceof Response ? out : NextResponse.json(out ?? { ok: true });
    } catch (e) {
      return errorResponse(e);
    }
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function errorResponse(e: any) {
  if (e instanceof ApiError) return NextResponse.json({ error: e.message }, { status: e.status });
  if (e?.name === 'ZodError') return NextResponse.json({ error: e.issues?.[0]?.message ?? 'Invalid input' }, { status: 422 });
  // MySQL: SIGNAL SQLSTATE '45000' raised by our triggers / stored procedures
  if (e?.errno === 1644 || e?.sqlState === '45000') {
    return NextResponse.json({ error: e.sqlMessage ?? e.message }, { status: 400 });
  }
  if (e?.code === 'ER_DUP_ENTRY') return NextResponse.json({ error: 'That record already exists.' }, { status: 409 });
  if (e?.code === 'ER_NO_REFERENCED_ROW_2' || e?.code === 'ER_ROW_IS_REFERENCED_2')
    return NextResponse.json({ error: 'This record is linked to other data and cannot be changed that way.' }, { status: 409 });
  if (e?.errno === 3819) return NextResponse.json({ error: 'The value violates a database constraint.' }, { status: 400 });
  console.error('[api]', e);
  return NextResponse.json({ error: 'Something went wrong on our side. Please try again.' }, { status: 500 });
}

export async function parseBody<T>(req: NextRequest, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, 'Request body must be valid JSON');
  }
  const res = schema.safeParse(json);
  if (!res.success) {
    const issue = res.error.issues[0];
    const field = issue.path.length ? `${issue.path.join('.')}: ` : '';
    throw new ApiError(422, `${field}${issue.message}`);
  }
  return res.data;
}

export const num = (v: string | null | undefined) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export const clientIp = (req: NextRequest) =>
  req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('x-real-ip') || 'local';
