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
    expect(s.library.concepts.selfattention?.bookmarked).toBe(true);
    expect(s.profile.role).toContain("Software engineer");
    expect(s.agent.connected).toBe(true);
    expect([...ctx.tools.keys()]).toEqual([
      "rabbithole_await_event",
      "rabbithole_complete_event",
      "rabbithole_get_state",
      "rabbithole_open",
      "rabbithole_set_goal",
      "rabbithole_remember",
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
    expect(delivered.event.payload.reader.profile).toContain("Software engineer");
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

  test("agent opens a pasted text: tool → analyze event → document", async () => {
    const opened = await ctx.call("rabbithole_open", { input: "Mitochondria are the powerhouse of the cell. They make ATP." });
    expect(opened.status).toBe("analyzing");
    const docId = opened.docId as string;
    expect(rh.store.getState().session.loading?.docId).toBe(docId);
    expect(rh.store.getState().session.loading?.step).toBe(1);

    const d = await ctx.call("rabbithole_await_event");
    expect(d.event.type).toBe("document.analyze");
    expect(d.event.payload.text).toContain("Mitochondria");
    expect(d.event.payload.url).toBeNull();
    await ctx.call("rabbithole_complete_event", {
      eventId: d.event.id,
      result: { title: "Cell power", meta: "biology", paragraphs: ["[[Mitochondria]] make [[ATP]].", "That is all."] },
    });
    const s = rh.store.getState();
    expect(s.session.loading).toBeNull();
    const doc = s.library.documents[docId]!;
    expect(doc.title).toBe("Cell power");
    expect(doc.termCount).toBe(2);
    expect(doc.source).toBe("text");

    const state = await ctx.call("rabbithole_get_state");
    expect(state.document.title).toBe("Cell power");
    expect(state.document.text).toBe("Mitochondria make ATP.\n\nThat is all.");
  });

  test("set_goal and remember shape the reader context", async () => {
    await ctx.call("rabbithole_set_goal", { goal: "pass the exam" });
    await ctx.call("rabbithole_remember", { notes: ["knows linear algebra", "knows linear algebra", " "] });
    const s = rh.store.getState();
    expect(s.profile.goal).toBe("pass the exam");
    expect(s.notes.map((x) => x.text)).toContain("knows linear algebra");
    expect(s.notes.filter((x) => x.text === "knows linear algebra")).toHaveLength(1);
    expect(rh.reader.readerContext().profile).toContain("pass the exam");
    expect(s.agent.log.some((l) => l.name === "rabbithole_remember")).toBe(true);
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
