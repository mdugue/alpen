"use client";

import { createContext, use } from "react";

import type { Lang, Messages } from "@/lib/i18n";
import { fmt, fmtUnit } from "@/lib/utils";

/**
 * The page's words, for every client component that says one (plan 08).
 * The layout loads the one dictionary of the page's language on the server
 * (`getDictionary`) and hands it in here as a value, so no other language
 * reaches the browser. Nothing under `lib/` reads this context: a function of
 * the core that says something takes the words as its last argument, which
 * is also how the server builds the same sentence for a route's metadata.
 */
const WordsContext = createContext<Messages | null>(null);

export const I18nProvider = ({
  messages,
  children,
}: {
  messages: Messages;
  children: React.ReactNode;
}) => <WordsContext value={messages}>{children}</WordsContext>;

/** The words and the number formats of the page's language, in one value. */
export const useT = (): {
  lang: Lang;
  t: Messages;
  fmt: (n: number, digits?: number) => string;
  fmtUnit: (n: number, unit: string, digits?: number) => string;
} => {
  const t = use(WordsContext);
  if (!t) throw new Error("useT() outside I18nProvider");
  return {
    fmt: (n, digits = 0) => fmt(n, digits, t.lang),
    fmtUnit: (n, unit, digits = 0) => fmtUnit(n, unit, digits, t.lang),
    lang: t.lang,
    t,
  };
};
