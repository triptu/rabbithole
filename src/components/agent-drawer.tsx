/**
 * The "Agent link" drawer: which WebMCP tools this page exposes, the work waiting
 * for the agent, and a live log of every tool call. In browsers without WebMCP it
 * offers a dev mock agent that answers events through the same duplex tools.
 */
import { useState } from "react";
import { StatusDot } from "@/components/icons";
import { Button } from "@/components/ui/button";
import { clockLabel, useRabbithole, useStore, useStoreShallow } from "@/hooks";

const LOG_TONE = { tool: "text-accent", event: "text-muted", error: "text-rust" } as const;

export function AgentDrawer({ onClose }: { onClose: () => void }) {
  const agent = useStore((s) => s.agent);
  const pending = agent.stats.queued + agent.stats.inflight;
  const hot = useStoreShallow((s) => new Set(s.agent.log.map((e) => e.name)));
  const live = agent.available || agent.mock;
  const busy = agent.lastCallAt !== null && Date.now() - agent.lastCallAt < 4000;

  return (
    <div className="fixed top-topbar right-0 bottom-0 z-30 flex w-drawer animate-slide-left flex-col border-l border-line bg-paper shadow-[-12px_0_32px_rgba(23,26,38,.08)]">
      <div className="flex items-center gap-2.5 border-b border-line px-[18px] pt-4 pb-3">
        <StatusDot on={live || busy} />
        <div className="flex-1">
          <div className="text-[13px] font-bold text-ink">Agent link</div>
          <div className="font-mono text-[10.5px] text-faint">
            {agent.available
              ? `modelContext · ${agent.tools.length} tools registered`
              : agent.mock
                ? `mock agent · answering ${agent.tools.length} tools locally`
                : `not in a WebMCP browser · ${agent.tools.length} tools ready`}
          </div>
        </div>
        <button onClick={onClose} className="border-none bg-transparent text-base text-faint">
          ×
        </button>
      </div>

      <div className="px-[18px] pt-3.5">
        <div className="rh-kicker mb-2 tracking-[0.12em]">TOOLS THIS PAGE EXPOSES</div>
        <div className="flex flex-wrap gap-[5px]">
          {agent.tools.map((t) => {
            const on = hot.has(t.name);
            return (
              <span
                key={t.name}
                title={t.description}
                data-on={on}
                className="rounded-md border border-line bg-bg px-2 py-[3px] font-mono text-[10.5px] text-muted data-[on=true]:border-accent-line data-[on=true]:bg-accent-soft data-[on=true]:text-accent"
              >
                {t.name}
              </span>
            );
          })}
        </div>
      </div>

      {pending > 0 && (
        <div className="mx-[18px] mt-3.5 rounded-lg bg-accent-soft px-3 py-[9px] text-[11.5px] text-accent">
          {pending} request{pending === 1 ? "" : "s"} waiting — the page is handing the agent work via{" "}
          <span className="font-mono">rabbithole_await_event</span>
        </div>
      )}

      <div className="rh-kicker mx-[18px] mt-[18px] mb-2 tracking-[0.12em]">ACTIVITY</div>
      <div className="flex flex-1 flex-col gap-1.5 overflow-auto px-[18px] pb-[18px]">
        {agent.log.length === 0 && (
          <div className="text-[12px] leading-[1.6] text-faint">
            Nothing yet. Open this page in a WebMCP browser and ask the agent to “walk me through this for my goal” — every tool it calls
            shows up here.
          </div>
        )}
        {agent.log.map((e) => (
          <div key={e.id} className="flex animate-fade-up-200 items-start gap-2.5 font-mono text-[11px] leading-[1.5]">
            <span className="flex-none text-line-2">{clockLabel(e.at)}</span>
            <div className="min-w-0">
              <span className={`font-bold ${LOG_TONE[e.tone]}`}>{e.name}</span>
              <span className="break-words text-muted"> {e.detail}</span>
            </div>
          </div>
        ))}
      </div>

      <DrawerFooter available={agent.available} mock={agent.mock} prompt={agent.prompt} />
    </div>
  );
}

function DrawerFooter({ available, mock, prompt }: { available: boolean; mock: boolean; prompt: string }) {
  const rh = useRabbithole();
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      rh.reader.toast("Couldn’t copy — the prompt is in the console.");
      console.info(prompt);
    }
  };
  const toggleMock = () => (mock ? rh.stopMockAgent() : rh.startMockAgent());

  return (
    <div className="flex items-center gap-2.5 border-t border-line px-[18px] py-3">
      {available ? (
        <>
          <Button variant="primary" size="sm" onClick={copyPrompt}>
            {copied ? "copied ✓" : "copy agent prompt"}
          </Button>
          <span className="text-[11px] text-faint">paste it to your agent once</span>
        </>
      ) : (
        <>
          <Button variant="primary" size="sm" onClick={toggleMock}>
            {mock ? "■ stop mock agent" : "▶ run a mock agent"}
          </Button>
          <span className="text-[11px] text-faint">{mock ? "synthetic answers" : "no modelContext here"}</span>
        </>
      )}
    </div>
  );
}
