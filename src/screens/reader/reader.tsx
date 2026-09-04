/**
 * The reader screen: the "make it readable" stepper while a document loads, then the
 * article pane and its trail of concept panes sliding horizontally.
 */
import { useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import { useReader, useStore, useStoreShallow } from "@/hooks";
import type { DocumentLoading } from "@/sdk";
import { ArticlePane } from "./article-pane";
import { ConceptPane } from "./concept-pane";
import { SelectionPopover, useSelectionCapture } from "./selection-popover";
import { useSlidingPanes } from "./use-sliding-panes";

export function Reader({ agentOpen }: { agentOpen: boolean }) {
  const { docId = "" } = useParams();
  const reader = useReader();
  const navigate = useNavigate();
  const doc = useStore((s) => s.library.documents[docId]);
  const loading = useStore((s) => (s.session.loading?.docId === docId ? s.session.loading : null));

  // reload / deep link: make this document current
  useEffect(() => {
    if (!docId) return;
    if (!reader.open(docId)) navigate("/", { replace: true });
  }, [docId, reader, navigate]);

  if (loading) return <Stepper loading={loading} domain={doc?.domain} />;
  if (!doc) return null;
  return <Panes agentOpen={agentOpen} />;
}

const DEMO_STEPS = ["finding words beyond your top-2000", "tuning explanations to you"];

/** Demo pages replay the three-step stepper; live urls only show the fetch, then the text appears. */
function Stepper({ loading, domain }: { loading: DocumentLoading; domain?: string }) {
  const labels = loading.live ? ["fetching & reading the source"] : [`fetching ${domain ?? ""}`, ...DEMO_STEPS];
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="flex min-w-[300px] animate-fade-up flex-col gap-3.5">
        {labels.map((label, i) => {
          const st = loading.step;
          return (
            <div key={label} className={`flex items-center gap-3 ${i > st ? "opacity-40" : ""}`}>
              {i < st ? (
                <span className="flex size-4 flex-none items-center justify-center rounded-full bg-accent text-[10px] text-white">✓</span>
              ) : i === st ? (
                <span className="box-border size-4 flex-none animate-spin-fast rounded-full border-2 border-line-2 border-t-accent" />
              ) : (
                <span className="box-border size-4 flex-none rounded-full border-2 border-line" />
              )}
              <span className="font-mono text-[12.5px] text-slate">{label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Panes({ agentOpen }: { agentOpen: boolean }) {
  const reader = useReader();
  const doc = useStore((s) => (s.session.docId ? s.library.documents[s.session.docId] : undefined));
  const panes = useStoreShallow((s) => s.session.panes);
  const { scrollerRef, onScroll, goPane, geometry, strips } = useSlidingPanes(panes.length);
  const { onMouseUp } = useSelectionCapture();

  if (!doc) return null;
  return (
    <>
      <div
        ref={scrollerRef}
        data-rh-scroller="1"
        onScroll={(e) => {
          onScroll(e);
          reader.select(null);
        }}
        onMouseUp={onMouseUp}
        className="rh-scroller relative flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden"
      >
        <ArticlePane doc={doc} geometry={geometry(0)} stripVisible={strips[0] ?? false} onStrip={() => goPane(0)} />
        {panes.map((p, j) => (
          <ConceptPane
            key={p.conceptId}
            pane={p}
            index={j}
            geometry={geometry(j + 1)}
            stripVisible={strips[j + 1] ?? false}
            onStrip={() => goPane(j + 1)}
          />
        ))}
        {panes.length === 0 ? (
          <div className="flex min-w-[280px] flex-1 items-center justify-center">
            <div className="text-center text-[13px] leading-[1.7] text-faint">
              click a <span className="rh-term">dotted term</span>
              <br />a pane slides in here →
            </div>
          </div>
        ) : (
          <div className="min-w-spine flex-1" />
        )}
        {agentOpen && <div className="w-drawer flex-none" />}
      </div>
      <SelectionPopover />
    </>
  );
}
