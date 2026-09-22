import type { NextConfig } from "next";

import { DETAIL_FILES } from "./lib/detail-assets";
import { MAP_FILES } from "./lib/map-assets";

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
  // max-age=0 and revalidates on every visit. The rules come from the modules
  // that write and prune those names (`lib/derived-file.ts`), so the promise
  // cannot outgrow what it is made about: anything else under those
  // directories keeps the default and stays updatable.
  headers: () =>
    Promise.resolve(
      [MAP_FILES.cachePattern, DETAIL_FILES.cachePattern].map((source) => ({
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
