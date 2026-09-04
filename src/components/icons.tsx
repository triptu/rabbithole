/** The two inline glyphs the design draws itself. */

export function BookmarkIcon({ on, size = 16 }: { on: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <path d="M6 3h12v18l-6-4-6 4z" fill={on ? "var(--color-accent)" : "var(--color-line-3)"} />
    </svg>
  );
}

/** The agent status dot: accent + breathing when linked or busy, grey when idle. */
export function StatusDot({ on, size = 8 }: { on: boolean; size?: number }) {
  return <span className={on ? "animate-breathe rounded-full bg-accent" : "rounded-full bg-line-2"} style={{ width: size, height: size, flex: "none" }} />;
}

export function Wordmark({ size = 15 }: { size?: number }) {
  return (
    <span className="font-bold tracking-[-0.02em] text-ink" style={{ fontSize: size }}>
      rabbithole<span className="text-accent">_</span>
    </span>
  );
}
