/**
 * Shell: router, top bar, screens, and the overlays that float above every screen.
 *
 *   /              Home       paste a link or text, pick a suggestion, resume
 *   /read/:docId   Reader     the sliding panes
 *   /history       History    pages and concepts you've decoded
 *   /profile       Profile    the agent's picture of you
 *   /about         About      what this is and how the agent link works
 */
import { useEffect, useRef } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation, useNavigate } from "react-router";
import { AgentDrawer } from "@/components/agent-drawer";
import { Wordmark } from "@/components/icons";
import { AgentSaying, Toast } from "@/components/toast";
import { TopBar } from "@/components/top-bar";
import { useReader, useStore } from "@/hooks";
import { History } from "@/screens/history";
import { Home } from "@/screens/home";
import { Profile } from "@/screens/profile";
import { Reader } from "@/screens/reader/reader";
import { About } from "@/screens/about";

export function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}

function Shell() {
  const booted = useStore((s) => s.booted);
  const agentOpen = useStore((s) => s.session.drawerOpen);
  const reader = useReader();
  useRouteSync();
  usePaneKeys();
  useSharedTrail(booted);

  if (!booted) return <Boot />;

  return (
    <div className="flex h-screen flex-col overflow-hidden">
      <TopBar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/read/:docId" element={<Reader agentOpen={agentOpen} />} />
        <Route path="/history" element={<History />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {agentOpen && <AgentDrawer onClose={() => reader.setDrawerOpen(false)} />}
      <AgentSaying />
      <Toast />
    </div>
  );
}

function Boot() {
  return (
    <div className="flex h-screen items-center justify-center">
      <span className="animate-pulse-fast">
        <Wordmark size={22} />
      </span>
    </div>
  );
}

/**
 * Keeps the URL and `session.docId` in step. The sdk sets docId (a click, or the
 * agent calling rabbithole_open); the URL follows. Reloading /read/:id goes the other
 * way inside <Reader/>.
 */
function useRouteSync() {
  const docId = useStore((s) => s.session.docId);
  const navigate = useNavigate();
  const location = useLocation();
  const prev = useRef(docId);
  useEffect(() => {
    if (docId === prev.current) return;
    prev.current = docId;
    const onReader = location.pathname.startsWith("/read/");
    if (docId && location.pathname !== `/read/${docId}`) navigate(`/read/${docId}`);
    else if (!docId && onReader) navigate("/");
  }, [docId, location.pathname, navigate]);
}

/** Esc / Backspace outside an input closes the rightmost pane. */
function usePaneKeys() {
  const reader = useReader();
  const location = useLocation();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" && e.key !== "Backspace") return;
      const t = e.target as HTMLElement;
      const tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || t.isContentEditable) return;
      if (!location.pathname.startsWith("/read/")) return;
      e.preventDefault();
      reader.popLast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reader, location.pathname]);
}

/** `/#trail=…` links: open the shared document and replay its panes. */
function useSharedTrail(booted: boolean) {
  const reader = useReader();
  const navigate = useNavigate();
  useEffect(() => {
    if (!booted || !location.hash.includes("trail=")) return;
    const hash = location.hash;
    history.replaceState(null, "", location.pathname);
    void reader.openSharedTrail(hash).then((docId) => docId && navigate(`/read/${docId}`));
  }, [booted, reader, navigate]);
}
