import { codeInspectorPlugin } from 'code-inspector-plugin';

/** @type {import('next').NextConfig} */
const nextConfig = {
  turbopack: {
    root: new URL('../', import.meta.url).pathname,
    rules: codeInspectorPlugin({ bundler: 'turbopack' }),
  },
  webpack: (config) => {
    config.plugins.push(codeInspectorPlugin({ bundler: 'webpack' }));
    return config;
  },
  async rewrites() {
    const indexerBase = process.env.NEXT_PUBLIC_INDEXER_BASE_URL || 'http://localhost:3001';
    return [
      {
        source: '/indexer/:path*',
        destination: `${indexerBase}/:path*`,
      },
    ];
  },
};

export default nextConfig;
