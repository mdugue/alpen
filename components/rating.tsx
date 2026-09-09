import { cn } from "@/lib/utils";

/** Editorial 1–5 scale as bars; explained in the scales dialog. */
export const Rating = ({
  value,
  muted,
  className,
}: {
  value: number;
  muted?: boolean;
  className?: string;
}) => (
  <span
    role="img"
    aria-label={`${value} von 5`}
    className={cn("inline-flex gap-0.5 align-middle", className)}
  >
    {[1, 2, 3, 4, 5].map((i) => (
      <span
        key={i}
        aria-hidden
        className={cn(
          "h-2.5 w-1.5 rounded-xs",
          i <= value
            ? muted
              ? "bg-muted-foreground"
              : "bg-primary"
            : "bg-muted-foreground/25",
        )}
      />
    ))}
  </span>
);
