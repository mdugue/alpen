"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Share the view that is on screen.
 *
 * The whole state of this app already lives in the URL hash (`writeHash` in
 * `lib/app-state.ts`) – the selection, the filters and the camera – so a link
 * to "Bormio, Anfang Oktober" has existed all along and there was simply no
 * way to get at it without opening the address bar. That is the entire change
 * here: the address bar, as a button.
 *
 * `navigator.share` where the platform has it (every phone, which is where a
 * link is actually passed on), the clipboard everywhere else, and the button's
 * own label as the confirmation – a toast would need a toaster in the tree for
 * one message. A share the visitor cancels is not a failure and says nothing.
 */
export const useShare = () => {
  const [done, setDone] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const share = async (title: string) => {
    const url = window.location.href;
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setDone(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setDone(false), 2000);
    } catch {
      // A cancelled share sheet and a denied clipboard both land here and
      // neither is worth a message: nothing was lost and the URL is still in
      // the address bar.
    }
  };

  return { done, share };
};
