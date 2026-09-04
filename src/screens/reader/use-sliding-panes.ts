/**
 * Andy-Matuschak-style sliding panes: every pane is PANE_W wide and `position:
 * sticky`; scrolling stacks left-passed panes as spines at the left edge (left =
 * i*SPINE_W) and not-yet-reached panes as spines at the right edge
 * (right = (n-i)*SPINE_W - PANE_W, negative = overhang). Index 0 is the article.
 */
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { useStore } from "@/hooks";

/** keep in step with --spacing-pane / --spacing-spine in styles/globals.css */
export const PANE_W = 620;
export const SPINE_W = 46;

export interface PaneGeometry {
  left: number;
  right: number;
  z: number;
}

export function useSlidingPanes(paneCount: number) {
  const n = paneCount + 1; // + the article
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [scrollL, setScrollL] = useState(0);
  const [viewW, setViewW] = useState(1280);
  const reveal = useStore((s) => s.session.reveal);

  // viewport width follows the element, not the window (the agent drawer eats space)
  useLayoutEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    setViewW(el.clientWidth);
    const ro = new ResizeObserver(() => setViewW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onScroll = useCallback((e: React.UIEvent<HTMLDivElement>) => {
    setScrollL(e.currentTarget.scrollLeft);
  }, []);

  /**
   * Eased scroll. "end" re-reads the maximum every frame, so a pane that is still
   * laying out cannot leave the strip short of the right edge.
   */
  const tween = useCallback((target: number | "end") => {
    const el = scrollerRef.current;
    if (!el) return;
    const from = el.scrollLeft;
    const resolve = () => {
      const max = el.scrollWidth - el.clientWidth;
      return Math.max(0, Math.min(target === "end" ? max : target, max));
    };
    if (resolve() === from) return;
    const dur = 380;
    const t0 = performance.now();
    const ease = (x: number) => 1 - (1 - x) ** 3;
    const step = (now: number) => {
      const k = Math.min(1, (now - t0) / dur);
      el.scrollLeft = from + (resolve() - from) * ease(k);
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, []);

  /** scroll so pane i (0 = article) is fully open */
  const goPane = useCallback((i: number) => tween(i * (PANE_W - SPINE_W)), [tween]);
  const scrollToEnd = useCallback(() => tween("end"), [tween]);

  // the sdk asks to reveal a pane: a new (last) pane slides the strip to its end, an
  // existing one is scrolled into place — exactly like the prototype
  useEffect(() => {
    if (!reveal) return;
    const t = setTimeout(() => (reveal.index >= paneCount - 1 ? scrollToEnd() : goPane(reveal.index + 1)), 80);
    return () => clearTimeout(t);
  }, [reveal, paneCount, goPane, scrollToEnd]);

  const geometry = (i: number): PaneGeometry => ({ left: i * SPINE_W, right: (n - i) * SPINE_W - PANE_W, z: i + 1 });

  /**
   * A pane shows its vertical title only when another pane covers it down to its
   * spine, or it is pinned as a spine at the right edge.
   */
  const xs: { natural: number; x: number; max: number }[] = [];
  for (let i = 0; i < n; i++) {
    const natural = i * PANE_W - scrollL;
    const max = viewW - (n - i) * SPINE_W;
    xs.push({ natural, x: Math.max(i * SPINE_W, Math.min(natural, max)), max });
  }
  const strips = xs.map((m, i) => (i + 1 < n && xs[i + 1]!.x <= m.x + SPINE_W + 6) || m.natural >= m.max + 2);

  return { scrollerRef, onScroll, goPane, geometry, strips };
}
