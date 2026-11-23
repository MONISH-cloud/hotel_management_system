import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  serverExternalPackages: ['mysql2', 'neo4j-driver', 'ioredis', 'bcryptjs'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  poweredByHeader: false,
  // Defensive browser headers. The CSP deliberately limits only framing, <base>, forms and plugins,
  // so scripts, styles and images (Unsplash, uploads, fonts) behave exactly as before.
  async headers() {
    return [{
      source: '/:path*',
      headers: [
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        { key: 'Content-Security-Policy', value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
        ...(process.env.NODE_ENV === 'production' ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }] : []),
      ],
    }];
  },
  turbopack: { root: path.resolve(__dirname) },
};

export default config;
