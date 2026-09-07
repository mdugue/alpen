import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Cache Components: everything is dynamic by default, caching is explicit
  // via "use cache". Also enables Partial Prerendering.
  cacheComponents: true,

  // The pass, tour and town data is static and imported at build time;
  // the only dynamic source is the weather forecast
  // (see app/api/weather/[slug]/route.ts).
  // React Compiler: memoises the client components automatically
  reactCompiler: true,

  experimental: {
    turbopackRustReactCompiler: true,
  },
}

export default nextConfig
