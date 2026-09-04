import { useReader, useStore } from "@/hooks";

export function Toast() {
  const toast = useStore((s) => s.session.toast);
  const reader = useReader();
  if (!toast) return null;
  return (
    <div
      onClick={() => reader.toast(null)}
      className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 animate-fade-up-250 cursor-pointer rounded-[10px] bg-ink px-[18px] py-[11px] text-[12.5px] text-[#FDE8E6] shadow-[0_8px_24px_rgba(23,26,38,.25)]"
    >
      {toast} <span className="ml-2 text-faint">dismiss</span>
    </div>
  );
}

/** The agent "speaking" while a shared trail replays: "AGENT · step 2/4". */
export function AgentSaying() {
  const say = useStore((s) => s.session.say);
  const reader = useReader();
  if (!say) return null;
  return (
    <div className="fixed bottom-[22px] left-1/2 z-[45] flex max-w-[560px] -translate-x-1/2 animate-fade-up-250 items-start gap-2.5 rounded-xl bg-ink px-4 py-3 text-[13px] leading-[1.5] text-dark-text shadow-[0_10px_30px_rgba(23,26,38,.28)]">
      <span className="mt-1.5 size-2 flex-none animate-breathe rounded-full bg-accent-light" />
      <div>
        <span className="font-mono text-[10px] tracking-[0.1em] text-accent-light">AGENT {say.step ? `· step ${say.step.i}/${say.step.n}` : ""}</span>
        <div>{say.text}</div>
      </div>
      <button onClick={() => reader.stopTour()} className="border-none bg-transparent pl-1.5 text-[14px] text-faint">
        ×
      </button>
    </div>
  );
}
