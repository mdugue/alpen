import type { Metadata, Viewport } from "next";
import { Inter, Oxanium } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const oxanium = Oxanium({ subsets: ["latin"], variable: "--font-oxanium", display: "swap" });

// Absolute URLs for the share images; Vercel provides the production host.
const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Alpenpässe – Rennradkarte",
  description:
    "Pässe, Auffahrten mit Höhenprofil, Rundtouren und Rad-Orte in den Alpen – mit Befahrbarkeit je Halbmonat, Wetter und Klima.",
  openGraph: {
    title: "Alpenpässe – Rennradkarte",
    description: "Grobe Orientierung für Rennradrouten in den Alpen.",
    locale: "de_DE",
    type: "website",
  },
};

// Keep in sync with --background in app/globals.css (light / dark).
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfaf7" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1c22" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" className={`${inter.variable} ${oxanium.variable}`}>
      <body className="h-dvh overflow-hidden antialiased">{children}</body>
    </html>
  );
}
