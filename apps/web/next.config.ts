import path from 'node:path';
import { fileURLToPath } from 'node:url';

import type { NextConfig } from 'next';

const appDir = path.dirname(fileURLToPath(import.meta.url));
const monorepoRoot = path.resolve(appDir, '../..');

const nextConfig: NextConfig = {
  transpilePackages: ['@strict-rag/ui', '@strict-rag/contracts'],
  outputFileTracingRoot: monorepoRoot,
  // NodeNext 包内 `from './x.js'` 实际源是 .ts；bundler 需 extensionAlias
  webpack: (config) => {
    config.resolve.extensionAlias = {
      '.js': ['.ts', '.tsx', '.js'],
      '.jsx': ['.tsx', '.jsx'],
    };
    return config;
  },
};

export default nextConfig;
