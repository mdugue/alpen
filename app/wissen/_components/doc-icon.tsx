import {
  BlocksIcon,
  BookOpenTextIcon,
  BracesIcon,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HistoryIcon,
  LayersIcon,
  LibraryIcon,
  MapIcon,
  MilestoneIcon,
  PanelsTopLeftIcon,
  RouteIcon,
  SignpostIcon,
  SlidersHorizontalIcon,
  WorkflowIcon,
} from "lucide-react";
import type { LucideProps } from "lucide-react";
import type { ReactNode } from "react";

type Glyph = (props: LucideProps) => ReactNode;

/**
 * One glyph per page, keyed by its path under docs/ (the guide without its
 * language folder). Decoration only: a page without an entry gets the plain
 * document.
 */
const ICONS: Record<string, Glyph> = {
  AGENTS: (p) => <LibraryIcon {...p} />,
  architecture: (p) => <BlocksIcon {...p} />,
  "data-journey": (p) => <RouteIcon {...p} />,
  "data-model": (p) => <BracesIcon {...p} />,
  "data-pipeline": (p) => <WorkflowIcon {...p} />,
  "data-sources": (p) => <DatabaseIcon {...p} />,
  glossary: (p) => <BookOpenTextIcon {...p} />,
  handover: (p) => <HistoryIcon {...p} />,
  "how-it-works": (p) => <MapIcon {...p} />,
  "map-rendering": (p) => <LayersIcon {...p} />,
  "plans/README": (p) => <MilestoneIcon {...p} />,
  roadmap: (p) => <SignpostIcon {...p} />,
  scales: (p) => <SlidersHorizontalIcon {...p} />,
  "scales-and-status": (p) => <GaugeIcon {...p} />,
  "ui-conventions": (p) => <PanelsTopLeftIcon {...p} />,
};

const DOCUMENT: Glyph = (p) => <FileTextIcon {...p} />;

/** The page's glyph, as an element. */
export const docIcon = (file: string, props: LucideProps): ReactNode => {
  const inner = file
    .replace(/^docs\/(?:guide\/de\/)?/u, "")
    .replace(/\.md$/u, "");
  return (ICONS[inner] ?? DOCUMENT)({ "aria-hidden": true, ...props });
};
