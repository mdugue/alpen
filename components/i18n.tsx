"use client";

import { createContext, useContext } from "react";

import { DEFAULT_LANG, localeOf, messagesOf } from "@/lib/i18n";
import type { Lang, Messages } from "@/lib/i18n";

/**
 * The language of the page, for every client component that says a word
 * (plan 08). Provided once by the `[lang]` layout and read with `useT()`;
 * nothing under `lib/` reads it – a function of the core that says something
 * takes the language as an argument, so the same sentence can be built on the
 * server for a route's metadata.
 */
const LangContext = createContext<Lang>(DEFAULT_LANG);

export const I18nProvider = ({
  lang,
  children,
}: {
  lang: Lang;
  children: React.ReactNode;
}) => <LangContext.Provider value={lang}>{children}</LangContext.Provider>;

export const useLang = (): Lang => useContext(LangContext);

/** The words and the number formats of the page's language, in one value. */
export const useT = (): {
  lang: Lang;
  t: Messages;
  fmt: (n: number, digits?: number) => string;
  fmtUnit: (n: number, unit: string, digits?: number) => string;
} => {
  const lang = useContext(LangContext);
  const locale = localeOf(lang);
  const fmt = (n: number, digits = 0) =>
    n.toLocaleString(locale, {
      maximumFractionDigits: digits,
      minimumFractionDigits: 0,
    });
  return {
    fmt,
    fmtUnit: (n, unit, digits = 0) => `${fmt(n, digits)} ${unit}`,
    lang,
    t: messagesOf(lang),
  };
};
