/** The few inline glyphs the design draws itself. */

export function BookmarkIcon({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" fill={on ? "var(--color-accent)" : "var(--color-line-3)"} />
    </svg>
  );
}

/** Gear, for the profile / settings entry in the top bar. */
export function SettingsIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09a1.65 1.65 0 00-1-1.51 1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09a1.65 1.65 0 001.51-1 1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06a1.65 1.65 0 001.82.33h0a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82v0a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  );
}

export type DotTone = "accent" | "rust" | "idle";

/**
 * A status dot. `breathe` adds the pulse ring the design uses for "work in flight"
 * (loading panes, the drawer); the top-bar pill never breathes.
 */
export function StatusDot({
  tone = "accent",
  on,
  size = 8,
  breathe = false,
  hollow = false,
}: {
  tone?: DotTone;
  on?: boolean;
  size?: number;
  breathe?: boolean;
  /** outlined instead of filled — "linked, and busy on something" */
  hollow?: boolean;
}) {
  const t: DotTone = on === undefined ? tone : on ? "accent" : "idle";
  const color = t === "accent" ? "bg-accent" : t === "rust" ? "bg-rust" : "bg-line-2";
  const ring = t === "accent" ? "border-accent" : t === "rust" ? "border-rust" : "border-line-2";
  return (
    <span
      className={`box-border rounded-full ${hollow ? `border-[1.5px] bg-transparent ${ring}` : color} ${breathe && t === "accent" ? "animate-breathe" : ""}`}
      style={{ width: size, height: size, flex: "none" }}
    />
  );
}

export function GithubIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.39 7.86 10.91.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.52-1.33-1.28-1.68-1.28-1.68-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.76 2.7 1.25 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.19-3.09-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.17 1.18a11 11 0 015.78 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.83 1.19 3.09 0 4.41-2.69 5.38-5.26 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0023.5 12C23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

export function Wordmark({ size = 15 }: { size?: number }) {
  return (
    <span className="font-bold tracking-[-0.02em] text-ink" style={{ fontSize: size }}>
      rabbithole<span className="text-accent">_</span>
    </span>
  );
}
