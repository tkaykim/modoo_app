import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*',
      }
    ],
  },
  allowedDevOrigins: ['*.loca.lt', '*.trycloudflare.com', 'khaki-pots-grow.loca.lt', 'purple-towns-dance.loca.lt'],
};

export default nextConfig;
