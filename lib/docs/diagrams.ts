import { createHash } from "node:crypto";

/**
 * The docs' Mermaid diagrams, rendered once by `bun run docs:diagrams`
 * (scripts/render-diagrams.ts, a real Mermaid in Chrome) and committed as SVG
 * under this directory, one file per diagram, named after its source. The
 * /wissen pages inline them; nothing Mermaid reaches the browser.
 */
export const DIAGRAM_DIR = "docs/diagrams";

/**
 * Bumped whenever the render changes without the source changing – the
 * Mermaid config, the theme table below, the font – so every key moves and
 * the freshness test asks for a re-render.
 */
export const RENDER_VERSION = 1;

const FENCE = /^```mermaid[^\S\n]*\n(?<body>[\s\S]*?)\n```[^\S\n]*$/gmu;

/** Every Mermaid block of a Markdown file, in order, as written. */
export const mermaidBlocks = (markdown: string): string[] =>
  [...markdown.matchAll(FENCE)].map((m) => m.groups?.body ?? "");

/** The file a diagram's SVG is stored under: its source, hashed. */
export const diagramKey = (source: string): string => {
  const normalised = source.replaceAll(/[^\S\n]+$/gmu, "").trim();
  return createHash("sha256")
    .update(`${RENDER_VERSION}\n${normalised}`)
    .digest("hex")
    .slice(0, 16);
};

/**
 * Mermaid derives its palette from real colours, so it cannot be handed CSS
 * variables. It is handed these sentinels instead, and the renderer swaps
 * each one for its variable afterwards: the committed SVG carries no colour
 * of its own and follows the page's tokens (app/wissen/wissen.css), dark
 * mode included, without a re-render.
 */
export const DIAGRAM_COLORS = {
  background: "#fe0101",
  cluster: "#fe0106",
  clusterBorder: "#fe0107",
  labelBackground: "#fe0108",
  line: "#fe0105",
  node: "#fe0102",
  nodeBorder: "#fe0103",
  note: "#fe0109",
  noteBorder: "#fe010a",
  text: "#fe0104",
} as const;

export type DiagramColor = keyof typeof DIAGRAM_COLORS;

/** The CSS custom property each sentinel becomes. */
export const diagramVar = (name: DiagramColor): string =>
  `--diagram-${name.replaceAll(/[A-Z]/gu, (c) => `-${c.toLowerCase()}`)}`;

/**
 * Mermaid's `themeVariables`, every one it reads pinned to a sentinel – the
 * flowchart, sequence, entity–relationship and state diagrams' alike.
 */
export const mermaidThemeVariables = (fontFamily: string) => {
  const c = DIAGRAM_COLORS;
  return {
    activationBkgColor: c.cluster,
    activationBorderColor: c.nodeBorder,
    actorBkg: c.node,
    actorBorder: c.nodeBorder,
    actorLineColor: c.line,
    actorTextColor: c.text,
    altBackground: c.cluster,
    arrowheadColor: c.line,
    attributeBackgroundColorEven: c.cluster,
    attributeBackgroundColorOdd: c.node,
    background: c.background,
    clusterBkg: c.cluster,
    clusterBorder: c.clusterBorder,
    compositeBackground: c.cluster,
    compositeBorder: c.clusterBorder,
    compositeTitleBackground: c.cluster,
    darkMode: false,
    edgeLabelBackground: c.labelBackground,
    fontFamily,
    fontSize: "15px",
    innerEndBackground: c.nodeBorder,
    labelBackgroundColor: c.labelBackground,
    labelBoxBkgColor: c.node,
    labelBoxBorderColor: c.nodeBorder,
    labelTextColor: c.text,
    lineColor: c.line,
    loopTextColor: c.text,
    mainBkg: c.node,
    nodeBorder: c.nodeBorder,
    nodeTextColor: c.text,
    noteBkgColor: c.note,
    noteBorderColor: c.noteBorder,
    noteTextColor: c.text,
    primaryBorderColor: c.nodeBorder,
    primaryColor: c.node,
    primaryTextColor: c.text,
    rowEven: c.cluster,
    rowOdd: c.node,
    secondaryBorderColor: c.clusterBorder,
    secondaryColor: c.cluster,
    secondaryTextColor: c.text,
    sequenceNumberColor: c.background,
    signalColor: c.line,
    signalTextColor: c.text,
    specialStateColor: c.nodeBorder,
    stateBkg: c.node,
    stateLabelColor: c.text,
    tertiaryBorderColor: c.clusterBorder,
    tertiaryColor: c.cluster,
    tertiaryTextColor: c.text,
    textColor: c.text,
    titleColor: c.text,
    transitionColor: c.line,
    transitionLabelColor: c.text,
  };
};

/** A colour as Chrome's computed style spells it: `rgb(r, g, b)`. */
export const rgbOf = (hex: string): string => {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? Array.from(h, (c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) =>
    Number.parseInt(full.slice(i, i + 2), 16),
  );
  return `rgb(${r}, ${g}, ${b})`;
};

/**
 * Turns Mermaid's output into the committed file: sentinels become CSS
 * variables (also where Mermaid gave one an alpha), the measured font
 * becomes the page's font variable.
 */
export const themeSvg = (svg: string, measuredFont: string): string => {
  let out = svg;
  for (const [name, hex] of Object.entries(DIAGRAM_COLORS)) {
    const cssVar = `var(${diagramVar(name as DiagramColor)})`;
    const [r, g, b] = rgbOf(hex).slice(4, -1).split(", ");
    out = out
      .replaceAll(new RegExp(hex, "giu"), cssVar)
      .replaceAll(
        new RegExp(
          `rgba?\\(\\s*${r},\\s*${g},\\s*${b}(?:,\\s*([\\d.]+))?\\s*\\)`,
          "gu",
        ),
        (_, alpha: string | undefined) =>
          alpha === undefined || alpha === "1"
            ? cssVar
            : `color-mix(in srgb, ${cssVar} ${Math.round(Number(alpha) * 100)}%, transparent)`,
      );
  }
  // Mermaid respells the family in places ("A", b / "A",b / &quot;A&quot;).
  const family = measuredFont.replaceAll(/^["']|["'].*$/gu, "");
  const spelled = new RegExp(
    `(?:"|'|&quot;)${family}(?:"|'|&quot;)\\s*,\\s*sans-serif`,
    "gu",
  );
  return out.replace(spelled, "var(--font-sans)");
};

/**
 * The host page's text colour: a label that paints it inherits the page's
 * foreground wherever the SVG is inlined, which is what it should do.
 */
export const INHERITED = "rgb(1, 2, 3)";

/** A colour with its alpha dropped: `rgba(r, g, b, a)` becomes `rgb(r, g, b)`. */
const opaque = (c: string) =>
  c.replace(
    /^rgba\((?<r>\d+), (?<g>\d+), (?<b>\d+), [\d.]+\)$/u,
    "rgb($<r>, $<g>, $<b>)",
  );

/**
 * The colours a rendered diagram actually paints (Chrome's computed fill,
 * stroke, text and background of every element) that come from neither the
 * theme nor the diagram's own `classDef`s. Mermaid's stylesheet carries
 * constants for looks we do not use; only what is painted counts.
 */
export const strayPaint = (
  painted: readonly string[],
  authored: readonly string[],
): string[] => {
  const ok = new Set([
    ...Object.values(DIAGRAM_COLORS).map(rgbOf),
    ...authored.map(rgbOf),
    INHERITED,
  ]);
  return [...new Set(painted)].filter(
    (c) =>
      !(ok.has(opaque(c)) || c === "none" || /^rgba\([^)]*,\s*0\)$/u.test(c)),
  );
};

/** Colours a diagram names itself (`classDef`, `style`), which stay as written. */
export const authoredColors = (source: string): string[] =>
  [...source.matchAll(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/giu)].map((m) =>
    m[0].toLowerCase(),
  );
