import { notFound } from "next/navigation";
import { lang } from "next/root-params";

import { messagesOf } from "./dictionaries";
import { isLang } from "./lang";
import type { Messages } from "./messages.de";

/**
 * The page's words, read from the root parameter the way the Next.js guide
 * does it: a server component asks for its dictionary and passes it on, and
 * the language is never threaded through props on the way. A segment that is
 * not a language is a 404 – the root layout has already said so, and this
 * says it again for any caller that runs first.
 */
export const getDictionary = async (): Promise<Messages> => {
  const raw = await lang();
  if (!isLang(raw)) notFound();
  return messagesOf(raw);
};
