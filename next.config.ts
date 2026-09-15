import type { NextConfig } from "next";

import { DETAIL_ASSET_DIR } from "./lib/detail-assets";
import { MAP_ASSET_DIR } from "./lib/map-assets";

const nextConfig: NextConfig = {
  // Cache Components: everything is dynamic by default, caching is explicit
  // via "use cache". Also enables Partial Prerendering.
  cacheComponents: true,

  experimental: {
    turbopackRustReactCompiler: true,
  },

  // What the browser fetches instead of getting it as props – the route
  // geometry (scripts/build-map-assets.ts) and the per-entity detail files
  // (scripts/build-detail-assets.ts) – carries a content hash in its name, so
  // it may be cached for good. Without these rules Vercel serves public/ with
  // max-age=0 and revalidates on every visit. Only the hashed names match
  // (same shape as the ASSET_NAME patterns in the two lib modules): anything
  // else under those directories keeps the default and stays updatable.
  headers: () =>
    Promise.resolve(
      [
        `/${MAP_ASSET_DIR}/:kind(routes|tours).:hash([0-9a-f]{8}).geojson`,
        `/${DETAIL_ASSET_DIR}/:entity.:hash([0-9a-f]{8}).json`,
      ].map((source) => ({
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
        source,
      })),
    ),

  // The pass, tour and town data is static and imported at build time;
  // the only dynamic source is the weather forecast
  // (see app/api/weather/[slug]/route.ts).
  // React Compiler: memoises the client components automatically
  reactCompiler: true,
};

export default nextConfig;
