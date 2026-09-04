import { StatusDot } from "@/components/icons";
import { useStore } from "@/hooks";
import { annotationPending, type Document } from "@/sdk";
import { Blocks } from "./blocks";
import { PANE_W, type PaneGeometry } from "./use-sliding-panes";

/** The leftmost, sticky pane: the document itself. */
export function ArticlePane({
  doc,
  geometry,
  stripVisible,
  onStrip,
}: {
  doc: Document;
  geometry: PaneGeometry;
  stripVisible: boolean;
  onStrip: () => void;
}) {
  return (
    <div
      className="sticky flex flex-none border-r border-line bg-paper shadow-[0_0_24px_rgba(23,26,38,.08)]"
      style={{ width: PANE_W, left: 0, right: geometry.right, zIndex: geometry.z }}
    >
      <Spine label={doc.title} visible={stripVisible} onClick={onStrip} tone="muted" />
      <div data-pane={-1} className="box-border h-full min-w-0 flex-1 overflow-auto px-12 py-10">
        <div className="font-mono text-[10.5px] text-faint">{doc.meta}</div>
        <h1 className="mt-3 mb-6 font-serif text-[31px] font-medium text-ink">{doc.title}</h1>
        <MarkingStatus doc={doc} />
        <Blocks blocks={doc.blocks} />
      </div>
    </div>
  );
}

/**
 * While the agent decides which words to highlight the text is already readable;
 * this line says what is happening (and what to do if no agent is linked).
 */
function MarkingStatus({ doc }: { doc: Document }) {
  const pending = useStore((s) => annotationPending(s, doc.id));
  const link = useStore((s) => (s.agent.mock ? "polling" : s.agent.link));
  if (!pending || doc.annotated) return null;
  const waiting = link !== "polling";
  return (
    <div className="-mt-3 mb-5 flex items-center gap-2 font-mono text-[10.5px] text-muted">
      <StatusDot breathe={!waiting} tone={waiting ? "idle" : "accent"} size={6} />
      <span className={waiting ? "" : "animate-pulse-soft"}>
        {waiting ? "no agent polling yet — terms get highlighted once one joins (see the agent pill)" : "finding words beyond your top-2000…"}
      </span>
    </div>
  );
}

/** The vertical title strip a pane collapses to. */
export function Spine({ label, visible, onClick, tone }: { label: string; visible: boolean; onClick: () => void; tone: "muted" | "accent" }) {
  return (
    <div
      onClick={onClick}
      title={label}
      className={`absolute top-0 bottom-0 left-0 z-[5] box-border flex w-spine cursor-pointer items-start justify-center border-r border-line py-[18px] transition-opacity duration-250 ${
        tone === "muted" ? "bg-paper" : "bg-paper-2"
      } ${visible ? "opacity-100" : "pointer-events-none opacity-0"}`}
    >
      <span
        className={`overflow-hidden whitespace-nowrap text-[12px] font-semibold tracking-[0.04em] [writing-mode:vertical-rl] ${
          tone === "muted" ? "text-muted" : "text-accent"
        }`}
      >
        {label}
      </span>
    </div>
  );
}
