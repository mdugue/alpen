import type { Metadata, Viewport } from "next";
import { Inter, Oxanium } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const oxanium = Oxanium({ subsets: ["latin"], variable: "--font-oxanium", display: "swap" });

export const metadata: Metadata = {
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

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f7f4ee" },
    { media: "(prefers-color-scheme: dark)", color: "#12181f" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning className={`${inter.variable} ${oxanium.variable}`}>
      <body className="min-h-dvh antialiased">
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
