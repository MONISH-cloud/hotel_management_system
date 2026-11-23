import type { NextConfig } from 'next';
import path from 'node:path';

const config: NextConfig = {
  serverExternalPackages: ['mysql2', 'neo4j-driver', 'ioredis', 'bcryptjs'],
  images: { remotePatterns: [{ protocol: 'https', hostname: 'images.unsplash.com' }] },
  poweredByHeader: false,
  turbopack: { root: path.resolve(__dirname) },
};

export default config;
