import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { GithubIcon } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { dateLabel, useReader, useStoreShallow } from "@/hooks";
import { DEMO_SUGGESTIONS, GITHUB_URL, visitedDocuments } from "@/sdk";

export function Home() {
  const reader = useReader();
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [paste, setPaste] = useState("");
  const recents = useStoreShallow((s) => visitedDocuments(s).slice(0, 5));

  /** the link field wins when both are filled; empty input is a no-op with a hint */
  const submit = async (value: string) => {
    if (!value.trim()) return reader.toast("Paste a link or some text first.");
    const docId = await reader.openInput(value);
    if (docId) navigate(`/read/${docId}`);
  };

  return (
    <div className="flex flex-1 flex-col items-center overflow-auto px-6 pt-16 pb-12">
      <div className="flex w-full max-w-[640px] animate-fade-up-400 flex-col">
        <h1 className="m-0 font-serif text-[42px] leading-[1.15] font-medium text-ink [text-wrap:pretty]">What are we untangling today?</h1>
        <p className="mt-3 mb-6 text-[14px] leading-[1.6] text-muted [text-wrap:pretty]">
          Dense documents are hard to read, even in your own field. Research papers, articles, lab results, tax forms, unfamiliar code. Rabbithole lets you zoom in on the parts you don't understand and the explaining is done by your personal assistant aware about your context. More details in{" "}
          <Link to="/about" className="text-slate underline decoration-dotted underline-offset-[3px] hover:text-accent">
            About
          </Link>{" "}
          and on{" "}
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="text-slate underline decoration-dotted underline-offset-[3px] hover:text-accent">
            Github
          </a>
        </p>

        {/*<div className="mb-2.5 flex items-center gap-2">
          <span className="rh-kicker flex-none">GOAL</span>
          <Input
            value={goal}
            onChange={(e) => reader.setGoal(e.target.value)}
            placeholder="why are you reading? e.g. deciding if we should adopt this — shapes every explanation"
          />
        </div>*/}
        <Input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit(url)}
          placeholder="https:// — blog post, wikipedia, any article"
          className="mb-2.5 rounded-xl px-4 py-[13px] font-mono text-[13px]"
        />
        <Textarea
          rows={5}
          value={paste}
          onChange={(e) => setPaste(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.metaKey || e.ctrlKey) && submit(paste)}
          placeholder="…or paste a wall of text here"
        />
        <div className="mt-3 flex items-center gap-2.5">
          <Button variant="primary" size="lg" onClick={() => submit(url.trim() || paste)}>
            make it readable
          </Button>
          <span className="text-[11.5px] text-faint">⌘↵ works too</span>
        </div>

        <div className="rh-kicker mt-9 mb-3 text-[10.5px] tracking-[0.12em]">SUGGESTED RABBIT HOLES</div>
        <div className="flex flex-wrap gap-2">
          {DEMO_SUGGESTIONS.map((sg) => (
            <Button
              key={sg.label}
              variant="pill"
              size="pill"
              onClick={() => (sg.demo ? reader.demoRun() : sg.docId ? reader.open(sg.docId) : submit(sg.url ?? ""))}
            >
              {sg.label} <span className="font-mono text-[9.5px] text-faint">{sg.tag}</span>
            </Button>
          ))}
        </div>

        {recents.length > 0 && <div className="rh-kicker mt-9 mb-3 text-[10.5px] tracking-[0.12em]">PICK UP WHERE YOU LEFT OFF</div>}
        <div className="flex flex-col gap-2">
          {recents.map((r) => (
            <div
              key={r.id}
              onClick={() => reader.open(r.id)}
              className="rh-card flex cursor-pointer items-center gap-3.5 px-4 py-3.5 hover:border-accent"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-serif text-[16.5px] text-ink">{r.title}</div>
                <div className="mt-[3px] text-[11.5px] text-faint">
                  {r.domain} · {r.termCount} terms decoded · {dateLabel(r.openedAt!)}
                </div>
              </div>
              <span className="text-[15px] text-accent">›</span>
            </div>
          ))}
        </div>

        <div className="mt-10 flex items-center gap-4 text-[11.5px] text-faint">
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-faint no-underline hover:text-accent">
            <GithubIcon size={13} /> triptu/rabbithole
          </a>
          <Link to="/about" className="text-faint no-underline hover:text-accent">
            about
          </Link>
        </div>
      </div>
    </div>
  );
}
