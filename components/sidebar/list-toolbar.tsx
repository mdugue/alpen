"use client";

import { useT } from "@/components/i18n";

/**
 * The row above a list: whatever that kind needs on the left, and its
 * "auf der Karte" switch on the right.
 *
 * The switch used to sit next to the tab bar, which read as belonging to the
 * *tabs* rather than to the list one of them shows – a control beside a row of
 * three tabs looks like it acts on all three, and there was nothing to say
 * otherwise. Inside the tab's own content it is unambiguous by position: it is
 * the first thing in the panel the tab opened, so it can only be about that
 * panel. The words are there for the same reason; a bare switch says what it
 * does only once you have flipped it.
 */
export const ListToolbar = ({
  children,
  control,
  label,
}: {
  /** Left side, e.g. the sort picker. */
  children?: React.ReactNode;
  control: React.ReactNode;
  /** What the switch shows, where the list holds more than one kind; "auf der Karte" otherwise. */
  label?: string;
}) => {
  const { t } = useT();
  return (
    <div className="border-border flex items-center gap-2 border-b px-3 py-1.5">
      {children}
      <label className="text-muted-foreground text-2xs ml-auto flex shrink-0 items-center gap-1.5">
        {label ?? t.sidebar.lists.onMap}
        {control}
      </label>
    </div>
  );
};
