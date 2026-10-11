import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Resultados en PDF de hasta 5 MB
    serverActions: { bodySizeLimit: "6mb" },
  },
};

export default nextConfig;
