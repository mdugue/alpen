"use client";
import { startTransition, useEffect, useState } from "react";

interface State<T> {
  url: string | null;
  data: T | null;
  error: Error | null;
}

/**
 * Minimal data fetcher. `loading` is derived instead of being set in an
 * effect – replace with SWR or TanStack Query as needs grow.
 *
 * The result arrives in a transition, which costs nothing here and is what
 * lets the caller animate the handover from its placeholder to the answer: a
 * view transition only runs for an update that is a transition, a deferred
 * value or a Suspense reveal, and a plain `setState` from a `fetch` is none
 * of the three (`lib/view-transitions.ts`).
 */
export default function useFetch<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({
    data: null,
    error: null,
    url: null,
  });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    const load = async () => {
      let next: State<T>;
      try {
        const r = await fetch(url);
        next = r.ok
          ? { data: (await r.json()) as T, error: null, url }
          : { data: null, error: new Error(String(r.status)), url };
      } catch (error) {
        next = {
          data: null,
          error: error instanceof Error ? error : new Error(String(error)),
          url,
        };
      }
      if (!cancelled) startTransition(() => setState(next));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  const settled = state.url === url;
  return {
    data: settled ? state.data : null,
    error: settled ? state.error : null,
    loading: Boolean(url) && !settled,
  };
}
