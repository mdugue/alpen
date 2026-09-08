"use client";
import { useEffect, useState } from "react";

interface State<T> {
  url: string | null;
  data: T | null;
  error: Error | null;
}

/**
 * Minimal data fetcher. `loading` is derived instead of being set in an
 * effect – replace with SWR or TanStack Query as needs grow.
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
      if (!cancelled) setState(next);
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
