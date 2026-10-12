import type { Lang } from "./i18n/lang";
import type { PassPortrait, Portraits, PortraitTranslations } from "./types";

// Relative imports on purpose, like `lib/detail-assets.ts`, which reads this
// module from a Bun script outside the bundler.

/**
 * The portraits in one language: the German records with the English prose
 * laid over them field by field, the way `lib/data.ts` merges the pass notes.
 * A field the translation does not carry stays German; the judgement and the
 * hazards are not words and are never translated.
 *
 * One function for both sides of the detail file's hash: the build script
 * writes the file and `lib/data.ts` derives its name, and both have to lay the
 * translation over the same way.
 */
export const localizePortraits = (
  portraits: Portraits,
  translations: Partial<Record<Lang, PortraitTranslations>>,
  lang: Lang,
): Portraits => {
  const own = translations[lang];
  if (!own) return portraits;
  return Object.fromEntries(
    Object.entries(portraits).map(([slug, p]): [string, PassPortrait] => {
      const t = own[slug];
      if (!t) return [slug, p];
      return [
        slug,
        {
          intro: t.intro ?? p.intro,
          sides: p.sides.map((side, i) => ({ ...side, ...t.sides?.[i] })),
        },
      ];
    }),
  );
};

/**
 * The ascents a crossing should go up and come down, by index, as the
 * portrait judges them – or null where it judges nothing, or only one way:
 * "go up here" says nothing about a crossing until another side says "come
 * down there".
 */
export const crossingOf = (
  portrait: PassPortrait | undefined,
): { up: number[]; down: number[] } | null => {
  if (!portrait) return null;
  const up: number[] = [];
  const down: number[] = [];
  for (const [i, side] of portrait.sides.entries()) {
    if (side.bestAs === "up") up.push(i);
    if (side.bestAs === "down") down.push(i);
  }
  return up.length && down.length ? { down, up } : null;
};
