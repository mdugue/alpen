import type { MetadataRoute } from "next";

import { siteUrl } from "@/lib/brand";

/**
 * Search engines are welcome – finding a region for a holiday is the point of
 * the app. Crawlers that exist to harvest content for model training or for
 * answer engines are not: the ratings here are editorial judgements that only
 * make sense next to the map, the scales dialog and their disclaimer.
 *
 * robots.txt is a request, not a fence; it stops the operators that honour it.
 * /impressum and /datenschutz stay crawlable on purpose – they carry
 * `robots: { index: false }` in their metadata, and a crawler has to fetch a
 * page to see that.
 */

/** Training and answer-engine crawlers, alphabetical. */
const AI_CRAWLERS = [
  "AI2Bot",
  "Amazonbot",
  "anthropic-ai",
  "Applebot-Extended",
  "Bytespider",
  "CCBot",
  "ChatGPT-User",
  "Claude-SearchBot",
  "Claude-User",
  "ClaudeBot",
  "cohere-ai",
  "Diffbot",
  "DuckAssistBot",
  "FacebookBot",
  "Google-Extended",
  "GPTBot",
  "ImagesiftBot",
  "Meta-ExternalAgent",
  "Meta-ExternalFetcher",
  "OAI-SearchBot",
  "omgili",
  "PanguBot",
  "Perplexity-User",
  "PerplexityBot",
  "Timpibot",
  "Webzio-Extended",
  "YouBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { allow: "/", disallow: ["/api/"], userAgent: "*" },
      { disallow: "/", userAgent: AI_CRAWLERS },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
