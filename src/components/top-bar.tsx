import { useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { BookmarkIcon, StatusDot, Wordmark } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { initial, useReader, useStore } from "@/hooks";
import { currentDocument } from "@/sdk";

export function TopBar({ agentOpen, onToggleAgent }: { agentOpen: boolean; onToggleAgent: () => void }) {
  const reader = useReader();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const doc = useStore(currentDocument);
  const role = useStore((s) => s.profile.role);
  const onReader = pathname.startsWith("/read/");
  const onHistory = pathname === "/history";
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

      {onReader && (
        <Button variant="outline" size="nav" onClick={goHome}>
          + new
        </Button>
      )}
      <AgentPill open={agentOpen} onClick={onToggleAgent} />
      <Button variant="nav" size="nav" on={onHistory} onClick={() => navigate("/history")}>
        History
      </Button>
      <button
        onClick={() => navigate("/profile")}
        title="Your profile"
        data-on={onProfile}
        className="ml-1 flex size-7 flex-none items-center justify-center rounded-full border-none bg-ink text-[11px] font-bold text-accent-light data-[on=true]:shadow-[0_0_0_2px_#fff,0_0_0_4px_var(--color-accent)]"
      >
        {initial(role)}
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

/** The "agent linked" pill: breathing dot when linked or recently busy. */
function AgentPill({ open, onClick }: { open: boolean; onClick: () => void }) {
  const available = useStore((s) => s.agent.available);
  const mock = useStore((s) => s.agent.mock);
  const lastCallAt = useStore((s) => s.agent.lastCallAt);
  const busy = lastCallAt !== null && Date.now() - lastCallAt < 4000;
  const live = available || mock;
  return (
    <button
      onClick={onClick}
      title="WebMCP agent link — tools this page exposes to your browser agent"
      data-open={open}
      data-live={live}
      className="flex items-center gap-2 rounded-full border border-line bg-transparent py-[5px] pr-3 pl-[9px] text-[11.5px] font-semibold text-slate hover:border-accent data-[live=true]:border-accent data-[open=true]:bg-panel"
    >
      <StatusDot size={7} on={live || busy} />
      {available ? "agent linked" : mock ? "mock agent" : "agent"}
    </button>
  );
}
