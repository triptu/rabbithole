/**
 * A stand-in agent for development in browsers without WebMCP.
 *
 * It drives the real duplex channel the way a browser agent would — awaitEvent,
 * think, completeEvent — so the whole page-side flow (queue → loading pane → result →
 * store → UI) is exercised without a model. Answers are obviously synthetic.
 */
import type { Agent } from "./agent";
import type { AgentEventType, AnalyzeResult, ElaborateResult, PayloadFor, ShortResult } from "./events";

export interface MockOptions {
  /** how long the "model" takes per event */
  thinkMs?: number;
  signal?: AbortSignal;
  /** called with the event type after each completion */
  onAnswer?: (type: string) => void;
}

const sleep = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      resolve();
    });
  });

export function mockAnswer(type: AgentEventType, payload: unknown): AnalyzeResult | ShortResult | ElaborateResult {
  switch (type) {
    case "document.analyze": {
      const p = payload as PayloadFor<"document.analyze">;
      const source = p.url ?? "pasted text";
      const words = (p.text || "The source had no text the mock could read.")
        .replace(/\s+/g, " ")
        .split(" ")
        .slice(0, 160);
      const chunk = Math.max(1, Math.ceil(words.length / 3));
      const paragraphs = [0, 1, 2]
        .map((i) => words.slice(i * chunk, (i + 1) * chunk).join(" "))
        .filter(Boolean)
        .map((t, i) => (i === 0 ? `${t} This is a [[mock summary]] written by the [[dev mock agent]].` : t));
      return { title: `Mock reading of ${source}`.slice(0, 80), meta: `mock agent · ${source}`, paragraphs };
    }
    case "concept.explain": {
      const p = payload as PayloadFor<"concept.explain">;
      return {
        short: `“${p.term}” is a placeholder explanation from the dev mock agent. In a WebMCP browser your own assistant answers here, tuned to: ${p.reader.profile.slice(0, 60)}…`,
        links: [{ k: "READ", t: `Search: ${p.term}`, u: `https://www.google.com/search?q=${encodeURIComponent(p.term)}` }],
      };
    }
    case "selection.ask": {
      const p = payload as PayloadFor<"selection.ask">;
      return {
        short: p.question
          ? `Mock answer to “${p.question}” about “${p.phrase.slice(0, 40)}”. A real agent would answer from the [[context]] and your goal.`
          : `Mock gloss of “${p.phrase.slice(0, 40)}”. A real agent explains the highlighted phrase in [[context]].`,
        links: [],
      };
    }
    case "concept.elaborate": {
      const p = payload as PayloadFor<"concept.elaborate">;
      return {
        text: p.question
          ? `Mock follow-up on “${p.term}”: you asked “${p.question}”. The real agent continues the thread with the last ${p.history.length} turns in mind.`
          : `Mock elaboration of “${p.term}”: mechanism, then why it matters, in one or two paragraphs — with [[jargon]] marked so you can keep digging.`,
        anec: "Like a stub server: same shape as the real thing, none of the substance.",
        html: null,
      };
    }
  }
}

/** Runs until the signal aborts. Resolves when stopped. */
export async function runMockAgent(agent: Agent, opts: MockOptions = {}): Promise<void> {
  const { thinkMs = 1400, signal, onAnswer } = opts;
  while (!signal?.aborted) {
    const res = await agent.channel.awaitEvent({ signal });
    if (res.status !== "event") continue;
    await sleep(thinkMs, signal);
    if (signal?.aborted) return;
    const result = mockAnswer(res.event.type as AgentEventType, res.event.payload);
    await agent.channel.complete(res.event.id, result);
    onAnswer?.(res.event.type);
  }
}
