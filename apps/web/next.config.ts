import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, '../..');

const nextConfig: NextConfig = {
  transpilePackages: ['@strict-rag/ui', '@strict-rag/contracts'],
  // 避免父目录 package-lock 干扰 workspace 根推断
  outputFileTracingRoot: monorepoRoot,
};

export default nextConfig;
