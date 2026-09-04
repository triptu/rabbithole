/**
 * Domain model shared by the sdk and the UI.
 *
 * Text fields marked "marked" may contain `[[term]]` or `[[id|display]]` markers.
 * See `content/markers.ts` for how they are parsed into clickable segments.
 */

// ---------------------------------------------------------------- documents

/** Where a document came from. */
export type DocumentSource = "demo" | "url" | "text" | "agent";

/**
 * A renderable unit of a document. Prose documents are just paragraphs; demo
 * documents also use richer blocks so code, diffs and lab tables read naturally.
 * Adding a new input type (PDF, PR, …) means adding a block here and a renderer in
 * `screens/reader/blocks.tsx`.
 */
export type Block =
  /** marked prose */
  | { type: "paragraph"; text: string }
  /** section heading inside a fetched or pasted document */
  | { type: "heading"; level: 1 | 2 | 3; text: string }
  /** monospace code. `//` comments are dimmed, comments may contain markers */
  | { type: "code"; lines: string[] }
  /** a unified diff hunk */
  | { type: "diff"; file: string; lines: DiffLine[] }
  /** WHAT / WHY / RISK style summary strip */
  | { type: "summary"; items: { k: string; text: string; tone?: "accent" | "warn" }[] }
  /** tabular results; cells are marked text, `mono` cells render monospace */
  | { type: "table"; columns: string[]; rows: TableRow[] }
  /** serif side note (e.g. a physician's note) */
  | { type: "note"; text: string }
  /** small grey hint under a block */
  | { type: "hint"; text: string };

export type DiffLine = { kind: "add" | "del" | "ctx" | "skip"; text: string };
export type TableCell = { text: string; mono?: boolean; muted?: boolean; flag?: boolean };
export type TableRow = TableCell[];

export interface Document {
  id: string;
  title: string;
  /** display url, no protocol */
  url: string;
  domain: string;
  /** one line source description shown above the title */
  meta: string;
  source: DocumentSource;
  blocks: Block[];
  /** number of marked terms — "6 terms decoded" */
  termCount: number;
  /** the agent has answered document.annotate for this text (even with zero terms) */
  annotated?: boolean;
  createdAt: number;
  /** last time it was opened in the reader; undefined = never (seeded but not visited) */
  openedAt?: number;
  bookmarked: boolean;
}

// ----------------------------------------------------------------- concepts

export interface Link {
  /** short kind badge: YT, READ, WIKI */
  k: string;
  /** title */
  t: string;
  /** href */
  u: string;
}

/** Anything the reader drilled into: a marked term, or a highlighted phrase. */
export interface Concept {
  id: string;
  docId: string;
  label: string;
  /** marked. The TL;DR. Empty while the agent is still answering. */
  short: string;
  /** marked. Demo concepts ship a canned elaboration; agent ones grow a thread instead. */
  long?: string;
  /** canned analogy shown with `long` */
  anec?: string | null;
  links: Link[];
  /** set when the concept was created from a highlighted phrase with a question */
  question?: string | null;
  source: "demo" | "agent";
  createdAt: number;
  /** last time a pane for it was opened; undefined = never. Drives history and recents. */
  openedAt?: number;
  bookmarked: boolean;
}

export interface ThreadMessage {
  id: string;
  /** the reader's question, null for a plain "Elaborate" */
  q: string | null;
  /** marked */
  text: string;
  anec: string | null;
  /** self-contained html rendered in a sandboxed iframe */
  html: string | null;
  createdAt: number;
}

/** The elaboration conversation under a concept pane. */
export interface Thread {
  conceptId: string;
  messages: ThreadMessage[];
}

/** Which panes were open on a document, so reopening it restores the trail. */
export interface Trail {
  docId: string;
  conceptIds: string[];
}

// ------------------------------------------------------------------- reader

export interface Profile {
  role: string;
  /** standing instructions */
  notes: string;
  /** explanation style chips */
  prefs: Record<string, boolean>;
  /** current reading goal */
  goal: string;
}

/** A note the agent (or the reader) wrote into the reader model. */
export interface ReaderNote {
  id: string;
  text: string;
  /** e.g. "agent · Sep 4" */
  source: string;
  createdAt: number;
}

// ------------------------------------------------------------------ session

export type PaneStatus = "loading" | "ready" | "error";

/** An open concept pane in the reader. */
export interface Pane {
  conceptId: string;
  status: PaneStatus;
  /** agent request that will fill it, while loading */
  requestId?: string;
  error?: string;
  startedAt: number;
  /** the "focus on…" input is open */
  focusOpen: boolean;
  /** an elaboration request is in flight */
  busy: boolean;
}

/** Progress of the "make it readable" stepper. */
export interface DocumentLoading {
  docId: string;
  /** 0 fetching · 1 finding terms · 2 tuning */
  step: 0 | 1 | 2;
  /** demo pages show a short simulated stepper; live ones wait for the agent */
  live: boolean;
  requestId?: string;
  startedAt: number;
}

/** A text selection the reader made inside a pane, awaiting a question. */
export interface Selection {
  text: string;
  /** pane index the selection came from; -1 = the article */
  fromIndex: number;
  x: number;
  y: number;
}

// -------------------------------------------------------------------- agent

export type RequestStatus = "queued" | "inflight" | "done" | "failed";

/** One page → agent event, as tracked for the UI. */
export interface AgentRequest {
  id: string;
  type: string;
  status: RequestStatus;
  createdAt: number;
  completedAt?: number;
  /** last handler error, if the agent's result was rejected */
  error?: string;
  attempt: number;
  /** what the event is about: a document id or a concept id */
  target?: string;
}

export interface AgentLogEntry {
  id: string;
  at: number;
  /** tool name or event type */
  name: string;
  /** compact args / result summary */
  detail: string;
  tone: "tool" | "event" | "error";
}

/**
 * How the page ↔ agent link looks right now.
 * unavailable: no WebMCP in this browser · idle: tools registered, nobody polling yet ·
 * polling: an agent is in the await_event loop · disconnected: it was, and stopped.
 */
export type LinkStatus = "unavailable" | "idle" | "polling" | "disconnected";

export interface ToolInfo {
  name: string;
  description: string;
}
