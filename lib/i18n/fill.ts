/**
 * Messages are plain strings with named placeholders – "Im Umkreis von {km}
 * km" – so a dictionary is data: the server loads the page's language and
 * hands it to the client as a prop, and no language travels to a browser
 * that did not ask for it (plan 08, the Next.js internationalisation guide).
 * A placeholder is a name in braces, and a sentence may put its placeholders
 * in any order, which is what a translation needs.
 *
 * The placeholders are part of the type: `Shape` turns every string of the
 * German dictionary into a `Msg` that remembers its names, and `fill` asks for
 * exactly those names – so a caller that forgets one, or passes one the
 * sentence does not have, fails `typecheck` the way a wrong function argument
 * did when messages were functions.
 */

declare const PLACEHOLDERS: unique symbol;

/** A message and the names of its placeholders; a plain string at runtime. */
export type Msg<P extends string = never> = string & {
  readonly [PLACEHOLDERS]?: P;
};

/** The placeholder names of a message literal: `Params<"{a} und {b}">` is `"a" | "b"`. */
export type Params<S extends string> =
  S extends `${string}{${infer P}}${infer Rest}` ? P | Params<Rest> : never;

/**
 * The dictionary as the app reads it: every string a `Msg` carrying its own
 * placeholders, every list and record kept as it is. Built from the German
 * dictionary, which is the source; the English one is held to the same
 * layout by `Layout` and to the same placeholders by a test.
 */
export type Shape<T> = T extends string
  ? Msg<Params<T>>
  : T extends null
    ? null
    : { readonly [K in keyof T]: Shape<T[K]> };

/**
 * What a translation has to match: the same keys, the same list lengths, a
 * string wherever the source has one. The placeholders cannot be compared by
 * a type without fixing their order, so `lib/i18n/messages.test.ts` holds
 * them against each other key by key.
 */
export type Layout<T> = T extends string
  ? string
  : T extends null
    ? null
    : { readonly [K in keyof T]: Layout<T[K]> };

const PLACEHOLDER = /\{(?<name>\w+)\}/gu;

/** The message with its placeholders filled in: `fill(t.near, { km: "60" })`. */
export const fill = <P extends string>(
  message: Msg<P>,
  values: Readonly<Record<P, string | number>>,
): string =>
  message.replaceAll(PLACEHOLDER, (all, name: string) =>
    name in values ? String(values[name as P]) : all,
  );

/** The placeholder names a message uses, in order of appearance – for the parity test. */
export const placeholdersOf = (message: string): string[] =>
  [...message.matchAll(PLACEHOLDER)].map((m) => m.groups!.name!);
