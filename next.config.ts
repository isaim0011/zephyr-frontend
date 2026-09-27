import type { NextConfig } from "next";

const anchorUrl = (process.env.NEXT_PUBLIC_ANCHOR_URL ?? "http://localhost:8080").replace(/\/+$/, "");

const nextConfig: NextConfig = {
  // Small self-contained server for the Docker image.
  output: "standalone",
  reactStrictMode: true,
  poweredByHeader: false,
  // The interactive pages call /api/interactive on their own origin. In production
  // they're served through the anchor's proxy, so that's the backend. When the
  // frontend runs on its own (e.g. `npm run dev`), forward those calls to the anchor.
  async rewrites() {
    return [{ source: "/api/interactive/:path*", destination: `${anchorUrl}/api/interactive/:path*` }];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "no-referrer" },
        ],
      },
    ];
  },
};

export default nextConfig;
