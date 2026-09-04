/**
 * Agent → page tools. Deliberately few: the human drives the reading; the agent
 * fetches the protocol, sees what they see, opens things for them, and remembers
 * them. Everything the page needs *from* the agent travels the other way as events
 * (see events.ts).
 */
import { strip } from "../content/markers";
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
          terms: { type: "array", items: S, description: "exact phrases from text to highlight; omit to be asked via document.annotate" },
        },
        additionalProperties: false,
      },
      execute: async (input) => {
        const url = typeof input.url === "string" ? input.url.trim() : "";
        const text = typeof input.text === "string" ? input.text.trim() : "";
        const title = typeof input.title === "string" ? input.title.trim() : "";
        const terms = Array.isArray(input.terms) ? input.terms.map(String) : undefined;
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
      name: T("set_goal"),
      description: "Set the reader’s current reading goal. Every explanation is tuned to it.",
      inputSchema: { type: "object", properties: { goal: S }, required: ["goal"], additionalProperties: false },
      execute: (input) => {
        const goal = String(input.goal ?? "").trim();
        reader.setGoal(goal);
        return { ok: true, goal };
      },
    },
    {
      name: T("remember"),
      description:
        "Record what you learned about the reader — things they already know, things they struggled with, how they like things explained. Persists across sessions and shapes every future explanation.",
      inputSchema: {
        type: "object",
        properties: { notes: { type: "array", items: S, description: "short notes, one fact each" } },
        required: ["notes"],
        additionalProperties: false,
      },
      execute: (input) => {
        const notes = Array.isArray(input.notes) ? input.notes.map(String).filter(Boolean) : [];
        reader.remember(notes, "agent");
        return { ok: true, remembered: notes.length, total: store.getState().notes.length };
      },
    },
  ];
}
