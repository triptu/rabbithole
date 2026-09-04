/**
 * End-to-end sdk flow with a fake WebMCP modelContext: the "agent" is the test,
 * calling the registered tools exactly as a browser agent would.
 */
import "fake-indexeddb/auto";
import { beforeEach, describe, expect, test } from "bun:test";
import { createRabbithole, type Rabbithole } from "./index";

type Tool = { name: string; execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<string> | string };

function fakeContext() {
  const tools = new Map<string, Tool>();
  return {
    tools,
    mc: {
      async registerTool(def: Tool) {
        tools.set(def.name, def);
      },
    },
    call: async (name: string, input: unknown = {}) => JSON.parse(await tools.get(name)!.execute(input)),
  };
}

let n = 0;
let rh: Rabbithole;
let ctx: ReturnType<typeof fakeContext>;

beforeEach(async () => {
  ctx = fakeContext();
  rh = createRabbithole({ dbName: `test-${++n}`, duplexStorage: null, modelContext: () => ctx.mc });
  await rh.ready;
});

describe("boot", () => {
  test("seeds demo content and registers tools", () => {
    const s = rh.store.getState();
    expect(s.booted).toBe(true);
    expect(Object.keys(s.library.documents).length).toBe(7);
    expect(s.library.concepts.selfattention?.bookmarked).toBe(false);
    expect(Object.values(s.library.documents).every((d) => d.openedAt === undefined)).toBe(true);
    expect(s.profile.role).toBe("");
    expect(s.notes).toEqual([]);
    expect(s.agent.connected).toBe(true);
    expect([...ctx.tools.keys()]).toEqual([
      "rabbithole_await_event",
      "rabbithole_complete_event",
      "rabbithole_get_protocol",
      "rabbithole_get_state",
      "rabbithole_open",
      "rabbithole_get_reader",
      "rabbithole_update_reader",
    ]);
  });

  test("persists across instances", async () => {
    rh.reader.setGoal("understand attention");
    rh.reader.toggleConceptBookmark("softmax");
    const again = createRabbithole({ dbName: `test-${n}`, duplexStorage: null, modelContext: () => ctx.mc });
    await again.ready;
    // dexie writes are fire-and-forget; give them a tick
    await new Promise((r) => setTimeout(r, 20));
    const s = again.store.getState();
    expect(s.profile.goal).toBe("understand attention");
    expect(s.library.concepts.softmax?.bookmarked).toBe(true);
    expect(Object.keys(s.library.documents).length).toBe(7);
  });
});

describe("demo reading", () => {
  test("opens a demo document with the stepper, then a canned concept", async () => {
    rh.reader.open("tx");
    let s = rh.store.getState();
    expect(s.session.docId).toBe("tx");
    expect(s.session.loading?.step).toBe(0);
    await new Promise((r) => setTimeout(r, 1500));
    s = rh.store.getState();
    expect(s.session.loading).toBeNull();

    rh.reader.openConcept({ conceptId: "selfattention", label: "self-attention" });
    expect(rh.store.getState().session.panes[0]?.status).toBe("loading");
    await new Promise((r) => setTimeout(r, 1000));
    s = rh.store.getState();
    expect(s.session.panes[0]?.status).toBe("ready");
    expect(s.library.trails.tx).toEqual(["selfattention"]);
    expect(s.agent.stats.queued).toBe(0); // no agent involved
  });

  test("re-opening the current document during its stepper is a no-op", async () => {
    rh.reader.open("tx");
    await new Promise((r) => setTimeout(r, 600));
    const before = rh.store.getState().session.loading;
    expect(before?.step).toBe(1);
    rh.reader.open("tx"); // what the route does on mount
    expect(rh.store.getState().session.loading).toBe(before);
    await new Promise((r) => setTimeout(r, 900));
    expect(rh.store.getState().session.loading).toBeNull();
  });

  test("pane trail semantics: open from a pane closes panes to its right", async () => {
    rh.reader.open("tx");
    await new Promise((r) => setTimeout(r, 1500));
    rh.reader.openConcept({ conceptId: "selfattention", label: "a" });
    rh.reader.openConcept({ conceptId: "softmax", label: "b", fromIndex: 0 });
    rh.reader.openConcept({ conceptId: "multihead", label: "c", fromIndex: 1 });
    expect(rh.store.getState().session.panes.map((p) => p.conceptId)).toEqual(["selfattention", "softmax", "multihead"]);
    // open positional from the first pane → replaces softmax/multihead
    rh.reader.openConcept({ conceptId: "positional", label: "d", fromIndex: 0 });
    expect(rh.store.getState().session.panes.map((p) => p.conceptId)).toEqual(["selfattention", "positional"]);
    // re-opening an already open pane from the article just reveals it
    rh.reader.openConcept({ conceptId: "selfattention", label: "a" });
    expect(rh.store.getState().session.panes.length).toBe(2);
    expect(rh.store.getState().session.reveal?.index).toBe(0);
    rh.reader.popLast();
    expect(rh.store.getState().session.panes.length).toBe(1);
  });
});

describe("duplex with the agent", () => {
  test("explaining an unknown term round-trips through await/complete", async () => {
    rh.reader.open("tx");
    await new Promise((r) => setTimeout(r, 1500));
    rh.reader.openConcept({ conceptId: "tx:encoder", label: "encoder", context: "with an encoder and a decoder" });
    let s = rh.store.getState();
    const pane = s.session.panes[0]!;
    expect(pane.status).toBe("loading");
    expect(s.agent.requests[pane.requestId!]?.status).toBe("queued");

    const delivered = await ctx.call("rabbithole_await_event");
    expect(delivered.status).toBe("event");
    expect(delivered.event.type).toBe("concept.explain");
    expect(delivered.event.payload.term).toBe("encoder");
    expect(delivered.event.payload.reader.profile).toContain("A curious reader");
    expect(rh.store.getState().agent.requests[pane.requestId!]?.status).toBe("inflight");

    // a bad result is rejected and redelivered with the same id
    const bad = await ctx.call("rabbithole_complete_event", { eventId: delivered.event.id, result: { nope: 1 } });
    expect(bad.status).toBe("retry");
    expect(bad.error).toContain('"short"');

    const good = await ctx.call("rabbithole_complete_event", {
      eventId: delivered.event.id,
      result: { short: "The half that reads the [[input sequence]].", links: [{ k: "YT", t: "Encoders", q: "transformer encoder" }] },
    });
    expect(good.status).toBe("completed");
    s = rh.store.getState();
    expect(s.session.panes[0]?.status).toBe("ready");
    expect(s.library.concepts["tx:encoder"]?.short).toContain("input sequence");
    expect(s.library.concepts["tx:encoder"]?.links[0]?.u).toContain("youtube.com");
    expect(s.agent.requests[pane.requestId!]?.status).toBe("done");
    expect(s.library.trails.tx).toEqual(["tx:encoder"]);

    // duplicate completion is a no-op
    const dup = await ctx.call("rabbithole_complete_event", { eventId: delivered.event.id, result: { short: "x" } });
    expect(dup.status).toBe("already_completed");
    expect(rh.store.getState().library.concepts["tx:encoder"]?.short).toContain("input sequence");
  });

  test("elaborate appends one thread message per event id", async () => {
    rh.reader.open("tx");
    await new Promise((r) => setTimeout(r, 1500));
    rh.reader.openConcept({ conceptId: "softmax", label: "softmax" });
    await new Promise((r) => setTimeout(r, 1000));
    rh.reader.elaborate(0, "why exponentiate?");
    expect(rh.store.getState().session.panes[0]?.busy).toBe(true);
    const d = await ctx.call("rabbithole_await_event");
    expect(d.event.type).toBe("concept.elaborate");
    expect(d.event.payload.question).toBe("why exponentiate?");
    expect(d.event.payload.base).toContain("probability distribution");
    await ctx.call("rabbithole_complete_event", { eventId: d.event.id, result: { text: "Because ratios.", anec: null, html: null } });
    const s = rh.store.getState();
    expect(s.session.panes[0]?.busy).toBe(false);
    expect(s.library.threads.softmax?.messages).toHaveLength(1);
    expect(s.library.threads.softmax?.messages[0]?.q).toBe("why exponentiate?");
  });

  test("pasted text is readable at once; the agent's terms get highlighted where they first appear", async () => {
    const docId = (await rh.reader.openInput(
      "Mitochondria are the powerhouse of the cell.\n\nThey make ATP through oxidative phosphorylation. ATP again.",
    ))!;
    let s = rh.store.getState();
    const doc = s.library.documents[docId]!;
    expect(s.session.loading).toBeNull();
    expect(doc.blocks.map((b) => b.type)).toEqual(["paragraph", "paragraph"]);
    expect(doc.annotated).toBeUndefined();

    const d = await ctx.call("rabbithole_await_event");
    expect(d.event.type).toBe("document.annotate");
    expect(d.event.payload.text).toContain("Mitochondria");
    expect(d.event.payload.reminder).toContain('"terms"');
    await ctx.call("rabbithole_complete_event", {
      eventId: d.event.id,
      result: {
        terms: [{ term: "oxidative phosphorylation", short: "How cells turn food into [[ATP]] using oxygen." }, "ATP", { term: "mitochondria" }],
        title: "Cell power",
      },
    });
    s = rh.store.getState();
    const marked = s.library.documents[docId]!;
    expect(marked.annotated).toBe(true);
    expect(marked.title).toBe("Cell power");
    expect(marked.termCount).toBe(3);
    // verbatim text, first occurrences only, original casing kept
    expect((marked.blocks[0] as { text: string }).text).toBe("[[mitochondria|Mitochondria]] are the powerhouse of the cell.");
    expect((marked.blocks[1] as { text: string }).text).toBe("They make [[ATP]] through [[oxidative phosphorylation]]. ATP again.");

    // a term that came with a short opens instantly; one without still asks the agent
    rh.reader.openConcept({ conceptId: `${docId}:oxidativephosphorylation`, label: "oxidative phosphorylation" });
    expect(rh.store.getState().session.panes[0]?.status).toBe("ready");
    expect(rh.store.getState().library.concepts[`${docId}:oxidativephosphorylation`]?.short).toContain("[[ATP]]");
    const queuedBefore = rh.store.getState().agent.stats.queued;
    rh.reader.openConcept({ conceptId: `${docId}:atp`, label: "ATP", fromIndex: 0 });
    expect(rh.store.getState().session.panes[1]?.status).toBe("loading");
    expect(rh.store.getState().agent.stats.queued).toBe(queuedBefore + 1);

    const state = await ctx.call("rabbithole_get_state");
    expect(state.document.title).toBe("Cell power");
    expect(state.document.text).toBe("Mitochondria are the powerhouse of the cell.\n\nThey make ATP through oxidative phosphorylation. ATP again.");
  });

  test("the agent opens its own text with terms — no round trip", async () => {
    const r = await ctx.call("rabbithole_open", {
      title: "Byzantine generals, briefly",
      text: "# Generals\n\nSeveral generals must agree on a plan while some may be traitors.",
      terms: [{ term: "traitors", short: "Generals who send different messages to different peers." }],
    });
    expect(r.status).toBe("ready");
    expect(rh.store.getState().library.concepts[`${r.docId}:traitors`]?.short).toContain("Generals");
    const doc = rh.store.getState().library.documents[r.docId]!;
    expect(doc.title).toBe("Byzantine generals, briefly");
    expect(doc.blocks[0]).toEqual({ type: "heading", level: 1, text: "Generals" });
    expect((doc.blocks[1] as { text: string }).text).toContain("[[traitors]]");
    expect(rh.store.getState().agent.stats.queued).toBe(0);
    expect(rh.store.getState().session.docId).toBe(r.docId);
  });

  test("get_protocol returns the loop and every event type", async () => {
    const text = await ctx.tools.get("rabbithole_get_protocol")!.execute({});
    for (const t of ["rabbithole_get_reader", "rabbithole_update_reader", "rabbithole_await_event", "rabbithole_complete_event", "document.annotate", "concept.explain", "selection.ask", "concept.elaborate", "rabbithole_open"]) {
      expect(text).toContain(t);
    }
    expect(rh.store.getState().agent.prompt).toContain("rabbithole_get_protocol");
    expect(rh.store.getState().agent.prompt.split("\n").length).toBeLessThanOrEqual(2);
  });

  test("get_reader / update_reader: the agent brings its own knowledge of the reader", async () => {
    const before = await ctx.call("rabbithole_get_reader");
    expect(before.role).toBe("");
    expect(before.preferences).toEqual([]);
    expect(before.notes.length).toBe(0);

    await ctx.call("rabbithole_update_reader", {
      role: "Oncology nurse",
      preferences: ["clinical examples", "concrete first"],
      instructions: "Skip basic biology.",
      goal: "pass the exam",
      notes: ["knows linear algebra", "knows linear algebra", " "],
    });
    const s = rh.store.getState();
    expect(s.profile.role).toBe("Oncology nurse");
    expect(s.profile.prefs["code analogies"]).toBe(false);
    expect(s.profile.prefs["clinical examples"]).toBe(true);
    expect(s.profile.prefs["concrete first"]).toBe(true);
    expect(s.profile.notes).toBe("Skip basic biology.");
    expect(s.profile.goal).toBe("pass the exam");
    expect(s.notes.filter((x) => x.text === "knows linear algebra")).toHaveLength(1);
    const ctxLine = rh.reader.readerContext().profile;
    expect(ctxLine).toContain("Oncology nurse");
    expect(ctxLine).toContain("pass the exam");
    expect(s.agent.log.some((l) => l.name === "rabbithole_update_reader")).toBe(true);

    // partial update keeps everything else
    await ctx.call("rabbithole_update_reader", { goal: "" });
    expect(rh.store.getState().profile.goal).toBe("");
    expect(rh.store.getState().profile.role).toBe("Oncology nurse");
  });

  test("selection.ask creates a quoted pane next to its source", async () => {
    rh.reader.open("tx");
    await new Promise((r) => setTimeout(r, 1500));
    rh.reader.select({ text: "dispensing with recurrence", fromIndex: -1, x: 0, y: 0 });
    rh.reader.ask("why?");
    const s = rh.store.getState();
    expect(s.session.selection).toBeNull();
    const pane = s.session.panes[0]!;
    const c = s.library.concepts[pane.conceptId]!;
    expect(c.label).toBe("“dispensing with recurrence”");
    expect(c.question).toBe("why?");
    const d = await ctx.call("rabbithole_await_event");
    expect(d.event.type).toBe("selection.ask");
    expect(d.event.payload.phrase).toBe("dispensing with recurrence");
  });
});

describe("shared trails", () => {
  test("shareLink round-trips through openSharedTrail and replays the panes", async () => {
    rh.reader.open("tx");
    await new Promise((r) => setTimeout(r, 1500));
    rh.reader.openConcept({ conceptId: "selfattention", label: "self-attention" });
    await new Promise((r) => setTimeout(r, 1000));
    rh.reader.openConcept({ conceptId: "softmax", label: "softmax", fromIndex: 0 });
    await new Promise((r) => setTimeout(r, 1000));
    const link = rh.reader.shareLink()!;
    expect(link).toContain("/#trail=");

    const other = createRabbithole({ dbName: `test-${n}-b`, duplexStorage: null, modelContext: () => fakeContext().mc });
    await other.ready;
    const docId = await other.reader.openSharedTrail(link.slice(link.indexOf("#")));
    expect(docId).toBe("tx");
    // demo stepper (1350ms) + 1200ms lead-in + two panes (900ms each + 2600ms narration pause)
    await new Promise((r) => setTimeout(r, 1350 + 1200 + 900 + 2600 + 900 + 200));
    const s = other.store.getState();
    expect(s.session.panes.map((p) => p.conceptId)).toEqual(["selfattention", "softmax"]);
    expect(s.session.say?.text).toContain("softmax");
    other.reader.stopTour();
    expect(other.store.getState().session.say).toBeNull();
  }, 15000);
});

describe("link watchdog", () => {
  test("idle → polling while await_event is called → disconnected when polling stops", async () => {
    let t = 0;
    const c = fakeContext();
    const r = createRabbithole({ dbName: `test-wd-${++n}`, duplexStorage: null, modelContext: () => c.mc });
    await r.ready;
    const agent = r.agent as unknown as { now: () => number; disconnectAfterMs: number };
    // swap the clock after boot; refreshLink() reads it on every call
    Object.defineProperty(agent, "now", { value: () => t });
    expect(r.store.getState().agent.link).toBe("idle");

    const poll = c.call("rabbithole_await_event"); // long-poll in flight (12s)
    await new Promise((s) => setTimeout(s, 5));
    r.agent.refreshLink();
    expect(r.store.getState().agent.link).toBe("polling");

    r.reader.setGoal("x"); // not an event; nothing to deliver yet
    r.reader.open("tx");
    await new Promise((s) => setTimeout(s, 1400));
    r.reader.openConcept({ conceptId: "tx:zzz", label: "zzz" }); // delivers an event, ending the poll
    await poll;
    r.agent.refreshLink();
    expect(r.store.getState().agent.link).toBe("polling"); // just returned

    t = agent.disconnectAfterMs + 1;
    r.agent.refreshLink();
    expect(r.store.getState().agent.link).toBe("disconnected");

    void c.call("rabbithole_await_event"); // it came back
    await new Promise((s) => setTimeout(s, 5));
    r.agent.refreshLink();
    expect(r.store.getState().agent.link).toBe("polling");
    r.dispose();
  });
});
