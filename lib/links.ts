/**
 * Deep links to the two cycling sites the app hands off to. Both of them read
 * their target from a place that is easy to get wrong and neither answers with
 * an error when you do – a wrong quäldich parameter returns an empty result
 * page, a wrong komoot shape returns the discover view at the visitor's own
 * position. So the shapes live here, next to the tests that pin them.
 */
import type { Pass } from "@/lib/types";

/**
 * quäldich.de's own page for the pass, from the curated slug in
 * `data/passes.json`. Without one – their Pässelexikon does not carry every
 * road – their search, whose parameter is `suchwort`: `q` is ignored and the
 * page comes back empty.
 */
export const quaeldichHref = (pass: Pass) =>
  pass.quaeldich
    ? `https://www.quaeldich.de/paesse/${pass.quaeldich}/`
    : `https://www.quaeldich.de/suche/?suchwort=${encodeURIComponent(pass.name).replaceAll("%20", "+")}`;

/**
 * Komoot's discover view around a point. It reads the location from the path,
 * not from query parameters: `?lat=&lng=` lands on the generic page wherever
 * the visitor happens to be. The name segment is only a label, the `@lat,lon`
 * behind it is what places the map; `de-de` saves the redirect to the German
 * locale.
 */
export const komootHref = (name: string, lat: number, lon: number) =>
  `https://www.komoot.com/de-de/discover/${encodeURIComponent(name)}/@${lat},${lon}/tours?sport=racebike`;
