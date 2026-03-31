import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/unison-society-financial-statements",
        destination: "/unison-society-financial-statements.pdf",
        permanent: true,
      },
      {
        source: "/unison-society-financial-statements/",
        destination: "/unison-society-financial-statements.pdf",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
