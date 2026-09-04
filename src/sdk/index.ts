/**
 * Composition root. The UI imports only from here.
 *
 *   const rh = createRabbithole();
 *   rh.store   – reactive state (subscribe / select)
 *   rh.reader  – the verbs: open, openConcept, ask, elaborate, bookmarks, profile…
 *   rh.agent   – the WebMCP bridge: queue(event), tools, prompt
 *   rh.ready   – resolves once IndexedDB is loaded and tools are registered
 */
import { Agent, findModelContext, type AgentOptions } from "./agent/agent";
import { runMockAgent } from "./agent/mock";
import { buildTools } from "./agent/tools";
import { loadAll, RabbitholeDB, writer, type Snapshot } from "./db";
import { createReader, type Reader } from "./reader";
import { buildSeed } from "./seed/seed";
import { createMutators, createRabbitholeStore, DEFAULT_PROFILE, type Store } from "./store";

export interface RabbitholeOptions {
  /** IndexedDB database name; false disables persistence (tests) */
  dbName?: string | false;
  /** where the duplex queue persists; defaults to localStorage when available */
  duplexStorage?: AgentOptions["storage"];
  modelContext?: AgentOptions["modelContext"];
}

export interface Rabbithole {
  store: Store;
  reader: Reader;
  agent: Agent;
  ready: Promise<void>;
  /** try registering tools again (e.g. modelContext appeared late) */
  reconnect(): Promise<boolean>;
  /** dev only: answer events with a synthetic agent (keeps running until stopped) */
  startMockAgent(): void;
  stopMockAgent(): void;
  /** stop timers and the mock agent (hot reload, tests) */
  dispose(): void;
}

const EMPTY: Snapshot = { documents: [], concepts: [], threads: [], trails: [], notes: [], profile: null, seeded: false };

export function createRabbithole(opts: RabbitholeOptions = {}): Rabbithole {
  const store = createRabbitholeStore();
  const db = opts.dbName === false ? null : safeDb(opts.dbName ?? "rabbithole");
  const write = db ? writer(db) : null;
  const mutators = createMutators(store, write);

  const agent = new Agent({
    store,
    mutators,
    storage: opts.duplexStorage === undefined ? safeLocalStorage() : opts.duplexStorage,
    modelContext: opts.modelContext ?? findModelContext,
  });
  const reader = createReader({ store, mutators, agent });
  const tools = buildTools({ reader, store });

  async function boot() {
    let snap = EMPTY;
    if (db) {
      try {
        snap = await loadAll(db);
      } catch (e) {
        console.warn("[rabbithole] IndexedDB unavailable, running in memory", e);
      }
    }
    if (!snap.seeded) {
      const seed = buildSeed();
      const have = new Set(snap.documents.map((d) => d.id));
      const haveC = new Set(snap.concepts.map((c) => c.id));
      snap = {
        ...snap,
        documents: [...snap.documents, ...seed.documents.filter((d) => !have.has(d.id))],
        concepts: [...snap.concepts, ...seed.concepts.filter((c) => !haveC.has(c.id))],
        notes: snap.notes.length ? snap.notes : seed.notes,
        profile: snap.profile ?? seed.profile,
      };
      write?.bulk({ documents: snap.documents, concepts: snap.concepts, notes: snap.notes });
      write?.profile(snap.profile ?? DEFAULT_PROFILE);
      write?.seeded();
    }
    mutators.hydrate(snap);
    await agent.connect(tools);
  }

  const ready = boot();
  let mockController: AbortController | null = null;

  return {
    store,
    reader,
    agent,
    ready,
    reconnect: () => agent.connect(tools),
    startMockAgent() {
      if (mockController) return;
      mockController = new AbortController();
      mutators.setAgent({ mock: true });
      void runMockAgent(agent, {
        signal: mockController.signal,
        onAnswer: (type) => mutators.log({ name: "mock agent", detail: `answered ${type}`, tone: "tool" }),
      });
    },
    stopMockAgent() {
      mockController?.abort();
      mockController = null;
      mutators.setAgent({ mock: false });
    },
    dispose() {
      mockController?.abort();
      reader.dispose();
    },
  };
}

function safeDb(name: string): RabbitholeDB | null {
  try {
    if (typeof indexedDB === "undefined") return null;
    return new RabbitholeDB(name);
  } catch {
    return null;
  }
}

function safeLocalStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}

export type { Reader } from "./reader";
export type { Agent } from "./agent/agent";
export type { AgentEvent, AgentEventType } from "./agent/events";
export * from "./types";
export { currentDocument, profileText, visitedConcepts, visitedDocuments, type RabbitholeState, type Store } from "./store";
export { blockText, documentText, DEMO_EXPLAIN_MS, DEMO_STEP_MS } from "./reader";
export { segments, strip, scopedId, slug, type Segment } from "./content/markers";
export { DEMO_SUGGESTIONS } from "./seed/canned";
