import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import {
  DEFAULT_LANG,
  LANG_COOKIE,
  langPrefix,
  preferredLang,
} from "@/lib/i18n/lang";

/**
 * Whether a request came from a page of this site: a choice already made.
 * Compared by host, the one thing the referer and the request agree on
 * behind any proxy – `nextUrl` may name the server by another one.
 */
const fromHere = (request: NextRequest): boolean => {
  const referer = request.headers.get("referer");
  return (
    referer !== null &&
    URL.canParse(referer) &&
    new URL(referer).host === request.headers.get("host")
  );
};

/**
 * The one request the app negotiates (plan 08, the Next.js i18n guide's
 * proxy, narrowed to the root). German is canonical at `/` and English lives
 * under `/en`, both prerendered; a visitor who arrives at the bare root with
 * a browser that asks for English is sent to `/en`, and one who has picked a
 * language in the map's menu (`LANG_COOKIE`) gets that one. The fragment –
 * half-month, camera, selection – survives the redirect by itself.
 *
 * Nothing else is redirected: a shared link to `/pass/x` is the page it
 * names, in the language it names, and a navigation from inside the site –
 * the router's own fetches (excluded by the matcher) or a link on one of its
 * pages – is not an arrival.
 */
export const proxy = (request: NextRequest) => {
  if (fromHere(request)) return NextResponse.next();
  const lang = preferredLang(
    request.cookies.get(LANG_COOKIE)?.value,
    request.headers.get("accept-language"),
  );
  if (lang === DEFAULT_LANG) return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = langPrefix(lang);
  return NextResponse.redirect(url);
};

export const config = {
  // The root only, and only as a document: the router's RSC requests and
  // prefetches for `/` carry these headers and must never be sent elsewhere.
  matcher: [
    {
      missing: [
        { key: "rsc", type: "header" },
        { key: "next-router-prefetch", type: "header" },
      ],
      source: "/",
    },
  ],
};
