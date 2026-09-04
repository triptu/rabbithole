import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { BookmarkIcon, SettingsIcon, StatusDot, Wordmark } from "@/components/icons";
import { PromptCard } from "@/components/prompt-card";
import { Button } from "@/components/ui/button";
import { useReader, useStore } from "@/hooks";
import { currentDocument, type LinkStatus } from "@/sdk";

export function TopBar() {
  const reader = useReader();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const doc = useStore(currentDocument);
  const drawerOpen = useStore((s) => s.session.drawerOpen);
  const onReader = pathname.startsWith("/read/");
  const onHome = pathname === "/";
  const onHistory = pathname === "/history";
  const onAbout = pathname === "/about";
  const onProfile = pathname === "/profile";

  const goHome = () => {
    reader.close();
    navigate("/");
  };
  const share = () => {
    const url = reader.shareLink();
    if (!url) return;
    const done = () => reader.toast("Link copied — same rabbit hole, explained in their language.");
    if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, done);
    else done();
  };

  return (
    <div className="flex h-topbar flex-none items-center gap-2 border-b border-line bg-paper pr-4 pl-5">
      <button onClick={goHome} className="border-none bg-transparent px-0.5 py-1">
        <Wordmark />
      </button>

      {onReader && doc && (
        <div className="ml-2.5 flex min-w-0 items-center gap-2 border-l border-line pl-[18px]">
          <span className="max-w-[340px] truncate text-[12.5px] text-slate">{doc.title}</span>
          <span className="whitespace-nowrap font-mono text-[10.5px] text-faint">{doc.domain}</span>
          <button onClick={() => reader.toggleDocumentBookmark(doc.id)} title="Bookmark this page" className="flex border-none bg-transparent p-1">
            <BookmarkIcon on={doc.bookmarked} size={15} />
          </button>
          <button
            onClick={share}
            title="Share this rabbit hole — whoever opens it gets the same trail, explained in their language"
            className="flex border-none bg-transparent p-1 text-faint hover:text-accent"
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M10 14L14 10" />
              <path d="M8.5 15.5l-2 2a3.5 3.5 0 01-5-5l2-2" />
              <path d="M15.5 8.5l2-2a3.5 3.5 0 015 5l-2 2" />
            </svg>
          </button>
          <GoalChip />
        </div>
      )}

      <div className="flex-1" />

      <AgentPill open={drawerOpen} onToggle={() => reader.setDrawerOpen(!drawerOpen)} />
      {(onHome || onAbout) && (
        <Button variant="nav" size="nav" on={onAbout} onClick={() => navigate("/about")}>
          About
        </Button>
      )}
      <Button variant="nav" size="nav" on={onHistory} onClick={() => navigate("/history")}>
        History
      </Button>
      <button
        onClick={() => navigate("/profile")}
        title="Your profile — what the agent knows about you"
        data-on={onProfile}
        className="ml-1 flex size-7 flex-none items-center justify-center rounded-full border-none bg-transparent text-slate hover:bg-panel hover:text-ink data-[on=true]:bg-panel data-[on=true]:text-ink"
      >
        <SettingsIcon />
      </button>
    </div>
  );
}

/** "+ set goal" pill that turns into an inline input. */
function GoalChip() {
  const reader = useReader();
  const goal = useStore((s) => s.profile.goal);
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <input
        autoFocus
        value={goal}
        onChange={(e) => reader.setGoal(e.target.value)}
        onKeyDown={(e) => (e.key === "Enter" || e.key === "Escape") && setEditing(false)}
        onBlur={() => setEditing(false)}
        placeholder="your goal…"
        className="w-60 rounded-full border border-accent bg-panel px-3 py-[5px] text-[11.5px] text-ink"
      />
    );
  }
  return (
    <Button
      variant="dashed"
      size="sm"
      title="Reading goal — shapes explanations"
      className="max-w-[260px] overflow-hidden text-ellipsis whitespace-nowrap px-3 py-[5px] text-[11.5px]"
      onClick={() => setEditing(true)}
    >
      <span className="truncate">{goal ? `goal: ${goal}` : "+ set goal"}</span>
    </Button>
  );
}

/** idle and polling share a label — the dot (grey vs accent) tells them apart */
const PILL_LABEL: Record<LinkStatus, string> = {
  unavailable: "unavailable",
  idle: "agent",
  polling: "agent",
  disconnected: "agent disconnected",
};

/**
 * The link-status pill. Grey dot: WebMCP tools registered, nobody polling yet. Accent
 * dot: an agent is in the await_event loop. "disconnected": it was and stopped —
 * clicking that opens an explainer with the reconnect prompt instead of the drawer.
 * Never blinks.
 */
function AgentPill({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const link = useStore((s) => s.agent.link);
  const mock = useStore((s) => s.agent.mock);
  const status: LinkStatus = mock ? "polling" : link;
  const [explain, setExplain] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);

  // close the explainer on outside click, or once the link recovers
  useEffect(() => {
    if (!explain) return;
    const onDown = (e: MouseEvent) => !wrap.current?.contains(e.target as Node) && setExplain(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [explain]);
  useEffect(() => {
    if (status !== "disconnected") setExplain(false);
  }, [status]);

  return (
    <div ref={wrap} className="relative">
      <button
        onClick={() => (status === "disconnected" ? setExplain((v) => !v) : onToggle())}
        title={
          status === "unavailable"
            ? "No WebMCP in this browser — open the drawer to run a mock agent"
            : status === "idle"
              ? "WebMCP tools registered — waiting for an agent to start polling"
              : status === "polling"
                ? "Your agent is in the loop"
                : "Your agent stopped polling"
        }
        data-open={open}
        data-status={status}
        className="flex items-center gap-2 rounded-full border border-line bg-transparent py-[5px] pr-3 pl-[9px] text-[11.5px] font-semibold text-slate hover:border-accent data-[open=true]:bg-panel data-[status=disconnected]:border-rust data-[status=disconnected]:text-rust data-[status=polling]:border-accent"
      >
        <StatusDot tone={status === "polling" ? "accent" : status === "disconnected" ? "rust" : "idle"} size={7} />
        {mock ? "mock agent" : PILL_LABEL[status]}
      </button>
      {explain && <LinkExplainer onDrawer={() => (setExplain(false), onToggle())} />}
    </div>
  );
}

/** Why the pill says disconnected, and the prompt that brings the agent back. */
function LinkExplainer({ onDrawer }: { onDrawer: () => void }) {
  const prompt = useStore((s) => s.agent.reconnectPrompt);
  return (
    <div className="absolute top-[calc(100%+8px)] right-0 z-40 w-[340px] animate-pop-fade rounded-xl bg-ink px-4 py-3.5 text-[12.5px] leading-[1.55] text-dark-text shadow-[0_10px_30px_rgba(23,26,38,.28)]">
      <div className="mb-1 font-mono text-[10px] tracking-[0.1em] text-rust">AGENT DISCONNECTED</div>
      Your agent stopped polling for work, so clicks won’t be answered until it comes back. Paste this into it to pick the loop up again:
      <div className="mt-2.5 mb-2.5">
        <PromptCard text={prompt} label="RECONNECT PROMPT" dark />
      </div>
      <button onClick={onDrawer} className="border-none bg-transparent p-0 text-[11.5px] text-dark-muted underline decoration-dotted underline-offset-2 hover:text-dark-text">
        open agent link
      </button>
    </div>
  );
}
