/**
 * The prompt a human pastes into their agent, shown in full with a copy control in
 * the corner — you always see exactly what you are about to paste.
 */
import { useState } from "react";
import { useReader } from "@/hooks";

export function PromptCard({ text, label, dark = false }: { text: string; label: string; dark?: boolean }) {
  const reader = useReader();
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      reader.toast("Couldn’t copy — select the text and copy it by hand.");
    }
  };
  return (
    <div className={`rounded-lg border px-3 py-2.5 ${dark ? "border-white/10 bg-white/5" : "border-line bg-bg"}`}>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <span className={`rh-kicker tracking-[0.12em] ${dark ? "text-accent-light" : ""}`}>{label}</span>
        <button
          onClick={copy}
          className={`border-none bg-transparent font-mono text-[10.5px] ${dark ? "text-dark-muted hover:text-white" : "text-faint hover:text-accent"}`}
        >
          {copied ? "copied ✓" : "copy"}
        </button>
      </div>
      <pre className={`m-0 font-sans text-[12px] leading-[1.55] whitespace-pre-wrap select-all ${dark ? "text-dark-text" : "text-ink-3"}`}>{text}</pre>
    </div>
  );
}
