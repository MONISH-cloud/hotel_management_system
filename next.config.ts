import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  // Lets the API test suite build into its own folder (default is unchanged: .next)
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  serverExternalPackages: ['mysql2', 'neo4j-driver', 'ioredis', 'bcryptjs'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  poweredByHeader: false,
  turbopack: { root: path.resolve(__dirname) },
};

export default config;
