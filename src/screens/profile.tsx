import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useReader, useStore } from "@/hooks";

export function Profile() {
  const reader = useReader();
  const profile = useStore((s) => s.profile);
  const notes = useStore((s) => s.notes);
  const [role, setRole] = useState(profile.role);
  const [standing, setStanding] = useState(profile.notes);
  const [prefs, setPrefs] = useState(profile.prefs);
  const [saved, setSaved] = useState(false);

  // if the agent or another tab changes the profile while we're here, pick it up
  useEffect(() => {
    setRole(profile.role);
    setStanding(profile.notes);
    setPrefs(profile.prefs);
  }, [profile]);

  const save = () => {
    reader.saveProfile({ role, notes: standing, prefs });
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  };

  const field =
    "box-border w-full rounded-lg border border-transparent bg-bg px-3 py-[9px] text-[13px] text-ink focus:border-accent focus:bg-paper";

  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="mx-auto flex max-w-[560px] animate-fade-up-350 flex-col gap-3.5">
        <div className="mb-1.5">
          <h1 className="m-0 font-serif text-[28px] font-medium text-ink">The agent's picture of you</h1>
          <p className="mt-2 mb-0 text-[13px] leading-[1.6] text-muted [text-wrap:pretty]">
            Everything here shapes every explanation. Your agent reads it before it answers anything, and fills it in from what it already
            knows about you. You can edit it too.
          </p>
        </div>

        <section className="rh-card px-5 py-[18px]">
          <div className="rh-kicker mb-2 tracking-[0.12em]">WHAT YOU DO</div>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="what you do, e.g. nurse, backend engineer, law student" className={field} />
        </section>

        <section className="rh-card px-5 py-[18px]">
          <div className="rh-kicker mb-2.5 tracking-[0.12em]">EXPLAIN THINGS USING</div>
          <div className="flex flex-wrap gap-2">
            {Object.keys(prefs).map((k) => (
              <Button key={k} variant="chip" size="md" on={prefs[k]} className="py-1.5" onClick={() => setPrefs({ ...prefs, [k]: !prefs[k] })}>
                {k}
              </Button>
            ))}
          </div>
        </section>

        <section className="rh-card px-5 py-[18px]">
          <div className="rh-kicker mb-2 tracking-[0.12em]">ALWAYS REMEMBER (CUSTOM INSTRUCTIONS)</div>
          <textarea
            rows={3}
            value={standing}
            onChange={(e) => setStanding(e.target.value)}
            placeholder="rules for every explanation, e.g. keep the first pass under three sentences"
            className={`${field} resize-none leading-[1.6]`}
          />
        </section>

        <section className="rounded-xl bg-ink px-5 py-[18px]">
          <div className="mb-2.5 font-mono text-[10px] tracking-[0.12em] text-accent-light">// LEARNED FROM YOUR SESSIONS</div>
          <div className="flex flex-col gap-[7px] font-mono text-[11.5px] leading-[1.5] text-dark-text">
            {notes.length === 0 && <div className="text-dark-muted">nothing yet — your agent adds notes here as it learns how you read</div>}
            {notes.map((n) => (
              <div key={n.id} className="flex justify-between gap-3">
                <span>· {n.text}</span>
                <span className="flex-none text-dark-muted">{n.source}</span>
              </div>
            ))}
          </div>
          <div className="mt-2.5 flex items-center justify-between text-[10.5px] text-dark-muted">
            <span>written by your agent (rabbithole_update_reader)</span>
            {notes.length > 0 && (
              <button onClick={() => reader.clearNotes()} className="border-none bg-transparent text-[10.5px] text-dark-muted underline decoration-dotted underline-offset-2 hover:text-accent-light">
                clear
              </button>
            )}
          </div>
        </section>

        <div className="flex items-center gap-3">
          <Button variant="primary" size="lg" className="px-5" onClick={save}>
            Save
          </Button>
          {saved && <span className="animate-fade-up-250 text-[12px] font-semibold text-accent">saved ✓</span>}
        </div>
      </div>
    </div>
  );
}
