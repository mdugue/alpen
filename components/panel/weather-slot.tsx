"use client";

import { createContext, useContext } from "react";

import { WeatherSkeleton } from "@/components/panel/weather-forecast";
import type { Selection } from "@/lib/app-state";

/**
 * What is selected, for the one thing rendered *inside* the explorer that the
 * explorer did not render itself: the entity page's slot. The page is a
 * child of the layout, so it arrives as `children` and is shown in the
 * panel; what it may not do is show pass A's weather while the visitor has
 * already tapped pass B and B's page is still on its way. The slot compares
 * its own slug with the selection and shows the skeleton until they agree.
 */
export const SelectionContext = createContext<Selection | null>(null);

export const WeatherSlot = ({
  slug,
  children,
}: {
  slug: string;
  children: React.ReactNode;
}) => {
  const selection = useContext(SelectionContext);
  const current = selection?.kind === "pass" && selection.slug === slug;
  return current ? children : <WeatherSkeleton />;
};
