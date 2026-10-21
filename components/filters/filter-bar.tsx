"use client";

import { ChevronLeft, Plus, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { ReactNode } from "react";

import { CriterionEditor } from "@/components/filters/criterion-editor";
import type { EditorProps } from "@/components/filters/criterion-editor";
import { useT } from "@/components/i18n";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Filters } from "@/lib/app-state";
import {
  appliedFilters,
  CRITERIA,
  CRITERION_GROUPS,
  isStandard,
  standardFilters,
  SWITCHES,
} from "@/lib/filter-summary";
import type { CriterionId } from "@/lib/filter-summary";
import { fill } from "@/lib/i18n/fill";
import { CLASSIC_FAME } from "@/lib/regions";
import { cn, MAP_CLUSTER, TOUCH_CONTROL } from "@/lib/utils";

/**
 * What every piece of the bar is made of: the map's own glass, at the height
 * of the map tools in the opposite corner (`TOOL` in `pass-map.tsx`), so the
 * filters read as more of the same furniture rather than as a form laid on
 * the map. Each piece is its own surface, and the bar between them is bare –
 * a glass bar around glass pills would stack two of them (`GLASS`).
 */
const PIECE = cn(MAP_CLUSTER, "border-border h-9 shrink-0 rounded-full border");

/** The popover every editor sits in: wide enough for five chips with counts. */
const EDITOR = "w-auto max-w-[min(22rem,calc(100vw-1.5rem))] gap-3 p-3";

/**
 * One criterion in the bar: the value, which opens the criterion's chips, and
 * the ×, which lifts it. Two buttons in one pill, so the × is a target of its
 * own rather than a corner of the label. A switch ("Nur Gemerkte") has
 * nothing to choose, so its value is a plain label and only the × acts.
 *
 * The popover is the bar's, not the token's (`open`): a chip that lifts the
 * criterion – "Alle" on the fame floor, the last range off – takes the token
 * out of `appliedFilters`, and a popover owned by it would vanish under the
 * thumb, with the focus. The bar keeps it standing until the popover closes.
 */
const Token = ({
  label,
  muted,
  dimmed,
  open,
  onOpenChange,
  onRemove,
  editor,
}: {
  label: string;
  /** Held open after its criterion was lifted inside the popover. */
  muted: boolean;
  /** The fame floor while a search looks past it: set, but not in force. */
  dimmed: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRemove: () => void;
  /** The chips; `null` for a switch. */
  editor: ReactNode;
}) => {
  const { t } = useT();
  const words = t.map.filters;
  const value = (
    <>
      {label}
      {dimmed && <span className="sr-only">. {words.searching}</span>}
    </>
  );
  return (
    <span
      className={cn(
        PIECE,
        "flex items-center font-medium transition-opacity",
        (dimmed || muted) && "opacity-60",
      )}
      title={dimmed ? words.searching : undefined}
    >
      {editor === null ? (
        <span className="pr-1 pl-3.5 text-xs">{value}</span>
      ) : (
        <Popover open={open} onOpenChange={onOpenChange}>
          <PopoverTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                aria-label={fill(words.edit, { label })}
                className="h-full rounded-full rounded-r-none pr-1 pl-3.5 font-medium hover:bg-transparent"
              />
            }
          >
            {value}
          </PopoverTrigger>
          <PopoverContent align="start" className={EDITOR}>
            {editor}
          </PopoverContent>
        </Popover>
      )}
      {!muted && (
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onRemove}
          aria-label={fill(t.sidebar.filters.remove, { label })}
          className="h-full w-8 rounded-full rounded-l-none opacity-60 hover:bg-transparent hover:opacity-100"
        >
          <X />
        </Button>
      )}
    </span>
  );
};

/**
 * The "+": every criterion not yet set, grouped, and – once one is chosen –
 * that criterion's chips in the same popover, so adding a filter is two taps
 * and never a trip to another place. A switch needs no second step: choosing
 * it is the decision, and its token appears in the bar at once.
 */
const AddMenu = ({
  offered,
  onSwitch,
  editor,
}: {
  offered: readonly CriterionId[];
  onSwitch: (patch: Partial<Filters>) => void;
  editor: EditorProps;
}) => {
  const { t } = useT();
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<CriterionId | null>(null);
  const words = t.map.filters;
  const groups = CRITERION_GROUPS.map((g) => ({
    group: g,
    ids: offered.filter((id) => CRITERIA.find((c) => c.id === id)?.group === g),
  })).filter((g) => g.ids.length > 0);

  const choose = (id: CriterionId) => {
    const on = SWITCHES[id];
    if (on) {
      onSwitch(on);
      setOpen(false);
    } else setChosen(id);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setChosen(null);
      }}
    >
      <PopoverTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={words.add}
            title={words.add}
            // Never unmounted while its popover is open: the criterion it
            // just set may have been the last one left.
            disabled={groups.length === 0 && !open}
            className={cn(PIECE, "size-9")}
          />
        }
      >
        <Plus />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className={cn(EDITOR, chosen === null && "w-56 gap-2 p-1.5")}
      >
        {chosen === null ? (
          groups.map(({ group, ids }) => (
            <div key={group} role="group" aria-label={words.group[group]}>
              <p className="text-muted-foreground text-2xs px-2 pt-1 pb-0.5">
                {words.group[group]}
              </p>
              {ids.map((id, n) => (
                <Button
                  key={id}
                  // Back from an editor, the focus returns to the list.
                  autoFocus={n === 0 && group === groups[0]?.group}
                  variant="ghost"
                  size="sm"
                  onClick={() => choose(id)}
                  className={cn(
                    "w-full justify-start font-normal",
                    TOUCH_CONTROL,
                  )}
                >
                  {words.name[id]}
                </Button>
              ))}
            </div>
          ))
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              autoFocus
              onClick={() => setChosen(null)}
              className={cn("-mx-1 -mt-1 w-fit", TOUCH_CONTROL)}
            >
              <ChevronLeft data-icon="inline-start" />
              {words.back}
            </Button>
            <CriterionEditor id={chosen} {...editor} />
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

/**
 * The one place the filters live: a bar of tokens over the map, at every
 * width. A token says only the value – "Klassiker", "ab 2.000 m" – and opens
 * its criterion's chips in a popover; its × lifts it. The "+" lists every
 * criterion not yet set, under the question it answers, and opens the chosen
 * one in the same popover (a switch is set on the spot). "Standard" stands at
 * the end only once the filters are not what the app opens on.
 *
 * A bar rather than a panel, because a panel is a place one has to go to: on
 * a phone it was a drawer away from the map it filtered, and a filter nobody
 * can see is a filter nobody lifts. The bar scrolls sideways instead of
 * wrapping, so its height – which the camera's padding reads – stays one row.
 */
export const FilterBar = ({
  hasEditions,
  ...editor
}: EditorProps & {
  /** Whether any event changes its course, which "Frühere Jahre" is about. */
  hasEditions: boolean;
}) => {
  const { t } = useT();
  const { filters, setFilters, ranges } = editor;
  const applied = appliedFilters(filters, t);
  const set = new Set(applied.map((a) => a.key));
  const offered = CRITERIA.filter(
    (c) =>
      !set.has(c.id) &&
      (c.id !== "ranges" || ranges.length > 1) &&
      (c.id !== "pastEditions" || hasEditions),
  );
  const searching = filters.query.trim() !== "";
  /** The criterion whose popover is open; its token stands until it closes. */
  const [editing, setEditing] = useState<CriterionId | null>(null);
  const tokens: { key: CriterionId; label: string; muted: boolean }[] =
    applied.map((a) => ({ key: a.key, label: a.label, muted: false }));
  if (editing !== null && !set.has(editing))
    tokens.splice(
      CRITERIA.filter((c) => set.has(c.id) || c.id === editing).findIndex(
        (c) => c.id === editing,
      ),
      0,
      { key: editing, label: t.map.filters.name[editing], muted: true },
    );

  return (
    <div
      role="group"
      aria-label={t.map.filters.bar}
      className={cn(
        // The padding is room for the pieces' shadows, which a scrolling box
        // would clip; the margin takes it back, so the first pill still
        // stands where the shell puts the bar.
        "-m-1.5 flex w-fit max-w-[calc(100%+0.75rem)] items-center gap-1.5 overflow-x-auto p-1.5",
        "[scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
      )}
      data-base-ui-swipe-ignore
    >
      {tokens.map(({ key, label, muted }) => (
        <Token
          key={key}
          label={label}
          muted={muted}
          dimmed={key === "fame" && searching}
          open={editing === key}
          onOpenChange={(open) => setEditing(open ? key : null)}
          onRemove={() =>
            setFilters(
              (f) =>
                appliedFilters(f, t)
                  .find((a) => a.key === key)
                  ?.clear(f) ?? f,
            )
          }
          editor={
            SWITCHES[key] ? null : <CriterionEditor id={key} {...editor} />
          }
        />
      ))}
      <AddMenu
        offered={offered.map((c) => c.id)}
        onSwitch={(patch) => setFilters((f) => ({ ...f, ...patch }))}
        editor={editor}
      />
      {!isStandard(filters, t) && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setFilters(standardFilters)}
          title={fill(t.map.filters.standardHint, { n: CLASSIC_FAME })}
          className={cn(PIECE, "px-3")}
        >
          <RotateCcw data-icon="inline-start" />
          {/* A phone's bar is full of tokens by then; the arrow says it. */}
          <span className="max-sm:sr-only">{t.map.filters.standard}</span>
        </Button>
      )}
    </div>
  );
};
