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
 * its own entity with the selection and shows the skeleton until they agree.
 */
export const SelectionContext = createContext<Selection | null>(null);

export const WeatherSlot = ({
  selection: own,
  children,
}: {
  selection: Selection;
  children: React.ReactNode;
}) => {
  const selection = useContext(SelectionContext);
  const current = selection?.kind === own.kind && selection.slug === own.slug;
  return current ? children : <WeatherSkeleton />;
};
