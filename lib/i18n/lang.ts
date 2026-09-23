/**
 * The two languages the app is served in (plan 08). German stays
 * prefix-free and canonical – `/pass/x` – and English lives under `/en`:
 * `/en/pass/x`. Both are prerendered from the same routes under
 * `app/[lang]`; `next.config.ts` rewrites the prefix-free paths to `/de`.
 * The one request that is negotiated is the bare root (`proxy.ts`, with
 * `preferredLang` below). Vocabulary only: what the words are in each
 * language is `lib/i18n/messages.*.ts`.
 */
export const LANGS = ["de", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "de";

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

/** The language a route segment names, German for anything that is not one. */
export const langOf = (raw: unknown): Lang =>
  isLang(raw) ? raw : DEFAULT_LANG;

/**
 * Each language as it calls itself – the language menu's two entries. The
 * same in every language, which is why it is here and not in a dictionary.
 */
export const LANG_NAME: Record<Lang, string> = { de: "Deutsch", en: "English" };

/** Where a picked language is remembered: the name Next.js has always read for it. */
export const LANG_COOKIE = "NEXT_LOCALE";

const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

/** What the language menu writes when a language is picked: the pick, for the whole site, for a year. */
export const langCookie = (lang: Lang, now: number) => ({
  expires: now + YEAR_MS,
  name: LANG_COOKIE,
  path: "/",
  sameSite: "lax" as const,
  value: lang,
});

/**
 * The language a visitor arriving at the root is served (`proxy.ts`): the one
 * they picked, else the first of the browser's languages the app speaks, else
 * German. `Accept-Language` is read by its quality values; a region is
 * ignored ("en-US" is English), and `*` and `q=0` say nothing.
 */
export const preferredLang = (
  cookie: string | undefined,
  acceptLanguage: string | null,
): Lang => {
  if (isLang(cookie)) return cookie;
  const ranked = (acceptLanguage ?? "")
    .split(",")
    .map((range, i) => {
      const [tag = "", ...params] = range.split(";").map((s) => s.trim());
      const q = params.find((p) => p.startsWith("q="));
      return {
        i,
        lang: tag.toLowerCase().split("-")[0],
        q: q === undefined ? 1 : Number(q.slice(2)),
      };
    })
    .filter((r) => r.q > 0)
    .toSorted((a, b) => b.q - a.q || a.i - b.i);
  return ranked.map((r) => r.lang).find(isLang) ?? DEFAULT_LANG;
};

/** `generateStaticParams` of every route under `app/[lang]`. */
export const langParams = (): { lang: Lang }[] =>
  LANGS.map((lang) => ({ lang }));

/** What a path starts with in this language: nothing for German, `/en` otherwise. */
export const langPrefix = (lang: Lang): string =>
  lang === DEFAULT_LANG ? "" : `/${lang}`;

/** The language a displayed path is in, and the path without its prefix. */
export const langOfPath = (pathname: string): { lang: Lang; rest: string } => {
  for (const lang of LANGS) {
    if (lang === DEFAULT_LANG) continue;
    const prefix = `/${lang}`;
    if (pathname === prefix) return { lang, rest: "/" };
    if (pathname.startsWith(`${prefix}/`))
      return { lang, rest: pathname.slice(prefix.length) };
  }
  return { lang: DEFAULT_LANG, rest: pathname };
};

/** The BCP 47 locale numbers and dates are formatted in. */
export const localeOf = (lang: Lang): string =>
  lang === "en" ? "en-GB" : "de-DE";

/** The Open Graph locale of each language (`og:locale`). */
export const OG_LOCALE: Record<Lang, string> = { de: "de_DE", en: "en_GB" };
