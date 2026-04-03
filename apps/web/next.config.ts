import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@tayyar/db", "@tayyar/ui", "@tayyar/types", "@tayyar/utils"],
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/merchant",
        permanent: false,
      },
      {
        source: "/orders/new",
        destination: "/merchant/orders/new",
        permanent: false,
      },
      {
        source: "/wallet",
        destination: "/merchant/invoices",
        permanent: false,
      },
      {
        source: "/admin/dashboard",
        destination: "/admin",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
