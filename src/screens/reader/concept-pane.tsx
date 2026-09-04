/**
 * A concept pane: TL;DR, the elaboration thread, follow-up composer, references.
 * Everything it shows comes from the store; every action goes through `reader`.
 */
import { useEffect, useRef, useState } from "react";
import { BookmarkIcon, StatusDot } from "@/components/icons";
import { Marked } from "@/components/marked";
import { Button } from "@/components/ui/button";
import { BareInput } from "@/components/ui/input";
import { useReader, useStore, useTicker } from "@/hooks";
import type { Pane } from "@/sdk";
import { Spine } from "./article-pane";
import { PANE_W, type PaneGeometry } from "./use-sliding-panes";

const PHRASES = ["reading around it…", "checking what you already know…", "finding the right analogy…"];
const SLOW_AFTER_MS = 6000;

export function ConceptPane({
  pane,
  index,
  geometry,
  stripVisible,
  onStrip,
}: {
  pane: Pane;
  /** index into session.panes */
  index: number;
  geometry: PaneGeometry;
  stripVisible: boolean;
  onStrip: () => void;
}) {
  const reader = useReader();
  const concept = useStore((s) => s.library.concepts[pane.conceptId]);
  const thread = useStore((s) => s.library.threads[pane.conceptId]?.messages) ?? [];
  const label = concept?.label ?? pane.conceptId;

  return (
    <div
      className="sticky flex flex-none animate-pane-in border-r border-line bg-paper-2 shadow-[-12px_0_24px_rgba(23,26,38,.08)]"
      style={{ width: PANE_W, left: geometry.left, right: geometry.right, zIndex: geometry.z }}
    >
      <Spine label={label} visible={stripVisible} onClick={onStrip} tone="accent" />
      <div data-pane={index} className="box-border h-full min-w-0 flex-1 overflow-auto px-9 pt-[26px] pb-8">
        <div className="flex items-center justify-between gap-2">
          <h2 className="m-0 min-w-0 flex-1 text-[21px] font-bold tracking-[-0.01em] text-ink">{label}</h2>
          <button onClick={() => reader.toggleConceptBookmark(pane.conceptId)} title="Bookmark this concept" className="flex border-none bg-transparent p-1">
            <BookmarkIcon on={concept?.bookmarked ?? false} />
          </button>
          <button onClick={() => reader.popTo(index)} className="border-none bg-transparent px-1 py-0.5 text-[15px] text-faint">
            ×
          </button>
        </div>

        {pane.status === "loading" && <Loading pane={pane} index={index} />}

        {concept?.question && (
          <div className="mt-3 rounded-lg bg-panel px-3 py-[9px] text-[12px] leading-[1.5] text-slate">
            <span className="text-faint">you asked:</span> {concept.question}
          </div>
        )}

        {pane.status === "error" && (
          <div className="mt-[18px] rounded-[10px] border border-danger-line bg-danger-bg p-3.5">
            <div className="text-[12.5px] leading-[1.5] text-danger">{pane.error ?? "That one stumped the explainer."}</div>
            <Button variant="primary" size="sm" className="mt-2.5" onClick={() => reader.retry(index)}>
              Retry
            </Button>
          </div>
        )}

        {pane.status === "ready" && concept && (
          <div className="animate-fade-up">
            <div className="rh-kicker mt-4 mb-1.5 text-accent">TL;DR</div>
            <p className="m-0 text-[14px] leading-[1.65] text-ink-3 [text-wrap:pretty]">
              <Marked text={concept.short} fromIndex={index} />
            </p>

            {thread.map((m) => (
              <div key={m.id} className="animate-fade-up">
                {m.q ? (
                  <div className="mt-4 text-[12px] leading-[1.5] text-muted">
                    <span className="text-line-2">↳</span> {m.q}
                  </div>
                ) : (
                  <div className="rh-kicker mt-4 text-accent">FULL PICTURE</div>
                )}
                <p className="mt-1.5 mb-0 text-[13.5px] leading-[1.65] text-ink-3 [text-wrap:pretty]">
                  <Marked text={m.text} fromIndex={index} />
                </p>
                {m.anec && <Analogy text={m.anec} />}
                {m.html && (
                  <iframe
                    title="visual"
                    srcDoc={m.html}
                    sandbox=""
                    className="mt-3 box-border h-[230px] w-full rounded-[10px] border border-line bg-paper"
                  />
                )}
              </div>
            ))}

            {pane.busy && (
              <div className="mt-3.5 animate-pulse-fast font-mono text-[11px] text-accent">
                {thread.length ? "digging…" : "finding the right analogy…"}
              </div>
            )}

            {!pane.busy && thread.length === 0 && <StartControls pane={pane} index={index} />}
            {!pane.busy && thread.length > 0 && <FollowUp index={index} />}

            {concept.links.length > 0 && (
              <div className="mt-[18px] flex flex-col gap-1.5 border-t border-line pt-3">
                <div className="rh-kicker">EXTERNAL REFERENCES</div>
                {concept.links.map((lk, i) => (
                  <a
                    key={i}
                    href={lk.u}
                    target="_blank"
                    rel="noopener"
                    className="flex items-center gap-2 text-[12px] text-slate no-underline hover:text-accent"
                  >
                    <span className="rounded bg-accent-soft px-[5px] py-0.5 font-mono text-[9px] font-bold tracking-normal text-accent">{lk.k}</span>
                    {lk.t}
                  </a>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Shimmer, rotating phrase, and the "handed to your agent · 1.4s" line. */
function Loading({ pane, index }: { pane: Pane; index: number }) {
  const live = useStore((s) => s.agent.available || s.agent.mock);
  const request = useStore((s) => (pane.requestId ? s.agent.requests[pane.requestId] : undefined));
  const now = useTicker(true);
  const elapsed = ((now - pane.startedAt) / 1000).toFixed(1);
  const slow = !!pane.requestId && now - pane.startedAt > SLOW_AFTER_MS;
  const handoff = !pane.requestId ? "explaining" : request?.status === "inflight" ? "your agent is on it" : live ? "handed to your agent" : "waiting for an agent";

  return (
    <div className="mt-[18px] flex flex-col gap-2.5">
      <div className="rh-shimmer w-[90%]" />
      <div className="rh-shimmer w-full" />
      <div className="rh-shimmer w-[70%]" />
      <div className="mt-2 animate-pulse-soft font-mono text-[11px] text-faint">{PHRASES[(index + 1) % PHRASES.length]}</div>
      <div className="mt-1.5 flex items-center gap-2 font-mono text-[10.5px] text-muted">
        <StatusDot on breathe size={6} />
        <span>{handoff}</span>
        <span className="text-line-2">{elapsed}s</span>
      </div>
      {slow && (
        <div className="mt-2 rounded-lg bg-panel px-2.5 py-2 text-[11.5px] leading-[1.5] text-muted">
          {live
            ? "Taking a while — tell your agent “check Rabbithole’s requests” if it went idle."
            : "No agent is connected. Open this page in a WebMCP browser, or run the mock agent from the agent drawer."}
        </div>
      )}
      {request?.error && <div className="text-[11px] leading-[1.5] text-rust">last answer rejected: {request.error}</div>}
    </div>
  );
}

function Analogy({ text }: { text: string }) {
  const role = useStore((s) => s.profile.role);
  const who = role.split(/[—,(:]/)[0]?.trim().toLowerCase();
  return (
    <div className="mt-3 rounded-[10px] bg-ink px-3.5 py-3">
      <div className="mb-[5px] font-mono text-[10px] text-accent-light">// analogy{who ? `: ${who}` : ""}</div>
      <div className="font-mono text-[11.5px] leading-[1.6] text-dark-text">{text}</div>
    </div>
  );
}

/** "Elaborate" + "focus on…" before the thread starts. */
function StartControls({ pane, index }: { pane: Pane; index: number }) {
  const reader = useReader();
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (pane.focusOpen) inputRef.current?.focus();
  }, [pane.focusOpen]);

  const go = () => reader.elaborate(index, inputRef.current?.value.trim() || undefined);

  if (!pane.focusOpen) {
    return (
      <div className="mt-3 flex items-center gap-3">
        <Button variant="primary" size="sm" onClick={go}>
          Elaborate
        </Button>
        <button
          onClick={() => reader.setFocusOpen(index, true)}
          className="border-none bg-transparent p-0 text-[11.5px] text-faint underline decoration-dotted underline-offset-[3px] hover:text-accent"
        >
          focus on…
        </button>
      </div>
    );
  }
  return (
    <div className="mt-3 flex items-center gap-1.5 rounded-full border border-line bg-paper py-[3px] pr-1.5 pl-3.5">
      <BareInput
        ref={inputRef}
        placeholder="what should it focus on? e.g. why not just use a mutex"
        onKeyDown={(e) => {
          if (e.key === "Enter") go();
          if (e.key === "Escape") {
            e.stopPropagation();
            reader.setFocusOpen(index, false);
          }
        }}
        onBlur={(e) => !e.target.value.trim() && reader.setFocusOpen(index, false)}
      />
      <Button variant="ghost" size="xs" onClick={go}>
        ↵
      </Button>
    </div>
  );
}

/** "keep digging — ask a follow-up…" */
function FollowUp({ index }: { index: number }) {
  const reader = useReader();
  const [value, setValue] = useState("");
  const send = () => {
    const q = value.trim();
    if (!q) return;
    setValue("");
    reader.elaborate(index, q);
  };
  return (
    <div className="mt-3.5 flex items-center gap-1.5 rounded-full border border-line bg-paper py-[3px] pr-1.5 pl-3.5">
      <BareInput value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder="keep digging — ask a follow-up…" />
      <Button variant="ghost" size="xs" onClick={send}>
        ↵
      </Button>
    </div>
  );
}
