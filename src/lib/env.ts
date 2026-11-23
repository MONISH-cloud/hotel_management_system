/**
 * Reads a required environment variable and fails loudly if it is missing, too short, or still the
 * placeholder from .env.example. There are deliberately NO hard-coded fallback secrets anywhere.
 * (No server-only import: proxy.ts uses this too.)
 */
export function requireEnv(name: string, minLength = 1): string {
  const v = process.env[name];
  if (!v || v.length < minLength || v.startsWith('change-me')) {
    throw new Error(
      `Environment variable ${name} is not set${v ? ' to a real value' : ''}${minLength > 1 ? ` (min ${minLength} characters)` : ''}. ` +
      'Copy .env.example to .env.local and fill it in (generate secrets with: openssl rand -hex 32).');
  }
  return v;
}
