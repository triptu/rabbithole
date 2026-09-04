/**
 * Agent → page tools. Deliberately few: the human drives the reading; the agent
 * fetches the protocol, learns who it is explaining to (get/update_reader), sees what
 * they see, and opens things for them. Everything the page needs *from* the agent
 * travels the other way as events (see events.ts).
 */
import { strip } from "../content/markers";
import { normalizeTerms } from "./events";
import type { Reader } from "../reader";
import type { Store } from "../store";
import type { PageTool } from "./agent";
import { TOOL_PREFIX } from "./names";

const S = { type: "string" } as const;
const T = (name: string) => `${TOOL_PREFIX}_${name}`;

export function buildTools({ reader, store, protocol }: { reader: Reader; store: Store; protocol: () => string }): PageTool[] {
  return [
    {
      name: T("get_protocol"),
      description: "Read this first: how to work with the reader through Rabbithole — the event loop, the event types and result shapes, and the other tools.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => protocol(),
    },
    {
      name: T("get_state"),
      description:
        "What the reader is looking at right now: the document text, the open concept panes (their trail, in order), reading goal, profile and the notes you have written about them.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = store.getState();
        const doc = s.session.docId ? s.library.documents[s.session.docId] : undefined;
        return {
          document: doc ? { id: doc.id, title: doc.title, url: doc.url, text: reader.documentText(doc) } : null,
          loading: s.session.loading ? { docId: s.session.loading.docId } : null,
          trail: s.session.panes.map((p, index) => {
            const c = s.library.concepts[p.conceptId];
            const thread = s.library.threads[p.conceptId]?.messages ?? [];
            return {
              index,
              term: c?.label ?? p.conceptId,
              status: p.status,
              text: strip([c?.short ?? "", ...thread.map((t) => t.text)].join(" "), reader.labelFor).trim(),
            };
          }),
          ...reader.readerContext(),
          pending_events: s.agent.stats.queued + s.agent.stats.inflight,
        };
      },
    },
    {
      name: T("open"),
      description:
        "Open something in the reader. Either a url (the page fetches it and then hands you a document.annotate event for the hard terms), or your own text — an explanation you wrote, a concept, anything — with a title and, optionally, the terms to highlight so no round trip is needed.",
      inputSchema: {
        type: "object",
        properties: {
          url: { ...S, description: "a web page to read verbatim" },
          title: { ...S, description: "title for text you provide" },
          text: { ...S, description: "the text to read, verbatim; paragraphs separated by blank lines, markdown headings allowed" },
          terms: {
            type: "array",
            items: {
              anyOf: [S, { type: "object", properties: { term: S, short: S, links: { type: "array" } }, required: ["term"], additionalProperties: false }],
            },
            description: "phrases from text to highlight, each with a 1–2 sentence short so clicks are instant; omit to be asked via document.annotate",
          },
        },
        additionalProperties: false,
      },
      execute: async (input) => {
        const url = typeof input.url === "string" ? input.url.trim() : "";
        const text = typeof input.text === "string" ? input.text.trim() : "";
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const terms = Array.isArray(input.terms) ? normalizeTerms(input.terms) : undefined;
        if (!url && !text) return { ok: false, error: "pass url or text" };
        const docId = url ? await reader.openInput(url) : reader.openText({ title, text, terms });
        if (!docId) return { ok: false, error: "nothing to open" };
        const doc = store.getState().library.documents[docId];
        return doc?.annotated
          ? { ok: true, docId, title: doc.title, status: "ready" }
          : { ok: true, docId, status: "open", next: "a document.annotate event is waiting — await it and reply with the terms" };
      },
    },
    {
      name: T("get_reader"),
      description:
        "Who you are explaining to: role and field, how they like things explained (preferences), standing instructions, the current reading goal, and the notes you wrote about them before. Read this first; if you know this person better than it does, fix it with rabbithole_update_reader.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: () => {
        const s = store.getState();
        return {
          role: s.profile.role,
          preferences: Object.entries(s.profile.prefs).filter(([, on]) => on).map(([k]) => k),
          instructions: s.profile.notes,
          goal: s.profile.goal,
          notes: s.notes.map((n) => ({ text: n.text, source: n.source })),
        };
      },
    },
    {
      name: T("update_reader"),
      description:
        "Shape every future explanation. Set any of: role (what they do and know), preferences (how to explain — e.g. code analogies, concrete first), instructions (standing rules in their words), goal (why they are reading right now), notes (short durable facts you learned about how this reader reads). Omitted fields are kept.",
      inputSchema: {
        type: "object",
        properties: {
          role: { ...S, description: "e.g. 'Software engineer — distributed systems, TypeScript'" },
          preferences: { type: "array", items: S, description: "explanation styles to turn on; unknown ones are added" },
          instructions: { ...S, description: "standing instructions, replaces the previous text" },
          goal: { ...S, description: "current reading goal; empty string clears it" },
          notes: { type: "array", items: S, description: "appended to what you already know about this reader" },
        },
        additionalProperties: false,
      },
      execute: (input) => {
        const str = (k: string) => (typeof input[k] === "string" ? (input[k] as string).trim() : undefined);
        const list = (k: string) => (Array.isArray(input[k]) ? (input[k] as unknown[]).map(String).map((x) => x.trim()).filter(Boolean) : undefined);
        reader.updateReader({ role: str("role"), preferences: list("preferences"), instructions: str("instructions"), goal: str("goal"), notes: list("notes") });
        const s = store.getState();
        return { ok: true, role: s.profile.role, goal: s.profile.goal, notes: s.notes.length };
      },
    },
  ];
}
