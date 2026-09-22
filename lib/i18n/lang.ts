/**
 * The two languages the app is served in (plan 08). German stays
 * prefix-free and canonical – `/pass/x` – and English lives under `/en`:
 * `/en/pass/x`. Both are prerendered from the same routes under
 * `app/[lang]`; `next.config.ts` rewrites the prefix-free paths to `/de`, so
 * no proxy and no redirect ever runs. Vocabulary only: what the words are
 * in each language is `lib/i18n/messages.*.ts`.
 */
export const LANGS = ["de", "en"] as const;
export type Lang = (typeof LANGS)[number];
export const DEFAULT_LANG: Lang = "de";

export const isLang = (v: unknown): v is Lang => LANGS.includes(v as Lang);

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

/** The `<html lang>` and the Open Graph locale. */
export const OG_LOCALE: Record<Lang, string> = { de: "de_DE", en: "en_GB" };
