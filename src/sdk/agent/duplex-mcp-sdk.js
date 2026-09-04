const DEFAULT_WAIT_TIMEOUT_MS = 12_000;
const DEFAULT_LEASE_MS = 45_000;
const DEFAULT_RETRY_DELAY_MS = 1_000;

function defaultIdFactory() {
  if (globalThis.crypto?.randomUUID) return `evt_${globalThis.crypto.randomUUID()}`;
  return `evt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function assertPositiveInteger(name, value) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new TypeError(`${name} must be a positive integer`);
  }
}

/**
 * A small, single-page, at-least-once event channel for WebMCP.
 *
 * Page -> agent: await_event leases (but does not remove) one event.
 * Agent -> page: complete_event applies the result and atomically completes it.
 */
export class DuplexWebMCP {
  constructor({
    name = "Page duplex channel",
    toolPrefix = "duplex",
    waitTimeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
    leaseMs = DEFAULT_LEASE_MS,
    retryDelayMs = DEFAULT_RETRY_DELAY_MS,
    maxCompleted = 200,
    storage = null,
    storageKey = `webmcp-duplex:${toolPrefix}:v1`,
    idFactory = defaultIdFactory,
    now = () => Date.now(),
    logger = () => {},
    agentInstructions = "Process each event according to its type and payload.",
  } = {}) {
    assertPositiveInteger("waitTimeoutMs", waitTimeoutMs);
    assertPositiveInteger("leaseMs", leaseMs);
    assertPositiveInteger("retryDelayMs", retryDelayMs);
    assertPositiveInteger("maxCompleted", maxCompleted);
    if (!/^[a-z][a-z0-9_]*$/.test(toolPrefix)) {
      throw new TypeError("toolPrefix must contain lowercase letters, digits, and underscores");
    }

    this.name = name;
    this.toolPrefix = toolPrefix;
    this.waitTimeoutMs = waitTimeoutMs;
    this.leaseMs = leaseMs;
    this.retryDelayMs = retryDelayMs;
    this.maxCompleted = maxCompleted;
    this.storage = storage;
    this.storageKey = storageKey;
    this.idFactory = idFactory;
    this.now = now;
    this.logger = logger;
    this.agentInstructions = agentInstructions;

    this.events = [];
    this.handlers = new Map();
    this.completing = new Map();
    this.changeWaiters = new Set();
    this.subscribers = new Set();
    this.registeredToolNames = null;

    this.#restore();
  }

  get toolNames() {
    return {
      awaitEvent: `${this.toolPrefix}_await_event`,
      completeEvent: `${this.toolPrefix}_complete_event`,
    };
  }

  on(type, handler) {
    if (typeof type !== "string" || !type) throw new TypeError("event type is required");
    if (typeof handler !== "function") throw new TypeError("handler must be a function");
    this.handlers.set(type, handler);
    return () => this.handlers.delete(type);
  }

  subscribe(listener) {
    if (typeof listener !== "function") throw new TypeError("listener must be a function");
    this.subscribers.add(listener);
    listener(this.getStats());
    return () => this.subscribers.delete(listener);
  }

  getStats() {
    const now = this.now();
    return this.events.reduce(
      (stats, event) => {
        if (event.status === "completed") stats.completed += 1;
        else if (event.status === "leased" && event.leaseUntil > now) stats.inflight += 1;
        else stats.queued += 1;
        return stats;
      },
      { queued: 0, inflight: 0, completed: 0 },
    );
  }

  emit(type, payload, { dedupeKey } = {}) {
    if (typeof type !== "string" || !type) throw new TypeError("event type is required");

    if (dedupeKey) {
      const existing = this.events.find(
        (event) =>
          event.type === type &&
          event.dedupeKey === dedupeKey &&
          event.status !== "completed",
      );
      if (existing) return this.#publicEvent(existing);
    }

    const event = {
      id: this.idFactory(),
      type,
      payload: clone(payload),
      dedupeKey: dedupeKey || null,
      createdAt: new Date(this.now()).toISOString(),
      status: "queued",
      attempt: 0,
      availableAt: this.now(),
      leaseUntil: 0,
      completedAt: null,
      result: null,
      lastError: null,
    };

    this.events.push(event);
    this.logger("event.queued", this.#publicEvent(event));
    this.#commitChange();
    return this.#publicEvent(event);
  }

  async awaitEvent({ signal } = {}) {
    const deadline = this.now() + this.waitTimeoutMs;

    while (true) {
      if (signal?.aborted) return { status: "cancelled" };

      const event = this.#claimAvailableEvent();
      if (event) {
        this.logger("event.delivered", this.#publicEvent(event));
        return { status: "event", event: this.#publicEvent(event) };
      }

      const remaining = deadline - this.now();
      if (remaining <= 0) {
        return { status: "idle", retryAfterMs: 0 };
      }

      const nextAvailableAt = this.#nextAvailableAt();
      const untilAvailable = nextAvailableAt === null
        ? remaining
        : Math.max(1, nextAvailableAt - this.now());
      await this.#waitForChange(Math.min(remaining, untilAvailable), signal);
    }
  }

  async complete(eventId, result) {
    if (typeof eventId !== "string" || !eventId) {
      return { status: "invalid", error: "eventId is required" };
    }

    const event = this.events.find((candidate) => candidate.id === eventId);
    if (!event) return { status: "unknown_event", eventId };
    if (event.status === "completed") {
      return {
        status: "already_completed",
        eventId,
        completedAt: event.completedAt,
      };
    }

    if (this.completing.has(eventId)) {
      await this.completing.get(eventId);
      return this.complete(eventId, result);
    }

    const operation = this.#completeOnce(event, result);
    this.completing.set(eventId, operation);
    try {
      return await operation;
    } finally {
      this.completing.delete(eventId);
    }
  }

  async #completeOnce(event, result) {
    const handler = this.handlers.get(event.type);
    if (!handler) {
      event.status = "queued";
      event.availableAt = this.now() + this.retryDelayMs;
      event.leaseUntil = 0;
      event.lastError = `No page handler is registered for event type ${event.type}`;
      this.#commitChange();
      return {
        status: "retry",
        eventId: event.id,
        retryAfterMs: this.retryDelayMs,
        error: event.lastError,
      };
    }

    event.status = "completing";
    this.#persist();

    try {
      await handler({ event: this.#publicEvent(event), result: clone(result) });
    } catch (error) {
      event.status = "queued";
      event.availableAt = this.now() + this.retryDelayMs;
      event.leaseUntil = 0;
      event.lastError = error instanceof Error ? error.message : String(error);
      this.logger("event.retry", { eventId: event.id, error: event.lastError });
      this.#commitChange();
      return {
        status: "retry",
        eventId: event.id,
        retryAfterMs: this.retryDelayMs,
        error: event.lastError,
      };
    }

    event.status = "completed";
    event.result = clone(result);
    event.completedAt = new Date(this.now()).toISOString();
    event.leaseUntil = 0;
    event.lastError = null;
    this.#trimCompleted();
    this.logger("event.completed", { eventId: event.id });
    this.#commitChange();
    return { status: "completed", eventId: event.id, completedAt: event.completedAt };
  }

  async registerWebMCP(modelContext) {
    if (!modelContext?.registerTool) {
      throw new Error("document.modelContext.registerTool is not available");
    }
    if (this.registeredToolNames) return this.registeredToolNames;

    const names = this.toolNames;
    await modelContext.registerTool({
      name: names.awaitEvent,
      description:
        `Long-poll for the next ${this.name} event for up to ${this.waitTimeoutMs}ms. ` +
        "An event has a stable unique id and remains pending until complete_event succeeds. " +
        "Call this repeatedly; status=idle is normal and means call it again. " +
        "A redelivered event keeps the same id.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true },
      execute: async (_input, options) =>
        JSON.stringify(await this.awaitEvent({ signal: options?.signal })),
    });

    await modelContext.registerTool({
      name: names.completeEvent,
      description:
        `Apply an agent result for a ${this.name} event and mark it complete. ` +
        "Call exactly once after processing each event, before awaiting the next event. " +
        "The call is idempotent by eventId, so retrying the same completion is safe.",
      inputSchema: {
        type: "object",
        properties: {
          eventId: {
            type: "string",
            description: "The exact stable id returned by await_event",
          },
          result: {
            type: "object",
            description: "The structured result required by the event payload and agent instructions",
            additionalProperties: true,
          },
        },
        required: ["eventId", "result"],
        additionalProperties: false,
      },
      execute: async (input) =>
        JSON.stringify(await this.complete(input?.eventId, input?.result)),
    });

    this.registeredToolNames = names;
    this.logger("tools.registered", names);
    return names;
  }

  getAgentPrompt() {
    const { awaitEvent, completeEvent } = this.toolNames;
    return `You are connected to a live page through a reliable duplex event channel.

Your job is to stay in the event loop while the user interacts with the page. The user must not need to message you between page interactions.

Protocol:
1. Call ${awaitEvent} with {}.
2. Parse the returned JSON string.
3. If status is \"idle\", immediately call ${awaitEvent} again. An idle response is a normal heartbeat, not an error.
4. If status is \"cancelled\", stop the loop quietly.
5. If status is \"event\", process exactly that event using its type and payload.
6. Call ${completeEvent} with the exact event.id and a structured result. Do this before awaiting another event.
7. Treat status \"completed\" and \"already_completed\" as success.
8. If completion returns \"retry\", do not invent a new event or use another queue-reading tool. Call ${awaitEvent} again; the page will redeliver unfinished work with the same event id.
9. A repeated event id is a retry, not a new user action. Never create duplicate output for the same id. Retrying ${completeEvent} with the same id is safe.
10. Continue until the user explicitly asks you to stop or browser control is interrupted.

Event-specific instructions:
${this.agentInstructions}

Reliability rules:
- Never fabricate, modify, or reuse an event id for a different event.
- Never acknowledge an event before its result is ready.
- Do not ask the user to tell you when they click; the await tool is the notification mechanism.
- Do not busy-poll. Each idle response already represents a bounded long-poll interval.
- Keep explanations or other outputs scoped to the event payload and the user's page context.`;
  }

  #claimAvailableEvent() {
    const now = this.now();
    const event = this.events.find(
      (candidate) =>
        (candidate.status === "queued" && candidate.availableAt <= now) ||
        (candidate.status === "leased" && candidate.leaseUntil <= now),
    );
    if (!event) return null;

    event.status = "leased";
    event.attempt += 1;
    event.leaseUntil = now + this.leaseMs;
    this.#commitChange();
    return event;
  }

  #nextAvailableAt() {
    let next = null;
    for (const event of this.events) {
      let candidate = null;
      if (event.status === "queued") candidate = event.availableAt;
      if (event.status === "leased") candidate = event.leaseUntil;
      if (candidate !== null && (next === null || candidate < next)) next = candidate;
    }
    return next;
  }

  #waitForChange(timeoutMs, signal) {
    return new Promise((resolve) => {
      let settled = false;
      const finish = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.changeWaiters.delete(finish);
        signal?.removeEventListener("abort", finish);
        resolve();
      };
      const timer = setTimeout(finish, timeoutMs);
      this.changeWaiters.add(finish);
      signal?.addEventListener("abort", finish, { once: true });
    });
  }

  #publicEvent(event) {
    return {
      id: event.id,
      type: event.type,
      payload: clone(event.payload),
      createdAt: event.createdAt,
      attempt: event.attempt,
    };
  }

  #commitChange() {
    this.#persist();
    for (const wake of [...this.changeWaiters]) wake();
    const stats = this.getStats();
    for (const subscriber of this.subscribers) subscriber(stats);
  }

  #trimCompleted() {
    const completed = this.events
      .filter((event) => event.status === "completed")
      .sort((a, b) => String(a.completedAt).localeCompare(String(b.completedAt)));
    const removeCount = completed.length - this.maxCompleted;
    if (removeCount <= 0) return;
    const removeIds = new Set(completed.slice(0, removeCount).map((event) => event.id));
    this.events = this.events.filter((event) => !removeIds.has(event.id));
  }

  #persist() {
    if (!this.storage) return;
    try {
      this.storage.setItem(this.storageKey, JSON.stringify(this.events));
    } catch (error) {
      this.logger("storage.error", error instanceof Error ? error.message : String(error));
    }
  }

  #restore() {
    if (!this.storage) return;
    try {
      const raw = this.storage.getItem(this.storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      this.events = parsed.filter((event) => event && typeof event.id === "string");
      for (const event of this.events) {
        if (event.status === "completing") {
          event.status = "queued";
          event.availableAt = this.now();
          event.leaseUntil = 0;
        }
      }
    } catch (error) {
      this.events = [];
      this.logger("storage.error", error instanceof Error ? error.message : String(error));
    }
  }
}

export const DUPLEX_DEFAULTS = Object.freeze({
  waitTimeoutMs: DEFAULT_WAIT_TIMEOUT_MS,
  leaseMs: DEFAULT_LEASE_MS,
  retryDelayMs: DEFAULT_RETRY_DELAY_MS,
});
