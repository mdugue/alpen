"use client";

import { useT } from "@/components/i18n";
import { cn } from "@/lib/utils";

/** Editorial 1–5 scale as bars; explained in the scales dialog. */
export const Rating = ({
  value,
  muted,
  tone = "primary",
  className,
}: {
  value: number;
  muted?: boolean;
  /**
   * `current` paints the bars in the text colour instead of the primary one.
   * Inside a pressed filter chip the surface *is* the primary colour, so a
   * primary bar would be invisible exactly where the filter is active.
   */
  tone?: "primary" | "current";
  className?: string;
}) => {
  const { t, fmt } = useT();
  return (
    <span
      role="img"
      aria-label={t.sidebar.rating(fmt(value))}
      className={cn("inline-flex gap-0.5 align-middle", className)}
    >
      {[1, 2, 3, 4, 5].map((i) => (
        <span
          key={i}
          aria-hidden
          className={cn(
            "h-2.5 w-1.5 rounded-xs",
            i <= value
              ? tone === "current"
                ? "bg-current"
                : muted
                  ? "bg-muted-foreground"
                  : "bg-primary"
              : tone === "current"
                ? "bg-current/25"
                : "bg-muted-foreground/25",
          )}
        />
      ))}
    </span>
  );
};
