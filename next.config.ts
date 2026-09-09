import type { NextConfig } from "next";

import { MAP_ASSET_DIR } from "./lib/map-assets";

const nextConfig: NextConfig = {
  // Cache Components: everything is dynamic by default, caching is explicit
  // via "use cache". Also enables Partial Prerendering.
  cacheComponents: true,

  experimental: {
    turbopackRustReactCompiler: true,
  },

  // The route geometry MapLibre loads (scripts/build-map-assets.ts) carries a
  // content hash in its name, so it may be cached for good. Without this rule
  // Vercel serves public/ with max-age=0 and revalidates on every visit. Only
  // the hashed names match (same shape as ASSET_NAME in lib/map-assets.ts):
  // anything else under public/map keeps the default and stays updatable.
  headers: () =>
    Promise.resolve([
      {
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source: `/${MAP_ASSET_DIR}/:kind(routes|tours).:hash([0-9a-f]{8}).geojson`,
      },
    ]),

  // The pass, tour and town data is static and imported at build time;
  // the only dynamic source is the weather forecast
  // (see app/api/weather/[slug]/route.ts).
  // React Compiler: memoises the client components automatically
  reactCompiler: true,
};

export default nextConfig;
