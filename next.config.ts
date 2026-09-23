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

  // The pass, tour, town and destination data is static and imported at
  // build time; the only dynamic source is the weather forecast, streamed
  // into the pass route (see components/panel/weather.tsx, lib/weather.ts).
  // React Compiler: memoises the client components automatically
  reactCompiler: true,

  // German has one address, the prefix-free one. `/de/…` is where the rewrite
  // below serves it from, and Next builds the URLs of the share images from
  // that route, so a link preview asks for `/de/opengraph-image`; the
  // redirect sends it – and anyone who types the prefix – to the canonical
  // path instead of into the rewrite, which would make it `/de/de/…`.
  redirects: () =>
    Promise.resolve([
      { destination: "/", permanent: true, source: "/de" },
      { destination: "/:path*", permanent: true, source: "/de/:path*" },
    ]),

  // German is prefix-free and canonical, English lives under `/en`, and both
  // are prerendered from `app/[lang]` (plan 08): the prefix-free paths are
  // rewritten onto `/de` here, and only the bare root is negotiated
  // (`proxy.ts`). The negative lookahead keeps `/en` and the metadata routes at the root (the
  // icons, the manifest, robots and the sitemap) out of the rewrite; the share
  // images sit under `[lang]` so each language gets its own. `_next` and
  // `public/` are served before rewrites run.
  rewrites: () =>
    Promise.resolve([
      { destination: "/de", source: "/" },
      {
        destination: "/de/:path*",
        source:
          "/:path((?!en(?:/|$)|icon|apple-icon|manifest\\.webmanifest|robots\\.txt|sitemap\\.xml).*)",
      },
    ]),
};

export default nextConfig;
