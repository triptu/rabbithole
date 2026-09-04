/**
 * The Agent: what the app talks to when it needs the model.
 *
 *   const id = agent.queue({ type: "concept.explain", payload })   // page → agent
 *   agent.on("concept.explain", ({ event, result }) => …)          // agent → page
 *
 * Underneath is the DuplexWebMCP channel from the prototype: the agent long-polls
 * `rabbithole_await_event`, does the work, and calls `rabbithole_complete_event`.
 * Delivery is at-least-once with idempotent completion, so handlers must upsert by
 * the ids in the payload. This class adds: typed events with a one-line reminder in
 * each payload, request tracking in the store (queued → inflight → done), tool
 * registration with the browser's modelContext, a link-status watchdog (is anyone
 * still polling?), and an activity log for the UI.
 */
import type { Mutators, Store } from "../store";
import type { LinkStatus, ToolInfo } from "../types";
import { DuplexWebMCP, type DuplexEvent, type DuplexLogName, type ModelContextLike } from "./duplex-mcp-sdk.js";
import type { AgentEvent, AgentEventType, PayloadFor, ResultFor } from "./events";
import { EVENT_REMINDERS, PASTE_PROMPT, protocol, RECONNECT_PROMPT } from "./instructions";
import { TOOL_PREFIX } from "./names";

export { TOOL_PREFIX };

/** A tool the page exposes to the agent (agent → page direction). */
export interface PageTool {
  name: string;
  description: string;
  inputSchema: object;
  annotations?: object;
  execute: (input: Record<string, unknown>) => Promise<unknown> | unknown;
}

export type Handler<T extends AgentEventType> = (args: {
  event: DuplexEvent<PayloadFor<T>>;
  result: ResultFor<T>;
}) => void | Promise<void>;

export interface AgentOptions {
  store: Store;
  mutators: Mutators;
  /** where queued events survive reloads; null disables persistence */
  storage?: { getItem(k: string): string | null; setItem(k: string, v: string): void } | null;
  /** finds the WebMCP model context; defaults to navigator/document.modelContext */
  modelContext?: () => ModelContextLike | null;
  waitTimeoutMs?: number;
  leaseMs?: number;
  /** how long after the last poll returned we consider the agent gone */
  disconnectAfterMs?: number;
  now?: () => number;
}

/** WebMCP's entry point differs between spec drafts and browser builds. */
export function findModelContext(): ModelContextLike | null {
  const n = (globalThis as { navigator?: { modelContext?: ModelContextLike } }).navigator?.modelContext;
  if (n?.registerTool) return n;
  const d = (globalThis as { document?: { modelContext?: ModelContextLike } }).document?.modelContext;
  if (d?.registerTool) return d;
  return null;
}

export class Agent {
  readonly channel: DuplexWebMCP;
  private readonly store: Store;
  private readonly m: Mutators;
  private readonly findContext: () => ModelContextLike | null;
  private readonly now: () => number;
  private readonly disconnectAfterMs: number;
  private tools: PageTool[] = [];
  /** await_event calls currently waiting inside the page */
  private pollsInFlight = 0;
  private lastPollAt: number | null = null;
  private watchdog: ReturnType<typeof setInterval> | null = null;

  constructor(opts: AgentOptions) {
    this.store = opts.store;
    this.m = opts.mutators;
    this.findContext = opts.modelContext ?? findModelContext;
    this.now = opts.now ?? (() => Date.now());
    const waitTimeoutMs = opts.waitTimeoutMs ?? 12_000;
    this.disconnectAfterMs = opts.disconnectAfterMs ?? waitTimeoutMs + 8_000;

    this.channel = new DuplexWebMCP({
      name: "Rabbithole reader",
      toolPrefix: TOOL_PREFIX,
      waitTimeoutMs,
      leaseMs: opts.leaseMs ?? 60_000,
      storage: opts.storage === undefined ? null : opts.storage,
      storageKey: "rabbithole:duplex:v1",
      agentInstructions: protocol(),
      logger: (name, detail) => this.onChannelLog(name, detail),
    });

    this.channel.subscribe((stats) => this.m.setAgent({ stats }));
    this.m.setAgent({
      prompt: PASTE_PROMPT,
      reconnectPrompt: RECONNECT_PROMPT,
      available: this.findContext() !== null,
      link: this.findContext() ? "idle" : "unavailable",
    });
  }

  // ------------------------------------------------------------------ events

  /** Hand the agent a piece of work. Returns the request id to track in the store. */
  queue<E extends AgentEvent>(event: E, opts: { dedupeKey?: string } = {}): string {
    const payload = { ...event.payload, reminder: EVENT_REMINDERS[event.type] ?? "" };
    const e = this.channel.emit(event.type, payload, opts);
    const p = event.payload as { conceptId?: string; docId?: string };
    this.m.upsertRequest(e.id, { type: event.type, target: p.conceptId ?? p.docId });
    return e.id;
  }

  /** Register the page-side handler that applies an agent result. One per type. */
  on<T extends AgentEventType>(type: T, handler: Handler<T>): () => void {
    return this.channel.on(type, async ({ event, result }) => {
      await handler({ event: event as DuplexEvent<PayloadFor<T>>, result: result as ResultFor<T> });
    });
  }

  /** The tools currently exposed, duplex pair first. */
  get toolInfos(): ToolInfo[] {
    const names = this.channel.toolNames;
    return [
      { name: names.awaitEvent, description: "Long-poll for the next piece of work the page hands you." },
      { name: names.completeEvent, description: "Deliver the result for an event id." },
      ...this.tools.map((t) => ({ name: t.name, description: t.description })),
    ];
  }

  /** The protocol text (also what rabbithole_get_protocol returns). */
  get protocol(): string {
    return protocol();
  }

  // ------------------------------------------------------------------- tools

  /**
   * Register the duplex pair plus the given page tools with the browser agent.
   * Safe to call when no modelContext exists: state reflects `available: false`
   * and the tools stay listed so the UI can show what would be exposed.
   */
  async connect(tools: PageTool[]): Promise<boolean> {
    this.tools = tools;
    const mc = this.findContext();
    this.m.setAgent({ tools: this.toolInfos, available: mc !== null, link: mc ? "idle" : "unavailable" });
    if (!mc) return false;

    const logged = this.loggingContext(mc);
    await this.channel.registerWebMCP(logged);
    for (const tool of tools) {
      await logged.registerTool({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        annotations: tool.annotations,
        execute: async (input) => {
          const out = await tool.execute((input ?? {}) as Record<string, unknown>);
          return typeof out === "string" ? out : JSON.stringify(out ?? { ok: true });
        },
      });
    }
    this.m.setAgent({ connected: true });
    this.startWatchdog();
    return true;
  }

  /** Wraps a modelContext so every tool call lands in the activity log and feeds the watchdog. */
  private loggingContext(mc: ModelContextLike): ModelContextLike {
    const { awaitEvent } = this.channel.toolNames;
    return {
      registerTool: (tool) =>
        mc.registerTool({
          ...tool,
          execute: async (input, options) => {
            const isPoll = tool.name === awaitEvent;
            if (isPoll) this.pollStarted();
            try {
              const out = await tool.execute(input, options);
              // idle heartbeats from await_event are not interesting to show
              if (isPoll && typeof out === "string" && out.includes('"idle"')) return out;
              this.m.log({ name: tool.name, detail: summarize(input), tone: "tool" });
              return out;
            } catch (e) {
              this.m.log({ name: tool.name, detail: `✗ ${(e as Error).message}`, tone: "error" });
              throw e;
            } finally {
              if (isPoll) this.pollEnded();
            }
          },
        }),
    };
  }

  // ------------------------------------------------------------ link watchdog

  private pollStarted() {
    this.pollsInFlight += 1;
    this.lastPollAt = this.now();
    this.refreshLink();
  }
  private pollEnded() {
    this.pollsInFlight = Math.max(0, this.pollsInFlight - 1);
    this.lastPollAt = this.now();
    this.refreshLink();
  }

  /** Derive the link status from polling activity; only writes to the store on change. */
  refreshLink() {
    const s = this.store.getState().agent;
    let link: LinkStatus;
    if (!s.available) link = "unavailable";
    else if (this.pollsInFlight > 0) link = "polling";
    else if (this.lastPollAt === null) link = "idle";
    else link = this.now() - this.lastPollAt > this.disconnectAfterMs ? "disconnected" : "polling";
    if (link !== s.link) this.m.setAgent({ link });
  }

  private startWatchdog() {
    if (this.watchdog) return;
    this.watchdog = setInterval(() => this.refreshLink(), 2_000);
  }

  dispose() {
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  // ------------------------------------------------------------- bookkeeping

  private onChannelLog(name: DuplexLogName, detail: unknown) {
    const d = (detail ?? {}) as { id?: string; type?: string; eventId?: string; error?: string; attempt?: number };
    switch (name) {
      case "event.queued":
        if (d.id && d.type) this.m.upsertRequest(d.id, { type: d.type, status: "queued", createdAt: Date.now() });
        break;
      case "event.delivered":
        if (d.id && d.type) {
          this.m.upsertRequest(d.id, { type: d.type, status: "inflight", attempt: d.attempt ?? 1 });
          this.m.log({ name: d.type, detail: `handed to agent · ${d.id}`, tone: "event" });
        }
        break;
      case "event.completed": {
        const req = d.eventId ? this.store.getState().agent.requests[d.eventId] : undefined;
        if (req) this.m.upsertRequest(req.id, { type: req.type, status: "done", completedAt: Date.now(), error: undefined });
        break;
      }
      case "event.retry": {
        const req = d.eventId ? this.store.getState().agent.requests[d.eventId] : undefined;
        if (req) this.m.upsertRequest(req.id, { type: req.type, status: "queued", error: d.error });
        this.m.log({ name: req?.type ?? "event", detail: `result rejected · ${d.error ?? ""}`, tone: "error" });
        break;
      }
      case "storage.error":
        console.warn("[rabbithole] duplex storage", detail);
        break;
      default:
        break;
    }
  }
}

function summarize(input: unknown): string {
  if (!input || typeof input !== "object") return "";
  const keys = Object.keys(input as object);
  if (!keys.length) return "";
  return JSON.stringify(input).slice(0, 140);
}
