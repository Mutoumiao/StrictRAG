import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, '../..');

const nextConfig: NextConfig = {
  transpilePackages: ['@strict-rag/ui', '@strict-rag/contracts', '@strict-rag/admin-catalog'],
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
