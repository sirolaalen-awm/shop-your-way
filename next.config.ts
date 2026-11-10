import type { NextConfig } from 'next';
const config: NextConfig = { poweredByHeader: false, distDir: process.env.SYW_DIST_DIR || '.next', serverExternalPackages: [], experimental: {} };
export default config;
