import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cache Components: alles ist per Default dynamisch, gecacht wird explizit
  // über "use cache". Aktiviert zugleich Partial Prerendering.
  cacheComponents: true,

  // Die Pass-, Touren- und Ortsdaten sind statisch und werden zur Build-Zeit
  // importiert; die einzige dynamische Quelle ist die Wettervorhersage
  // (siehe app/api/weather/[slug]/route.ts).
  // React Compiler: memoisiert die Client-Komponenten automatisch
  reactCompiler: true,
};

export default nextConfig;
