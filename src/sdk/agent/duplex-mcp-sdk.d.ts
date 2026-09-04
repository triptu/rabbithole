/**
 * Types for duplex-mcp-sdk.js — the at-least-once page ↔ agent event channel from
 * the duplex WebMCP prototype. The .js is kept verbatim; only these typings are ours.
 */

export interface DuplexEvent<P = unknown> {
  id: string;
  type: string;
  payload: P;
  createdAt: string;
  attempt: number;
}

export interface DuplexStats {
  queued: number;
  inflight: number;
  completed: number;
}

export type AwaitResult =
  | { status: "event"; event: DuplexEvent }
  | { status: "idle"; retryAfterMs: number }
  | { status: "cancelled" };

export type CompleteResult =
  | { status: "completed"; eventId: string; completedAt: string }
  | { status: "already_completed"; eventId: string; completedAt: string | null }
  | { status: "retry"; eventId: string; retryAfterMs: number; error: string }
  | { status: "unknown_event"; eventId: string }
  | { status: "invalid"; error: string };

export type DuplexHandler<P = unknown, R = unknown> = (args: {
  event: DuplexEvent<P>;
  result: R;
}) => void | Promise<void>;

export type DuplexLogName =
  | "event.queued"
  | "event.delivered"
  | "event.retry"
  | "event.completed"
  | "tools.registered"
  | "storage.error";

export interface DuplexStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The subset of WebMCP's modelContext the channel needs. */
export interface ModelContextLike {
  registerTool(tool: {
    name: string;
    description: string;
    inputSchema: object;
    annotations?: object;
    execute: (input: unknown, options?: { signal?: AbortSignal }) => Promise<string> | string;
  }): Promise<void> | void;
}

export interface DuplexOptions {
  name?: string;
  toolPrefix?: string;
  waitTimeoutMs?: number;
  leaseMs?: number;
  retryDelayMs?: number;
  maxCompleted?: number;
  storage?: DuplexStorage | null;
  storageKey?: string;
  idFactory?: () => string;
  now?: () => number;
  logger?: (name: DuplexLogName, detail: unknown) => void;
  agentInstructions?: string;
}

export class DuplexWebMCP {
  constructor(options?: DuplexOptions);
  readonly toolNames: { awaitEvent: string; completeEvent: string };
  on<P = unknown, R = unknown>(type: string, handler: DuplexHandler<P, R>): () => void;
  subscribe(listener: (stats: DuplexStats) => void): () => void;
  getStats(): DuplexStats;
  emit<P = unknown>(type: string, payload: P, options?: { dedupeKey?: string }): DuplexEvent<P>;
  awaitEvent(options?: { signal?: AbortSignal }): Promise<AwaitResult>;
  complete(eventId: string, result: unknown): Promise<CompleteResult>;
  registerWebMCP(modelContext: ModelContextLike): Promise<{ awaitEvent: string; completeEvent: string }>;
  getAgentPrompt(): string;
}

export const DUPLEX_DEFAULTS: Readonly<{ waitTimeoutMs: number; leaseMs: number; retryDelayMs: number }>;
