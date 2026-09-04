/**
 * `[[term]]` markers.
 *
 * Explanations and simplified articles mark jargon with double brackets:
 *   "normalized with a [[softmax]]"           → id/label "softmax"
 *   "[[selfattention|attention]] treats …"    → id "selfattention", display "attention"
 *
 * Demo concepts have global ids. Agent-made concepts are scoped to a document
 * (`${docId}:${slug}`) so the same word in two documents gets two explanations.
 */

const MARKER = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

export type Segment =
  | { kind: "text"; text: string }
  | { kind: "term"; text: string; label: string; conceptId: string };

/** How a marker is resolved to a concept id + label. */
export interface MarkerResolver {
  /** returns the label for a known concept id, or undefined */
  labelFor(id: string): string | undefined;
  /** id for a term the resolver does not know */
  idFor(term: string): string;
}

/** A url-ish safe id fragment for a term. */
export function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 40);
}

export function scopedId(docId: string, term: string): string {
  return `${docId}:${slug(term)}`;
}

/** Split marked text into plain and term segments. */
export function segments(marked: string, resolve: MarkerResolver): Segment[] {
  const out: Segment[] = [];
  let last = 0;
  for (const m of marked.matchAll(MARKER)) {
    const index = m.index ?? 0;
    if (index > last) out.push({ kind: "text", text: marked.slice(last, index) });
    const raw = (m[1] ?? "").trim();
    const display = m[2]?.trim();
    const known = resolve.labelFor(raw);
    const conceptId = known ? raw : resolve.idFor(raw);
    const label = known ?? display ?? raw;
    out.push({ kind: "term", text: display ?? known ?? raw, label, conceptId });
    last = index + m[0].length;
  }
  if (last < marked.length) out.push({ kind: "text", text: marked.slice(last) });
  return out;
}

/** Remove markers, keeping the display text. */
export function strip(marked: string, labelFor?: (id: string) => string | undefined): string {
  return (marked ?? "").replace(MARKER, (_m, id: string, display?: string) => {
    const raw = id.trim();
    return display?.trim() ?? labelFor?.(raw) ?? raw;
  });
}

/** Number of markers in a string. */
export function countMarkers(marked: string): number {
  return (marked.match(MARKER) ?? []).length;
}

/** Marker ids referenced in a string, in order, deduplicated. */
export function markerIds(marked: string): string[] {
  const ids: string[] = [];
  for (const m of marked.matchAll(MARKER)) {
    const id = (m[1] ?? "").trim();
    if (!ids.includes(id)) ids.push(id);
  }
  return ids;
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * Wrap the first occurrence of each term in the text with a marker, so the agent's
 * "hard words" become clickable exactly where they first appear. Longer terms go
 * first so "multi-head attention" wins over "attention". Existing markers are never
 * nested into. Returns the marked text and the terms that were placed.
 */
export function markTerms(text: string, terms: string[]): { text: string; placed: string[] } {
  let out = text;
  const placed: string[] = [];
  const clean = [...new Set(terms.map((t) => t.trim()).filter((t) => t && !/[\[\]|]/.test(t)))].sort((a, b) => b.length - a.length);
  for (const term of clean) {
    const re = new RegExp(`(^|[^\\w\\[|])(${escapeRe(term)})(?![\\w|\\]])`, "i");
    // skip matches that fall inside an existing marker
    let from = 0;
    let done = false;
    while (!done) {
      const m = re.exec(out.slice(from));
      if (!m) break;
      const start = from + m.index + m[1]!.length;
      const end = start + m[2]!.length;
      if (insideMarker(out, start)) {
        from = end;
        continue;
      }
      const matched = out.slice(start, end);
      const marker = matched === term ? `[[${matched}]]` : `[[${term}|${matched}]]`;
      out = out.slice(0, start) + marker + out.slice(end);
      placed.push(term);
      done = true;
    }
  }
  return { text: out, placed };
}

function insideMarker(text: string, index: number): boolean {
  const open = text.lastIndexOf("[[", index);
  if (open === -1) return false;
  const close = text.indexOf("]]", open);
  return close !== -1 && close >= index;
}

/** Shorten a phrase for use as a pane title. */
export function phraseLabel(text: string, max = 42): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max - 2)}…` : t;
}
