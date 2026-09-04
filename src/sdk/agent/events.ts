/**
 * The page → agent event contract.
 *
 * Every event carries `reader` (profile prose, goal, notes) so the agent can
 * personalize without a second tool call, and `reminder` — one line saying what to
 * return — so an agent that lost the protocol still answers correctly. Results are
 * validated here; a handler that throws makes the channel answer `retry` with the
 * error message.
 */
import type { Link } from "../types";

export interface ReaderContext {
  /** one line: role, preferences, standing instructions, goal */
  profile: string;
  goal: string;
  /** notes the agent has written about the reader so far */
  notes: string[];
}

/** The reader is looking at this text verbatim; which words will they stumble on? */
export interface AnnotatePayload {
  docId: string;
  title: string;
  /** the document text, as the reader sees it (capped) */
  text: string;
  reader: ReaderContext;
}
/**
 * A term to highlight. With `short` the pane opens instantly on click; without it the
 * page asks concept.explain when the reader clicks.
 */
export interface AnnotatedTerm {
  /** exact phrase from the text; its first occurrence gets highlighted */
  term: string;
  /** marked, 1–2 sentences for this reader */
  short?: string;
  links?: Link[];
}
export interface AnnotateResult {
  terms: AnnotatedTerm[];
  /** optional better title, e.g. for pasted text */
  title?: string;
}

export interface ExplainPayload {
  docId: string;
  conceptId: string;
  term: string;
  documentTitle: string;
  /** the sentence/paragraph the term sits in */
  context: string;
  reader: ReaderContext;
}
export interface AskPayload {
  docId: string;
  conceptId: string;
  phrase: string;
  question: string | null;
  documentTitle: string;
  context: string;
  reader: ReaderContext;
}
export interface ShortResult {
  /** marked, 2–4 sentences */
  short: string;
  links: Link[];
}

export interface ElaboratePayload {
  docId: string;
  conceptId: string;
  term: string;
  /** what the reader has already read about it */
  base: string;
  /** recent turns, oldest first */
  history: { q: string | null; text: string }[];
  question: string | null;
  reader: ReaderContext;
}
export interface ElaborateResult {
  text: string;
  anec: string | null;
  html: string | null;
}

export type AgentEvent =
  | { type: "document.annotate"; payload: AnnotatePayload }
  | { type: "concept.explain"; payload: ExplainPayload }
  | { type: "selection.ask"; payload: AskPayload }
  | { type: "concept.elaborate"; payload: ElaboratePayload };

export type AgentEventType = AgentEvent["type"];

export type ResultFor<T extends AgentEventType> = T extends "document.annotate"
  ? AnnotateResult
  : T extends "concept.elaborate"
    ? ElaborateResult
    : ShortResult;

export type PayloadFor<T extends AgentEventType> = Extract<AgentEvent, { type: T }>["payload"];

/** what the agent receives: the payload plus the one-line reminder */
export type Delivered<T extends AgentEventType> = PayloadFor<T> & { reminder: string };

// ------------------------------------------------------------------ validation

/** Agents sometimes hand back a JSON string instead of an object. */
function asObject(result: unknown, what: string): Record<string, unknown> {
  let value = result;
  if (typeof value === "string") {
    const m = value.match(/\{[\s\S]*\}/);
    if (!m) throw new Error(`${what}: result must be a JSON object`);
    value = JSON.parse(m[0]);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${what}: result must be an object`);
  }
  return value as Record<string, unknown>;
}

function str(o: Record<string, unknown>, key: string, what: string): string {
  const v = o[key];
  if (typeof v !== "string" || !v.trim()) throw new Error(`${what}: "${key}" must be a non-empty string`);
  return v.trim();
}
function optStr(o: Record<string, unknown>, key: string): string | null {
  const v = o[key];
  return typeof v === "string" && v.trim() ? v : null;
}

const SEARCH: Record<string, string> = {
  YT: "https://www.youtube.com/results?search_query=",
  WIKI: "https://en.wikipedia.org/w/index.php?search=",
};

/** Accepts `{k,t,q}` (a search) or `{k,t,u}` (a url); at most three. */
export function normalizeLinks(raw: unknown): Link[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((l): l is Record<string, unknown> => !!l && typeof l === "object")
    .slice(0, 3)
    .map((l) => {
      const k = typeof l.k === "string" && l.k.trim() ? l.k.trim().toUpperCase() : "READ";
      const q = typeof l.q === "string" ? l.q : "";
      const t = typeof l.t === "string" && l.t.trim() ? l.t.trim() : q;
      const u =
        typeof l.u === "string" && /^https?:\/\//.test(l.u)
          ? l.u
          : `${SEARCH[k] ?? "https://www.google.com/search?q="}${encodeURIComponent(q || t)}`;
      return { k, t, u };
    })
    .filter((l) => l.t);
}

/** Accepts `"term"` or `{ term, short?, links? }` entries. */
export function normalizeTerms(raw: unknown): AnnotatedTerm[] {
  if (!Array.isArray(raw)) return [];
  const out: AnnotatedTerm[] = [];
  for (const t of raw) {
    if (typeof t === "string") {
      if (t.trim()) out.push({ term: t.trim() });
    } else if (t && typeof t === "object") {
      const o = t as Record<string, unknown>;
      const term = typeof o.term === "string" ? o.term.trim() : "";
      if (!term) continue;
      const short = optStr(o, "short");
      out.push({ term, ...(short ? { short: short.trim() } : {}), ...(o.links ? { links: normalizeLinks(o.links) } : {}) });
    }
  }
  return out.slice(0, 40);
}

export function parseAnnotateResult(result: unknown): AnnotateResult {
  const o = asObject(result, "document.annotate");
  if (!Array.isArray(o.terms)) throw new Error('document.annotate: "terms" must be an array of { term, short? } or strings');
  const title = optStr(o, "title");
  return { terms: normalizeTerms(o.terms), ...(title ? { title } : {}) };
}

export function parseShortResult(result: unknown, what = "concept.explain"): ShortResult {
  const o = asObject(result, what);
  return { short: str(o, "short", what), links: normalizeLinks(o.links) };
}

export function parseElaborateResult(result: unknown): ElaborateResult {
  const o = asObject(result, "concept.elaborate");
  return {
    text: str(o, "text", "concept.elaborate"),
    anec: optStr(o, "anec"),
    html: optStr(o, "html"),
  };
}
