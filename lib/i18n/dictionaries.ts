import type { Lang } from "./lang";
import { de } from "./messages.de";
import type { Messages } from "./messages.de";
import { en } from "./messages.en";

/**
 * Both dictionaries, for the code that may hold both: the server – each
 * route's metadata, the share images, the sitemap – and the scripts and the
 * tests. Nothing the browser runs imports this file (a lint rule holds it to
 * that): a page's words arrive from its layout, one language per page, as a
 * value (`I18nProvider`, `getDictionary` in `./server.ts`), which is the
 * point of keeping them plain strings.
 *
 * German is the source `Messages` is built from; English is held to its
 * layout by the type and to its placeholders by `messages.test.ts`.
 */
const DICTIONARIES: Record<Lang, Messages> = { de, en };

export const messagesOf = (lang: Lang): Messages => DICTIONARIES[lang];

/** The German words: what the scripts print and the tests read. */
export const DE: Messages = DICTIONARIES.de;
