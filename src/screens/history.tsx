import { useState } from "react";
import { useNavigate } from "react-router";
import { BookmarkIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { dateLabel, useReader, useStore, useStoreShallow } from "@/hooks";
import { strip, visitedConcepts, visitedDocuments } from "@/sdk";

type Tab = "pages" | "concepts";

export function History() {
  const reader = useReader();
  const navigate = useNavigate();
  const documents = useStore((s) => s.library.documents);
  const concepts = useStore((s) => s.library.concepts);
  const pages = useStoreShallow(visitedDocuments);
  const decoded = useStoreShallow(visitedConcepts);
  const [tab, setTab] = useState<Tab>("pages");
  const [q, setQ] = useState("");
  const [onlyBm, setOnlyBm] = useState(false);
  const [desc, setDesc] = useState(true);

  const needle = q.trim().toLowerCase();
  const labelFor = (id: string) => concepts[id]?.label;

  // visited lists arrive newest first; "oldest ↑" just reverses them
  const ordered = <T,>(rows: T[]) => (desc ? rows : [...rows].reverse());
  const pageRows = ordered(pages.filter((d) => (!needle || d.title.toLowerCase().includes(needle)) && (!onlyBm || d.bookmarked)));
  const conceptRows = ordered(decoded.filter((c) => (!needle || c.label.toLowerCase().includes(needle)) && (!onlyBm || c.bookmarked)));

  const open = (docId: string, conceptId?: string) => {
    if (reader.open(docId, { conceptId })) navigate(`/read/${docId}`);
  };

  const tabClass = (on: boolean) =>
    `-mb-px border-0 border-b-2 bg-transparent px-3.5 py-2.5 text-[13px] font-semibold ${on ? "border-accent text-ink" : "border-transparent text-faint"}`;

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="mx-auto max-w-[760px] animate-fade-up-350">
        <h1 className="mt-0 mb-5 font-serif text-[32px] font-medium text-ink">Your trail</h1>
        <div className="mb-4 flex gap-1 border-b border-line">
          <button className={tabClass(tab === "pages")} onClick={() => setTab("pages")}>
            Pages · {pages.length}
          </button>
          <button className={tabClass(tab === "concepts")} onClick={() => setTab("concepts")}>
            Concepts · {decoded.length}
          </button>
        </div>
        <div className="mb-4 flex gap-2">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter…" className="rounded-lg py-2" />
          <Button variant="chip" size="md" on={onlyBm} className="rounded-lg" onClick={() => setOnlyBm((v) => !v)}>
            <svg width="13" height="13" viewBox="0 0 24 24">
              <path d="M6 3h12v18l-6-4-6 4z" fill="currentColor" />
            </svg>
            bookmarked
          </Button>
          <Button variant="outline" size="md" className="bg-paper hover:text-slate" onClick={() => setDesc((v) => !v)}>
            {desc ? "newest ↓" : "oldest ↑"}
          </Button>
        </div>

        {tab === "pages" && (
          <div className="flex flex-col gap-2">
            {pageRows.map((r) => (
              <div key={r.id} onClick={() => open(r.id)} className="rh-card flex cursor-pointer items-center gap-3.5 px-4 py-3.5 hover:border-accent">
                <div className="min-w-0 flex-1">
                  <div className="font-serif text-[17px] text-ink">{r.title}</div>
                  <div className="mt-[3px] text-[11.5px] text-faint">
                    {r.domain} · {r.termCount} terms decoded · {dateLabel(r.openedAt!)}
                  </div>
                </div>
                <button
                  onClick={(e) => (e.stopPropagation(), reader.toggleDocumentBookmark(r.id))}
                  className="flex border-none bg-transparent p-[5px]"
                >
                  <BookmarkIcon on={r.bookmarked} />
                </button>
              </div>
            ))}
          </div>
        )}
        {tab === "concepts" && (
          <div className="flex flex-col gap-2">
            {conceptRows.map((r) => (
              <div key={r.id} onClick={() => open(r.docId, r.id)} className="rh-card flex cursor-pointer items-center gap-3.5 px-4 py-3 hover:border-accent">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-[14px] font-bold text-accent">{r.label}</span>
                    <span className="text-[11px] text-faint">
                      {documents[r.docId]?.title ?? "pasted text"} · {dateLabel(r.openedAt!)}
                    </span>
                  </div>
                  <div className="mt-[3px] truncate text-[12px] text-slate">{strip(r.short, labelFor)}</div>
                </div>
                <button
                  onClick={(e) => (e.stopPropagation(), reader.toggleConceptBookmark(r.id))}
                  className="flex border-none bg-transparent p-[5px]"
                >
                  <BookmarkIcon on={r.bookmarked} />
                </button>
              </div>
            ))}
          </div>
        )}
        {(tab === "pages" ? pageRows : conceptRows).length === 0 && (
          <div className="py-12 text-center text-[13px] text-faint">nothing matches — clear the filter or the bookmark toggle</div>
        )}
      </div>
    </div>
  );
}
