/**
 * Reader use-cases — the verbs the UI calls.
 *
 * Everything the app does is here: opening documents, sliding panes in and out,
 * asking about a highlight, elaborating, bookmarks, goal, profile. Local work mutates
 * the store directly; anything that needs a model is queued on the `agent`, and the
 * matching `agent.on(...)` handler at the bottom applies the result when it arrives.
 *
 * No React, no DOM measurements. UI-only effects (scrolling to a pane) are expressed
 * as state (`session.reveal`) and performed by the UI.
 */
import type { Agent } from "./agent/agent";
import type { ReaderContext } from "./agent/events";
import { parseAnalyzeResult, parseElaborateResult, parseShortResult } from "./agent/events";
import { displayUrl, domainOf, fetchUrlMarkdown, looksLikeUrl, normalizeUrl } from "./content/fetch";
import { countMarkers, phraseLabel, scopedId, slug, strip } from "./content/markers";
import { newId, profileText, type Mutators, type Store } from "./store";
import type { Block, Concept, Document, Pane, Profile, Selection } from "./types";

/** demo documents show a short simulated "make it readable" stepper */
export const DEMO_STEP_MS = 450;
/** demo concepts shimmer briefly before their canned explanation appears */
export const DEMO_EXPLAIN_MS = 900;
const TOAST_MS = 5000;

export interface ReaderDeps {
  store: Store;
  mutators: Mutators;
  agent: Agent;
  /** injectable for tests */
  fetchText?: (url: string) => Promise<string>;
}

export type Reader = ReturnType<typeof createReader>;

/** Plain text of a block, markers stripped. */
export function blockText(block: Block, labelFor?: (id: string) => string | undefined): string {
  switch (block.type) {
    case "paragraph":
    case "note":
    case "hint":
      return strip(block.text, labelFor);
    case "code":
      return strip(block.lines.join("\n"), labelFor);
    case "diff":
      return `${block.file}\n${block.lines.map((l) => strip(l.text, labelFor)).join("\n")}`;
    case "summary":
      return block.items.map((i) => `${i.k}: ${strip(i.text, labelFor)}`).join("\n");
    case "table":
      return [block.columns.join(" | "), ...block.rows.map((r) => r.map((c) => strip(c.text, labelFor)).join(" | "))].join("\n");
  }
}

export function documentText(doc: Document, labelFor?: (id: string) => string | undefined): string {
  return doc.blocks.map((b) => blockText(b, labelFor)).join("\n\n");
}

/** Map well known demo inputs to their demo document, like the prototype did. */
export function guessDemo(input: string): string | null {
  const v = input.toLowerCase();
  if (v.includes("1706.03762") || v.includes("attention is all")) return "tx";
  if (v.includes("crispr")) return "cr";
  if (v.includes("byzantine")) return "bft";
  return null;
}

export function createReader({ store, mutators: m, agent, fetchText = fetchUrlMarkdown }: ReaderDeps) {
  const get = store.getState;
  const timers = new Set<ReturnType<typeof setTimeout>>();
  const after = (ms: number, fn: () => void) => {
    const t = setTimeout(() => {
      timers.delete(t);
      fn();
    }, ms);
    timers.add(t);
  };
  const clearTimers = () => {
    for (const t of timers) clearTimeout(t);
    timers.clear();
  };

  const labelFor = (id: string) => get().library.concepts[id]?.label;

  const readerContext = (): ReaderContext => {
    const s = get();
    return { profile: profileText(s.profile), goal: s.profile.goal, notes: s.notes.map((n) => n.text) };
  };

  /** fallback context for a term when the UI did not pass the surrounding block */
  const contextFor = (doc: Document | undefined): string => {
    if (!doc) return "";
    const first = doc.blocks.find((b) => b.type === "paragraph");
    return `${doc.title}: ${first ? blockText(first, labelFor) : ""}`.slice(0, 800);
  };

  const loadingPane = (conceptId: string, requestId?: string): Pane => ({
    conceptId,
    status: "loading",
    requestId,
    startedAt: Date.now(),
    focusOpen: false,
    busy: false,
  });
  const readyPane = (conceptId: string): Pane => ({ ...loadingPane(conceptId), status: "ready" });

  let toastTimer: ReturnType<typeof setTimeout> | null = null;
  function toast(message: string | null) {
    if (toastTimer) clearTimeout(toastTimer);
    m.setToast(message);
    if (message) toastTimer = setTimeout(() => m.setToast(null), TOAST_MS);
  }

  // ============================================================== documents

  /**
   * The home page's "make it readable": a url, pasted text, or a demo shortcut.
   * Returns the document id the UI should navigate to (the document may still be
   * loading), or null when nothing was submitted.
   */
  async function openInput(raw: string): Promise<string | null> {
    const value = raw.trim();
    if (!value) return null;
    const demo = guessDemo(value);
    if (demo && get().library.documents[demo]) {
      open(demo);
      return demo;
    }

    const isUrl = looksLikeUrl(value);
    const url = isUrl ? normalizeUrl(value) : null;
    const docId = newId("d");
    const startedAt = Date.now();

    clearTimers();
    m.setSession({ docId, panes: [], selection: null, reveal: null });
    m.setLoading({ docId, step: 0, live: true, startedAt });

    let text = isUrl ? "" : value;
    if (url) {
      try {
        text = await fetchText(url);
      } catch {
        // the agent can fetch it itself; payload.text stays empty
      }
    }
    // the reader moved on while we were fetching
    if (get().session.loading?.docId !== docId) return docId;

    const requestId = agent.queue({
      type: "document.analyze",
      payload: { docId, url, text, reader: readerContext() },
    });
    m.setLoading({ docId, step: 1, live: true, startedAt, requestId });
    return docId;
  }

  /** Open a document that exists in the library. */
  function open(docId: string, opts: { conceptId?: string; force?: boolean } = {}): boolean {
    const s = get();
    const doc = s.library.documents[docId];
    if (!doc) {
      if (s.session.loading?.docId === docId) return true; // still being analyzed
      toast("That page isn’t in your library.");
      return false;
    }
    // already current (possibly still in its stepper): never restart it — the reader
    // route calls open() on mount, right after a click already opened the document
    if (s.session.docId === docId && !opts.force) {
      if (opts.conceptId && !s.session.loading) openConcept({ conceptId: opts.conceptId, label: labelFor(opts.conceptId) ?? opts.conceptId });
      return true;
    }

    clearTimers();
    m.patchDocument(docId, { openedAt: Date.now() });
    m.setSession({ docId, panes: [], selection: null, reveal: null });

    const restore = () => {
      const trail = (get().library.trails[docId] ?? []).filter((id) => get().library.concepts[id]);
      if (opts.conceptId) {
        openConcept({ conceptId: opts.conceptId, label: labelFor(opts.conceptId) ?? opts.conceptId });
      } else if (trail.length) {
        m.setPanes(trail.map(readyPane));
        m.reveal(trail.length - 1);
      }
    };

    if (doc.source === "demo") {
      const startedAt = Date.now();
      m.setLoading({ docId, step: 0, live: false, startedAt });
      after(DEMO_STEP_MS, () => m.setLoading((l) => (l?.docId === docId ? { ...l, step: 1 } : l)));
      after(DEMO_STEP_MS * 2, () => m.setLoading((l) => (l?.docId === docId ? { ...l, step: 2 } : l)));
      after(DEMO_STEP_MS * 3, () => {
        if (get().session.loading?.docId !== docId) return;
        m.setLoading(null);
        restore();
      });
    } else {
      m.setLoading(null);
      restore();
    }
    return true;
  }

  /** Leave the reader (home). Panes are already remembered in the trail. */
  function close() {
    clearTimers();
    tourId++;
    m.setSession({ docId: null, panes: [], loading: null, selection: null, reveal: null, say: null });
  }

  // ================================================================== panes

  /**
   * Open a concept pane to the right of `fromIndex` (-1 = the article). Panes further
   * right are closed, like following a link in a sliding-pane wiki. If the pane is
   * already open it is revealed (or re-seated next to its source) instead.
   */
  function openConcept(args: { conceptId: string; label: string; fromIndex?: number; context?: string }) {
    const { conceptId, label, fromIndex = -1, context } = args;
    const s = get();
    const panes = s.session.panes;
    const existing = panes.findIndex((p) => p.conceptId === conceptId);
    if (existing !== -1) {
      if (existing <= fromIndex + 1) {
        m.reveal(existing);
        return;
      }
      const pane = panes[existing]!;
      m.setPanes([...panes.slice(0, fromIndex + 1), pane]);
      m.reveal(fromIndex + 1);
      return;
    }

    const base = panes.slice(0, fromIndex + 1);
    const now = Date.now();
    const known = s.library.concepts[conceptId];

    if (known?.short) {
      // already explained: demo concepts shimmer briefly, agent ones appear at once
      const demo = known.source === "demo";
      m.patchConcept(conceptId, { openedAt: now });
      m.setPanes([...base, demo ? loadingPane(conceptId) : readyPane(conceptId)]);
      m.reveal(base.length);
      if (demo) after(DEMO_EXPLAIN_MS, () => m.patchPane(conceptId, { status: "ready" }));
      return;
    }

    const docId = s.session.docId;
    if (!docId) return;
    const doc = s.library.documents[docId];
    const concept: Concept = known ?? {
      id: conceptId,
      docId,
      label,
      short: "",
      links: [],
      source: "agent",
      createdAt: now,
      openedAt: now,
      bookmarked: false,
    };
    m.putConcept(concept, false); // persisted once the agent answers
    const requestId = agent.queue({
      type: "concept.explain",
      payload: {
        docId,
        conceptId,
        term: label,
        documentTitle: doc?.title ?? "",
        context: (context ?? contextFor(doc)).slice(0, 800),
        reader: readerContext(),
      },
    });
    m.setPanes([...base, loadingPane(conceptId, requestId)]);
    m.reveal(base.length);
  }

  /** Close this pane and everything to its right. */
  function popTo(index: number) {
    m.setSelection(null);
    m.setPanes((panes) => panes.slice(0, Math.max(0, index)));
  }
  function popLast() {
    popTo(get().session.panes.length - 1);
  }

  function setFocusOpen(index: number, focusOpen: boolean) {
    const pane = get().session.panes[index];
    if (pane) m.patchPane(pane.conceptId, { focusOpen });
  }

  /** Re-ask the agent for a pane that ended in an error. */
  function retry(index: number) {
    const s = get();
    const pane = s.session.panes[index];
    const c = pane && s.library.concepts[pane.conceptId];
    const docId = s.session.docId;
    if (!pane || !c || !docId) return;
    const doc = s.library.documents[docId];
    const reader = readerContext();
    const requestId =
      c.question !== undefined
        ? agent.queue({
            type: "selection.ask",
            payload: {
              docId,
              conceptId: c.id,
              phrase: c.label.replace(/^“|”$/g, ""),
              question: c.question,
              documentTitle: doc?.title ?? "",
              context: contextFor(doc),
              reader,
            },
          })
        : agent.queue({
            type: "concept.explain",
            payload: { docId, conceptId: c.id, term: c.label, documentTitle: doc?.title ?? "", context: contextFor(doc), reader },
          });
    m.patchPane(c.id, { status: "loading", requestId, error: undefined, startedAt: Date.now() });
  }

  /**
   * "Elaborate" / a follow-up question under a concept. The first plain Elaborate on
   * a demo concept comes from canned data; everything else is a running thread with
   * the agent.
   */
  function elaborate(index: number, question?: string) {
    const s = get();
    const pane = s.session.panes[index];
    if (!pane || pane.busy) return;
    const c = s.library.concepts[pane.conceptId];
    if (!c) return;
    const thread = s.library.threads[c.id]?.messages ?? [];
    const q = question?.trim() || null;
    m.patchPane(c.id, { busy: true, focusOpen: false });

    if (!q && thread.length === 0 && c.source === "demo" && c.long) {
      const text = c.long;
      after(DEMO_EXPLAIN_MS, () => {
        m.pushThreadMessage(c.id, { id: newId("m"), q: null, text, anec: c.anec ?? null, html: null, createdAt: Date.now() });
        m.patchPane(c.id, { busy: false });
      });
      return;
    }

    agent.queue({
      type: "concept.elaborate",
      payload: {
        docId: c.docId,
        conceptId: c.id,
        term: c.label,
        base: strip(`${c.short}${c.long ? ` ${c.long}` : ""}`, labelFor).slice(0, 900),
        history: thread.slice(-4).map((t) => ({ q: t.q, text: strip(t.text, labelFor) })),
        question: q,
        reader: readerContext(),
      },
    });
  }

  // ============================================================== selection

  /** The UI measured a selection inside a pane; remember it so the popover can show. */
  function select(selection: Selection | null) {
    m.setSelection(selection);
  }

  /** Turn the current selection (+ optional question) into a new pane. */
  function ask(question?: string) {
    const s = get();
    const sel = s.session.selection;
    const docId = s.session.docId;
    if (!sel || !docId) return;
    const doc = s.library.documents[docId];
    const from = sel.fromIndex;
    const sourcePane = from >= 0 ? s.session.panes[from] : undefined;
    const sourceConcept = sourcePane ? s.library.concepts[sourcePane.conceptId] : undefined;
    const context = (sourceConcept?.short ? strip(sourceConcept.short, labelFor) : contextFor(doc)).slice(0, 800);
    const now = Date.now();
    const conceptId = scopedId(docId, `q${now.toString(36)}`);
    const q = question?.trim() || null;

    m.putConcept(
      {
        id: conceptId,
        docId,
        label: `“${phraseLabel(sel.text)}”`,
        short: "",
        links: [],
        question: q,
        source: "agent",
        createdAt: now,
        openedAt: now,
        bookmarked: false,
      },
      false,
    );
    const requestId = agent.queue({
      type: "selection.ask",
      payload: { docId, conceptId, phrase: sel.text.slice(0, 600), question: q, documentTitle: doc?.title ?? "", context, reader: readerContext() },
    });
    m.setSelection(null);
    const base = s.session.panes.slice(0, from + 1);
    m.setPanes([...base, loadingPane(conceptId, requestId)]);
    m.reveal(base.length);
  }

  // ============================================================ shared trails
  // A trail travels as a url: `/#trail=<base64 {src, terms}>`. Whoever opens it gets
  // the same document and the same panes, explained by *their* agent for *their* profile.

  function shareLink(): string | null {
    const s = get();
    const doc = s.session.docId ? s.library.documents[s.session.docId] : undefined;
    if (!doc) return null;
    const terms = s.session.panes.map((p) => s.library.concepts[p.conceptId]?.label).filter((t): t is string => !!t);
    const src = doc.source === "demo" ? doc.id : doc.url;
    const payload = btoa(unescape(encodeURIComponent(JSON.stringify({ src, terms }))));
    const origin = typeof location !== "undefined" ? location.origin : "";
    return `${origin}/#trail=${payload}`;
  }

  /** resolve a term from a shared link to a concept on the current document */
  function findTerm(term: string): { conceptId: string; label: string } {
    const t = term.trim().toLowerCase();
    const s = get();
    for (const c of Object.values(s.library.concepts)) {
      if (c.label.toLowerCase() === t && (c.source === "demo" || c.docId === s.session.docId)) return { conceptId: c.id, label: c.label };
    }
    return { conceptId: s.session.docId ? scopedId(s.session.docId, term) : slug(term), label: term.trim() };
  }

  const waitPaneReady = (conceptId: string) =>
    new Promise<void>((resolve) => {
      const check = () => {
        const pane = get().session.panes.find((p) => p.conceptId === conceptId);
        return !pane || pane.status !== "loading";
      };
      if (check()) return resolve();
      const unsub = store.subscribe(() => {
        if (check()) {
          unsub();
          resolve();
        }
      });
    });

  let tourId = 0;
  /** open the trail's terms one after another, narrating each step */
  async function runTour(terms: string[]) {
    const id = ++tourId;
    for (let i = 0; i < terms.length; i++) {
      if (tourId !== id) return;
      const { conceptId, label } = findTerm(terms[i]!);
      m.setSession({ say: { text: `Retracing a shared trail: ${label}`, step: { i: i + 1, n: terms.length } } });
      const from = get().session.panes.length - 1;
      openConcept({ conceptId, label, fromIndex: i === 0 ? -1 : from });
      await waitPaneReady(conceptId);
      await new Promise((r) => setTimeout(r, 2600));
    }
    if (tourId !== id) return;
    m.setSession({ say: { text: "That’s the trail. Ask me anything about it, or highlight a phrase." } });
    after(3600, () => tourId === id && m.setSession({ say: null }));
  }
  function stopTour() {
    tourId++;
    m.setSession({ say: null });
  }

  /** open a `#trail=` link. Returns the document id to navigate to, or null. */
  async function openSharedTrail(hash: string): Promise<string | null> {
    const match = hash.match(/#trail=([^&]+)/);
    if (!match) return null;
    let trail: { src?: string; terms?: string[] };
    try {
      trail = JSON.parse(decodeURIComponent(escape(atob(match[1]!))));
    } catch {
      toast("That shared link didn’t parse.");
      return null;
    }
    const terms = Array.isArray(trail.terms) ? trail.terms.filter((t): t is string => typeof t === "string") : [];
    const src = String(trail.src ?? "");
    if (!src) return null;
    let docId: string | null;
    if (get().library.documents[src]) {
      open(src);
      docId = src;
    } else {
      docId = await openInput(src);
    }
    if (!docId) return null;
    // start once the document is readable
    const begin = async () => {
      await new Promise<void>((resolve) => {
        const ready = () => !get().session.loading && !!get().library.documents[docId!];
        if (ready()) return resolve();
        const unsub = store.subscribe(() => {
          if (ready()) {
            unsub();
            resolve();
          }
        });
      });
      after(1200, () => void runTour(terms));
    };
    void begin();
    return docId;
  }

  /**
   * "Watch the agent read with me": the prototype's scripted walkthrough. Opens the lab
   * results and narrates what a linked agent would do — set a goal, answer a click,
   * write a note into the reader model — using the real verbs, so the profile and
   * history really change.
   */
  function demoRun() {
    const id = ++tourId;
    const alive = () => tourId === id;
    const say = (text: string) => alive() && m.setSession({ say: { text } });
    const call = (name: string, detail = "") => alive() && m.log({ name, detail, tone: "tool" });

    m.setSession({ drawerOpen: true });
    call("rabbithole_open", '{"input":"portal.quest.example/results/8841"}');
    open("lab");
    say("Opening your blood results in Rabbithole. Click anything you don’t recognise — I’ll explain it for you, not from a pamphlet.");
    after(2000, () => {
      call("rabbithole_get_state");
      const goal = "know what to change before my follow-up in 3 months";
      call("rabbithole_set_goal", JSON.stringify({ goal }));
      if (alive()) setGoal(goal);
    });
    after(4000, () => {
      say("You clicked HbA1c — working on it.");
      if (alive()) openConcept({ conceptId: "hba1c", label: "HbA1c" });
    });
    after(6300, () => say("Since your goal is the follow-up: A1c and triglycerides usually move together. Want the triglycerides row next?"));
    after(9000, () => {
      const note = "reads lab results with a specific follow-up date in mind — lead with what is actionable";
      call("rabbithole_remember", JSON.stringify({ notes: [note] }));
      if (alive()) remember([note], "agent");
    });
    after(12600, () => alive() && m.setSession({ say: null }));
  }

  // ================================================== bookmarks · goal · profile

  function toggleDocumentBookmark(docId: string) {
    m.toggleDocumentBookmark(docId);
  }
  function toggleConceptBookmark(conceptId: string) {
    m.toggleConceptBookmark(conceptId);
  }
  function setGoal(goal: string) {
    m.setProfile({ goal });
  }
  function saveProfile(patch: Partial<Pick<Profile, "role" | "notes" | "prefs">>) {
    m.setProfile(patch);
  }
  /** Append to the reader model. `source` is who wrote it, e.g. "agent". */
  function remember(notes: string[], source = "agent") {
    const stamp = new Date().toLocaleDateString(undefined, { month: "short", day: "numeric" });
    m.addNotes(notes, `${source} · ${stamp}`);
  }
  function clearNotes() {
    m.setNotes([]);
  }

  // ======================================================= agent → page results

  /** shared by concept.explain and selection.ask */
  function applyShort(conceptId: string, fallback: Omit<Concept, "id" | "short" | "links">, short: string, links: Concept["links"]) {
    const now = Date.now();
    const existing = get().library.concepts[conceptId];
    const concept: Concept = existing
      ? { ...existing, short, links, openedAt: now }
      : { ...fallback, id: conceptId, short, links, openedAt: now };
    m.putConcept(concept);
    m.patchPane(conceptId, { status: "ready", requestId: undefined, error: undefined });
  }

  /** after this many rejected results a pane shows the error instead of a shimmer */
  const ERROR_AFTER_ATTEMPTS = 3;
  const failPane = (conceptId: string, attempt: number, error: string) => {
    if (attempt >= ERROR_AFTER_ATTEMPTS) m.patchPane(conceptId, { status: "error", error });
  };

  agent.on("document.analyze", ({ event, result }) => {
    const p = event.payload;
    const r = parseAnalyzeResult(result);
    const url = p.url ? displayUrl(p.url) : "pasted text";
    const domain = p.url ? domainOf(p.url) : "pasted text";
    const now = Date.now();
    const prev = get().library.documents[p.docId];
    m.putDocument({
      id: p.docId,
      title: r.title,
      url,
      domain,
      meta: r.meta || domain,
      source: p.url ? "url" : "text",
      blocks: r.paragraphs.map((text) => ({ type: "paragraph", text })),
      termCount: countMarkers(r.paragraphs.join(" ")),
      createdAt: prev?.createdAt ?? now,
      openedAt: now,
      bookmarked: prev?.bookmarked ?? false,
    });
    if (get().session.loading?.docId === p.docId) m.setLoading(null);
  });

  agent.on("concept.explain", ({ event, result }) => {
    const p = event.payload;
    try {
      const r = parseShortResult(result, "concept.explain");
      applyShort(
        p.conceptId,
        { docId: p.docId, label: p.term, source: "agent", createdAt: Date.now(), openedAt: Date.now(), bookmarked: false },
        r.short,
        r.links,
      );
    } catch (e) {
      failPane(p.conceptId, event.attempt, (e as Error).message);
      throw e;
    }
  });

  agent.on("selection.ask", ({ event, result }) => {
    const p = event.payload;
    try {
      const r = parseShortResult(result, "selection.ask");
      applyShort(
        p.conceptId,
        {
          docId: p.docId,
          label: `“${phraseLabel(p.phrase)}”`,
          question: p.question,
          source: "agent",
          createdAt: Date.now(),
          openedAt: Date.now(),
          bookmarked: false,
        },
        r.short,
        r.links,
      );
    } catch (e) {
      failPane(p.conceptId, event.attempt, (e as Error).message);
      throw e;
    }
  });

  agent.on("concept.elaborate", ({ event, result }) => {
    const p = event.payload;
    try {
      const r = parseElaborateResult(result);
      const thread = get().library.threads[p.conceptId];
      // message id = event id, so a redelivered completion can never duplicate a turn
      if (!thread?.messages.some((t) => t.id === event.id)) {
        m.pushThreadMessage(p.conceptId, { id: event.id, q: p.question, text: r.text, anec: r.anec, html: r.html, createdAt: Date.now() });
      }
    } finally {
      m.patchPane(p.conceptId, { busy: false });
    }
  });

  return {
    // documents
    openInput,
    open,
    close,
    guessDemo,
    // panes
    openConcept,
    popTo,
    popLast,
    setFocusOpen,
    retry,
    elaborate,
    // selection
    select,
    ask,
    // shared trails · demo
    shareLink,
    openSharedTrail,
    stopTour,
    demoRun,
    setDrawerOpen: (drawerOpen: boolean) => m.setSession({ drawerOpen }),
    // reader
    toggleDocumentBookmark,
    toggleConceptBookmark,
    setGoal,
    saveProfile,
    remember,
    clearNotes,
    toast,
    // context helpers (also used by tools)
    readerContext,
    documentText: (doc: Document) => documentText(doc, labelFor),
    labelFor,
    dispose: clearTimers,
  };
}
