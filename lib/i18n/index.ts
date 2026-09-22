import type { Lang } from "./lang";
import { de } from "./messages.de";
import type { Messages } from "./messages.de";
import { en } from "./messages.en";

export type { Messages } from "./messages.de";
export * from "./lang";

const MESSAGES: Record<Lang, Messages> = { de, en };

/** The words of one language; the German file is the shape both are held to. */
export const messagesOf = (lang: Lang): Messages => MESSAGES[lang];
