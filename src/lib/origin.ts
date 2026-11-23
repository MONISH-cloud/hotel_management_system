/**
 * Cross-site request guard for state-changing API calls.
 *
 * Browsers attach an `Origin` header to every cross-site POST/PUT/PATCH/DELETE. If it names a different
 * host than the one being called, the request was triggered by another website and is refused.
 * Requests without an Origin header (curl, scripts, server-to-server) are allowed, as are all reads.
 * Pure function with no imports so it can be unit-tested directly.
 */
export function isSameOrigin(origin: string | null, host: string | null, forwardedHost?: string | null, allowedHost?: string | null): boolean {
  if (!origin) return true;
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    return false; // "null" or garbage
  }
  const candidates = [host, forwardedHost?.split(',')[0]?.trim(), allowedHost].filter(Boolean) as string[];
  return candidates.some((h) => h.toLowerCase() === originHost.toLowerCase());
}

export const MUTATING = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
