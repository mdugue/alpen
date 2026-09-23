"use client";

import { Check } from "lucide-react";

import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import { FieldLegend, FieldSet } from "@/components/ui/field";
import { LANG_NAME, LANGS, langCookie } from "@/lib/i18n";
import type { Lang } from "@/lib/i18n";

/**
 * Remembers the pick for the next arrival at the root. The navigation it
 * starts does not wait for it – the proxy never redirects a request from a
 * page of this site – and a browser without the Cookie Store API still
 * follows the link; it only will not remember.
 */
const remember = async (lang: Lang) => {
  if (!("cookieStore" in globalThis)) return;
  try {
    await cookieStore.set(langCookie(lang, Date.now()));
  } catch {
    /* not remembered: the link works all the same */
  }
};

/**
 * The language, as the last group of the map's view menu (plan 08): one entry
 * per language, each named in its own, and the other one a plain link to the
 * same place in it – path, half-month, camera and selection
 * (`switchLangHref`). A full load on purpose: the page under the other prefix
 * is another prerender, and every word on it changes.
 *
 * Picking one is remembered in `LANG_COOKIE`, which is what the root reads
 * before it asks the browser's languages (`proxy.ts`) – so a visitor who
 * chose German is not sent back to `/en` the next time they type the address.
 */
export const LanguageField = ({ hrefOf }: { hrefOf: (to: Lang) => string }) => {
  const { t, lang } = useT();
  return (
    <FieldSet className="gap-2">
      <FieldLegend variant="label">{t.map.language}</FieldLegend>
      <div className="flex gap-1.5">
        {LANGS.map((l) =>
          l === lang ? (
            <Button
              key={l}
              size="sm"
              variant="secondary"
              className="flex-1"
              lang={l}
              aria-current="true"
              render={<span />}
              nativeButton={false}
            >
              <Check data-icon="inline-start" />
              {LANG_NAME[l]}
            </Button>
          ) : (
            <Button
              key={l}
              size="sm"
              variant="outline"
              className="flex-1"
              render={
                <a
                  href={hrefOf(l)}
                  hrefLang={l}
                  lang={l}
                  onClick={() => {
                    void remember(l);
                  }}
                />
              }
              nativeButton={false}
            >
              {LANG_NAME[l]}
            </Button>
          ),
        )}
      </div>
    </FieldSet>
  );
};
