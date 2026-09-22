import type { panel as de } from "../de/panel";

export const panel = {
  kicker: {
    destination: (country: string) => `Destination · ${country}`,
    tour: "Loop",
    town: (country: string) => `Cycling town · ${country}`,
  },
} satisfies typeof de;
