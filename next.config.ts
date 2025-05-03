
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  images: {
    // Ensure remotePatterns includes domains for any external images
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      // Add other domains if you use images from elsewhere
    ],
    // Image optimization is enabled by default, no specific config needed here
    // unless disabling or customizing further.
  },
};

export default nextConfig;
