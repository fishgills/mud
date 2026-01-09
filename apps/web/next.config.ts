import type { NextConfig } from 'next';

const basePath =
  process.env.NEXT_PUBLIC_BASE_PATH ??
  (process.env.NODE_ENV === 'production' ? '/www' : '');
const resolvedBasePath = basePath && basePath !== '/' ? basePath : undefined;

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  basePath: resolvedBasePath,
  assetPrefix: resolvedBasePath,
  allowedDevOrigins: ['https://closet.battleforge.app'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'platform.slack-edge.com',
        pathname: '/img/**',
      },
    ],
  },
};

export default nextConfig;
