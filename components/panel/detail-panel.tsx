"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { useT } from "@/components/i18n";
import { useSheet } from "@/components/mobile-sheet";
import type { PanelActions } from "@/components/panel/actions";
import { DestinationDetail } from "@/components/panel/destination-detail";
import { PanelBar } from "@/components/panel/panel-bar";
import { PanelHead } from "@/components/panel/panel-head";
import { PassDetail } from "@/components/panel/pass-detail";
import { TourDetail } from "@/components/panel/tour-detail";
import { TownDetail } from "@/components/panel/town-detail";
import type { Selection } from "@/lib/app-state";
import { SITE_NAME } from "@/lib/brand";
import { detailModel } from "@/lib/detail-model";
import {
  heroShape,
  pastHead,
  shownPhotos,
  useDetailState,
} from "@/lib/detail-state";
import type { PageBundle } from "@/lib/page-data";
import { entityKey } from "@/lib/route-key";
import type { Period } from "@/lib/types";
import { useShare } from "@/lib/use-share";
import { cn } from "@/lib/utils";

/** A layer over the page that closes on Escape itself (see the effect below). */
const LAYER = "[data-slot=dialog-content],[data-slot=popover-content]";

/** Elements in which Escape belongs to whatever is being typed. */
const TYPED = new Set(["INPUT", "TEXTAREA"]);

/**
 * Detail view of the selected entity. It is a panel of its own in both layouts:
 * the slide-over next to the sidebar on desktop, its own bottom sheet on a
 * phone – so closing it always means the same thing and the lists keep their
 * scroll position underneath.
 *
 * Model in, markup out: what a pass, a tour, a town or a destination shows is
 * `detailModel` (lib/detail-model.ts), and the shell renders the head, the
 * control row and one of the four kind modules. It resolves nothing about the entity itself,
 * which is why the kind appears exactly once here.
 */
export const DetailPanel = ({
  selection,
  data,
  period,
  hovered,
  favorite,
  actions,
  weather,
}: {
  selection: Selection;
  /** Everything the page loaded, plus the index the explorer already holds. */
  data: PageBundle;
  period: Period;
  /** What the pointer is over, anywhere on screen. */
  hovered: Selection | null;
  favorite: boolean;
  actions: PanelActions;
  /** The pass page's streamed forecast, shown in the weather block (plan 02). */
  weather?: React.ReactNode;
}) => {
  const { t, lang } = useT();
  const panel = useRef<HTMLElement>(null);
  const scroller = useRef<HTMLDivElement>(null);
  // Below the sheet's top snap point nothing scrolls, so the head is on screen
  // by construction and the bar has no business taking a surface. `over` is
  // the same fact the sheet already knows: a detail rendered inside the list
  // drawer has a list behind it to go back to, one over the bare map has not.
  const { expanded, over } = useSheet();
  // The hash already *is* the shareable state; this only hands it over.
  const { share, done: shared } = useShare();
  /**
   * Whether the panel head has scrolled out from under the control row – for
   * this entity, which is what makes it reset itself: the key changes with
   * the selection, so a fresh panel starts at the top without an effect
   * writing state after the fact.
   */
  const [headPassed, setHeadPassed] = useState<string | null>(null);

  // The profiles and the photos of this one entity, as a static file with a
  // content hash in its name (lib/detail-assets.ts) – so the page does not
  // carry all 262 passes' worth, and looking at the same pass again is free.
  // An entity with neither has no URL and nothing is fetched.
  const asset = data.detail[entityKey(selection)];
  const { state, markBroken } = useDetailState(asset);

  // Move focus and scroll to the top whenever another entity is selected. The
  // selection is the trigger, not something the effect reads – which is what
  // the rule objects to.
  //
  // A *layout* effect, so the panel owns the focus in the frame it appears in.
  // As a passive effect this ran after paint, which left a window – one that
  // widens with everything else the commit has to do – in which the panel was
  // on screen while focus was still on the row that opened it. Escape then
  // went to the row, which has no handler for it, and the panel simply would
  // not close from the keyboard. The e2e suite caught it as a flake; a
  // keyboard visitor would have caught it as "Escape does nothing".
  //
  // What takes the focus is the *panel*, not the heading. The heading is
  // written across the foot of the hero photo, and focusing something that far
  // down a scroll container asks the browser to bring it into view;
  // `preventScroll` is the request not to, and it is a request browsers have
  // not always honoured. Where it was ignored the panel opened already
  // scrolled – the photo had slid up over its own title, which reads as the
  // title having disappeared behind the picture. Nothing about the
  // announcement changes: the section carries `aria-labelledby="detail-title"`
  // either way. And the scroll reset now runs *after* the focus call rather
  // than before it, so a browser that scrolls anyway is put back.
  useLayoutEffect(() => {
    panel.current?.focus({ preventScroll: true });
    scroller.current?.scrollTo({ top: 0 });
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
  }, [selection.kind, selection.slug]);

  // Coming back down from the top snap point, the content starts over at the
  // hero: a collapsed sheet showing the middle of an article has lost the one
  // thing it is tall enough to show.
  useEffect(() => {
    if (!expanded) scroller.current?.scrollTo({ top: 0 });
  }, [expanded]);

  /**
   * Escape closes the panel from anywhere on the page, not only from inside
   * it. The panel takes the focus when it opens, but a click on the map, a
   * scroll of the list or a tap on a control puts the focus somewhere else,
   * and a key that then does nothing reads as a key that does not work.
   *
   * Two things own Escape ahead of the panel and keep it. A layer over the
   * page – the scales dialog, a source popover – closes itself with it, and
   * closing the panel underneath at the same time would take away what the
   * visitor was about to return to. And in a text field the key belongs to
   * the field: Chrome empties a search input with it. Both are asked about
   * here rather than left to the order the listeners happen to run in, which
   * the portal a dialog renders into does not settle.
   *
   * The listener is on `document` while the panel is mounted, which is while
   * something is selected – so there is no state to ask about and nothing to
   * clean up beyond the listener itself.
   */
  const { onBack } = actions;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector(LAYER)) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.isContentEditable || TYPED.has(target.tagName)))
        return;
      onBack();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onBack]);

  const model = detailModel(selection, data, {
    detail: state,
    hovered,
    lang,
    period,
  });
  if (!model) return null;

  const hero = heroShape(state) === "hero";
  const key = entityKey(selection);
  const scrolled = expanded && headPassed === key;
  /**
   * The control row carries a surface everywhere except on the hero, where the
   * photo's own scrim is what the icons read against. On the way past the head
   * it takes one on, and with it the name – which is the other half of why it
   * is worth knowing: the title lies on the photo and scrolls away with it.
   */
  const solid = !hero || scrolled;

  return (
    <section
      ref={panel}
      tabIndex={-1}
      aria-labelledby="detail-title"
      className="relative flex min-h-0 flex-1 flex-col outline-none"
    >
      <PanelBar
        name={model.name}
        solid={solid}
        scrolled={scrolled}
        backToList={over}
        favorite={favorite}
        shared={shared}
        onBack={actions.onBack}
        onShare={() => {
          void share(`${model.name} – ${SITE_NAME}`);
        }}
        onToggleFavorite={actions.onToggleFavorite}
      />
      <div
        ref={scroller}
        data-scroller
        onScroll={(e) => {
          // The head is the first child either way – the hero or the plain
          // title block – so what has to be measured is measured rather than
          // guessed at a width the panel takes from its layout. Only the
          // measuring is here; what it means is `pastHead` in lib.
          const head = e.currentTarget.firstElementChild as HTMLElement | null;
          setHeadPassed(pastHead(e.currentTarget.scrollTop, head) ? key : null);
        }}
        className={cn(
          "min-h-0 flex-1 overscroll-contain pb-6",
          expanded ? "overflow-y-auto" : "overflow-hidden",
        )}
      >
        <PanelHead
          hero={hero}
          kicker={model.kicker}
          name={model.name}
          loading={state.phase === "pending"}
          photos={shownPhotos(state)}
          onBroken={markBroken}
        />
        <div className="px-4 pt-3">
          {/* The file promised photos and did not arrive. Saying so is the
              honest end of the wait: the head has already given up its hero,
              and the profile block says the same thing in its own words. */}
          {state.phase === "failed" && (asset?.photos ?? 0) > 0 && (
            <p className="text-muted-foreground text-2xs">
              {t.panel.photos.notLoaded}
            </p>
          )}
          {model.kind === "pass" && (
            <PassDetail actions={actions} model={model} weather={weather} />
          )}
          {model.kind === "tour" && (
            <TourDetail actions={actions} model={model} />
          )}
          {model.kind === "town" && (
            <TownDetail actions={actions} model={model} />
          )}
          {model.kind === "destination" && (
            <DestinationDetail actions={actions} model={model} />
          )}
        </div>
      </div>
    </section>
  );
};
