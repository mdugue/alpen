"use client";

import type { ReactNode } from "react";

import { Toggle } from "@/components/ui/toggle";
import type { Options } from "@/lib/app-state";
import { thresholdChips } from "@/lib/app-state";
import { cn, TOUCH_CONTROL } from "@/lib/utils";

/**
 * Every filter in this app is a chip: a small, pressable word that is either
 * on or off. One shape for all of them, because the old panel spoke four
 * languages at once – a range slider for the difficulty, another for the
 * height, three native selects for the 1–5 thresholds and two rows of
 * full-width toggle buttons for type and label – and a visitor had to learn
 * each of them before the panel could be read at a glance.
 *
 * Chips rather than sliders, on purpose. A slider is for a value where the
 * exact number matters and the scale is wide; a 1–5 judgement and four round
 * height thresholds are neither, and a slider thumb is the one control on a
 * phone that is regularly missed – it is small, it swallows the sheet's swipe
 * and its thumb disappears against the filled track at the ends of the scale.
 * A chip is a tap target with its own label, it wraps, and it says what it
 * does when it is _not_ pressed, which a slider at its default never does.
 *
 * Pressed is a solid fill rather than a tick in front of the word: a tick
 * appearing changes the chip's width, and in a wrapped row every chip after
 * it jumps to a new place while the thumb is still on the one just pressed.
 * The fill is carried by the primary colour _and_ by the border, so it does
 * not rest on hue alone.
 */
export const FilterChip = ({
  pressed,
  onPressedChange,
  children,
  label,
  hint,
  className,
}: {
  pressed: boolean;
  onPressedChange: (pressed: boolean) => void;
  children: ReactNode;
  /** For screen readers where the chip's word only makes sense inside its group ("3"). */
  label?: string;
  /** The vocabulary's own sentence, as a pointer tooltip. */
  hint?: string;
  className?: string;
}) => (
  <Toggle
    variant="outline"
    pressed={pressed}
    onPressedChange={onPressedChange}
    aria-label={label}
    title={hint}
    className={cn(
      // The Toggle's own default size, widened into a pill and grown for a
      // thumb by the constant every other control in the app uses – h-7 with a
      // mouse, h-9 on a coarse pointer. No step of its own: a chip taller than
      // the buttons beside it reads as a different kind of thing.
      "border-border gap-1.5 rounded-full px-3 font-normal",
      TOUCH_CONTROL,
      "aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:font-medium",
      "aria-pressed:hover:bg-primary/90 aria-pressed:hover:text-primary-foreground",
      className,
    )}
  >
    {children}
  </Toggle>
);

/**
 * One row of chips under its own heading. The heading names the criterion and
 * carries its current value on the right, so a folded-up glance over the panel
 * reads as a list of answers ("Schwierigkeit – 2 bis 4") rather than as a list
 * of questions. `value` is left out where the chips themselves already say it.
 */
export const ChipGroup = ({
  id,
  label,
  value,
  hint,
  children,
}: {
  id: string;
  label: string;
  value?: string;
  hint?: string;
  children: ReactNode;
}) => (
  <div className="grid gap-1.5">
    <div className="flex items-baseline gap-2">
      <span id={id} className="text-muted-foreground text-2xs">
        {label}
      </span>
      {value && (
        <span className="text-2xs ml-auto text-right font-medium tabular-nums">
          {value}
        </span>
      )}
    </div>
    {hint && <p className="text-muted-foreground text-2xs -mt-1">{hint}</p>}
    <div role="group" aria-labelledby={id} className="flex flex-wrap gap-1.5">
      {children}
    </div>
  </div>
);

/**
 * A threshold on one of the 1–5 scales or on a measured signal: at most one
 * chip is pressed, and pressing the pressed one lifts the filter again. The
 * first option of every list is that "no filter" value and gets no chip – an
 * "egal" chip would be a second way of saying what the empty row already says,
 * and it would be pressed on nine panels out of ten, which teaches the eye to
 * ignore exactly the colour that marks an active filter.
 */
export const ThresholdChips = ({
  id,
  label,
  hint,
  options,
  value,
  onChange,
}: {
  id: string;
  label: string;
  hint?: string;
  options: Options;
  value: number;
  onChange: (value: number) => void;
}) => {
  const [[none]] = options as unknown as [[number, string]];
  return (
    <ChipGroup id={id} label={label} hint={hint}>
      {thresholdChips(options).map(([v, text]) => (
        <FilterChip
          key={v}
          pressed={value === v}
          onPressedChange={(on) => onChange(on ? v : none)}
        >
          {text}
        </FilterChip>
      ))}
    </ChipGroup>
  );
};
