import { CAROUSEL_LAYOUTS, DATE_LAYOUTS, Doc, KIND_ORDER, Kind, TIME_LAYOUTS, VARIANTS, isCardAlign, isCardImagePos, isPlace, isTextToken, isPlatform, isTrackThickness } from "./tokens";

/** Versioned on-disk format for m3e-canvas projects. */
export const PROJECT_FORMAT = "m3e-project";
export const PROJECT_VERSION = 1;

type ProjectEnvelope = {
  format: typeof PROJECT_FORMAT;
  version: typeof PROJECT_VERSION;
  document: Doc;
};

/* The editor still works with the plain Doc shape in memory. The envelope is
 * only used at the file boundary, so adding fields to the project format does
 * not force a rewrite of the editor state model. */

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null;

const KINDS = new Set<string>(KIND_ORDER);

const validTabs = (tabs: unknown) =>
  tabs === undefined || (Array.isArray(tabs) && tabs.every((tab) => isRecord(tab) && typeof tab.label === "string" && (typeof tab.icon === "string" || tab.icon === null || tab.icon === undefined) && (tab.src === undefined || typeof tab.src === "string")));

const validCorners = (c: unknown) => c === undefined || (isRecord(c) && ["tl", "tr", "bl", "br"].every((k) => Number.isFinite(c[k])));

/** the layouts a carousel and the two pickers may be saved with */
const LAYOUTS = new Set<string>([...CAROUSEL_LAYOUTS, ...DATE_LAYOUTS, ...TIME_LAYOUTS].map((l) => l.key));
const optionalNumber = (v: unknown) => v === undefined || Number.isFinite(v);

const validItem = (item: unknown) =>
  isRecord(item) &&
  validCorners(item.corners) &&
  (item.railExpanded === undefined || typeof item.railExpanded === "boolean") &&
  (item.railModal === undefined || typeof item.railModal === "boolean") &&
  (item.trackThickness === undefined || isTrackThickness(item.trackThickness)) &&
  (item.imagePos === undefined || isCardImagePos(item.imagePos)) &&
  (item.imageSize === undefined || (Number.isFinite(item.imageSize) && (item.imageSize as number) > 0)) &&
  (item.contentAlign === undefined || isCardAlign(item.contentAlign)) &&
  (item.textAlign === undefined || isCardAlign(item.textAlign)) &&
  (item.textColor === undefined || isTextToken(item.textColor)) &&
  typeof item.id === "string" &&
  typeof item.kind === "string" &&
  KINDS.has(item.kind as Kind) &&
  typeof item.label === "string" &&
  (typeof item.icon === "string" || item.icon === null) &&
  VARIANTS.some((variant) => variant.key === item.variant) &&
  (item.supporting === undefined || typeof item.supporting === "string") &&
  (item.selected === undefined || Number.isFinite(item.selected)) &&
  (item.note === undefined || typeof item.note === "string") &&
  (item.layout === undefined || (typeof item.layout === "string" && LAYOUTS.has(item.layout))) &&
  optionalNumber(item.count) &&
  validTabs(item.tabs);

const validLayout = (layout: unknown) =>
  layout === undefined ||
  (isRecord(layout) &&
    layout.enabled === true &&
    (layout.direction === "horizontal" || layout.direction === "vertical") &&
    (layout.gap === undefined || (Number.isFinite(layout.gap) && (layout.gap as number) >= 0)) &&
    (layout.align === undefined || layout.align === "start" || layout.align === "center" || layout.align === "end") &&
    (layout.distribution === undefined ||
      layout.distribution === "start" ||
      layout.distribution === "center" ||
      layout.distribution === "end" ||
      layout.distribution === "spaceBetween") &&
    (layout.padding === undefined ||
      (isRecord(layout.padding) &&
        ["top", "right", "bottom", "left"].every((key) => layout.padding[key] === undefined || (Number.isFinite(layout.padding[key]) && (layout.padding[key] as number) >= 0)))));

const validGroup = (group: unknown) =>
  isRecord(group) &&
  typeof group.id === "string" &&
  Number.isFinite(group.x) &&
  Number.isFinite(group.y) &&
  (group.axis === "x" || group.axis === "y") &&
  (group.locked === undefined || typeof group.locked === "boolean") &&
  validLayout(group.layout) &&
  Array.isArray(group.items) &&
  group.items.length > 0 &&
  group.items.every(validItem);

const validFrame = (frame: unknown) =>
  isRecord(frame) &&
  typeof frame.id === "string" &&
  typeof frame.name === "string" &&
  Number.isFinite(frame.x) &&
  Number.isFinite(frame.y) &&
  (frame.w === undefined || (Number.isFinite(frame.w) && (frame.w as number) > 0)) &&
  (frame.h === undefined || (Number.isFinite(frame.h) && (frame.h as number) > 0)) &&
  (frame.note === undefined || typeof frame.note === "string") &&
  (frame.place === undefined || isPlace(frame.place));

/** whether a parsed file has the shape of a document the editor can open */
export const isProject = (value: unknown): value is Doc =>
  isRecord(value) && Array.isArray(value.groups) && Array.isArray(value.frames) && value.groups.every(validGroup) && value.frames.every(validFrame) && (value.platform === undefined || isPlatform(value.platform)) && (value.promptOptions === undefined || (Array.isArray(value.promptOptions) && value.promptOptions.every((o) => typeof o === "string")));

const isProjectEnvelope = (value: unknown): value is ProjectEnvelope =>
  isRecord(value) &&
  value.format === PROJECT_FORMAT &&
  value.version === PROJECT_VERSION &&
  isProject(value.document);

/** Serialize a document to the stable, versioned .m3e format. */
export const serializeProject = (doc: Doc): string =>
  JSON.stringify(
    { format: PROJECT_FORMAT, version: PROJECT_VERSION, document: doc } satisfies ProjectEnvelope,
    null,
    2,
  );

/** Deserialize a .m3e project, while keeping backwards compatibility with legacy JSON docs. */
export const deserializeProject = (value: unknown): Doc | null => {
  if (isProjectEnvelope(value)) return value.document;
  return isProject(value) ? value : null;
};

/** the file name a project is saved under: m3e-canvas, followed by the app's name when it has one */
export const projectFileName = (doc: Doc) => {
  const name = doc.title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return name ? `m3e-canvas ${name}.m3e` : "m3e-canvas.m3e";
};

/** hands the document to the browser as a JSON download */
export function saveProject(doc: Doc) {
  const url = URL.createObjectURL(new Blob([serializeProject(doc)], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = projectFileName(doc);
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** reads a chosen file back into a document, or null when it is not one */
export async function readProject(file: File): Promise<Doc | null> {
  try {
    const next: unknown = JSON.parse(await file.text());
    return deserializeProject(next);
  } catch {
    return null;
  }
}
