export { cn } from "cn";

/** Formats a number using German locale conventions (e.g. "2 764"). */
export const fmt = (n: number) => n.toLocaleString("de-DE");
