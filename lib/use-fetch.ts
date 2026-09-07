"use client";
import { useEffect, useState } from "react";

interface State<T> {
  url: string | null;
  data: T | null;
  error: Error | null;
}

/**
 * Minimaler Datenholer. `loading` wird abgeleitet, statt im Effekt gesetzt zu
 * werden – bei wachsendem Bedarf durch SWR oder TanStack Query ersetzen.
 */
export default function useFetch<T>(url: string | null) {
  const [state, setState] = useState<State<T>>({ url: null, data: null, error: null });

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(url)
      .then((r) => (r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(String(r.status)))))
      .then((data) => !cancelled && setState({ url, data, error: null }))
      .catch((error: Error) => !cancelled && setState({ url, data: null, error }));
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
