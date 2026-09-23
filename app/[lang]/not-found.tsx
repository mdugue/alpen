import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { getDictionary } from "@/lib/i18n/server";
import { homeHref } from "@/lib/routes";

/**
 * What a path under a language says when it names nothing – an entity route
 * whose slug is not in the data (`notFound()` in its page), in the page's
 * language, with the way back to the map. Next marks it `noindex` itself.
 */
const NotFound = async () => {
  const { backToMap, lang, notFound } = await getDictionary();
  return (
    <main className="bg-background text-foreground flex h-dvh items-center justify-center px-4">
      <div className="flex max-w-md flex-col gap-4">
        <h1 className="font-heading text-2xl font-bold tracking-wide">
          {notFound.title}
        </h1>
        <p className="text-muted-foreground text-sm">{notFound.text}</p>
        <Link
          href={homeHref(lang)}
          className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 text-sm"
        >
          <ArrowLeft className="size-4" />
          {backToMap}
        </Link>
      </div>
    </main>
  );
};

export default NotFound;
