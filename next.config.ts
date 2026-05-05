import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        'localhost:3000',
        'content-pilots-git-main-prabhavs-projects-2e3dc5a8.vercel.app',
        'content-pilots-zxbs027gr-prabhavs-projects-2e3dc5a8.vercel.app',
      ],
    },
  },
};

export default nextConfig;
