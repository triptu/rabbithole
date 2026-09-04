/**
 * Highlight-to-ask. Selecting text inside any pane paints it with the CSS Custom
 * Highlight API and floats this composer under it; Enter turns it into a new pane.
 */
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { BareInput } from "@/components/ui/input";
import { useRabbithole, useReader, useStore } from "@/hooks";
import type { Selection as ReaderSelection } from "@/sdk";

const HIGHLIGHT = "rh-sel";
const hasHighlightApi = () => typeof Highlight !== "undefined" && typeof CSS !== "undefined" && !!CSS.highlights;

export function clearHighlight() {
  if (hasHighlightApi()) CSS.highlights.delete(HIGHLIGHT);
}

/**
 * Wires selection capture on the pane scroller. Returns the mouseup handler.
 * While the popover is open the custom highlight holds the visual, and the native
 * selection is dropped so focusing the input cannot restyle it.
 */
export function useSelectionCapture() {
  const rh = useRabbithole();
  const reader = useReader();
  const selection = useStore((s) => s.session.selection);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // paint the live selection while dragging inside a pane
  useEffect(() => {
    if (!hasHighlightApi()) return;
    const onChange = () => {
      if (rh.store.getState().session.selection) return; // popover holds it
      const sel = window.getSelection();
      if (!sel || sel.isCollapsed || !sel.rangeCount) return clearHighlight();
      const el = sel.anchorNode?.parentElement;
      if (el?.closest("[data-pane]")) CSS.highlights.set(HIGHLIGHT, new Highlight(sel.getRangeAt(0).cloneRange()));
      else clearHighlight();
    };
    document.addEventListener("selectionchange", onChange);
    return () => document.removeEventListener("selectionchange", onChange);
  }, [rh]);

  // when the selection is consumed or cancelled, drop the paint
  useEffect(() => {
    if (!selection) clearHighlight();
  }, [selection]);
  useEffect(() => () => clearHighlight(), []);

  const onMouseUp = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest?.("[data-rh-pop]")) return;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim() ?? "";
      if (!sel || !text || text.length < 3 || text.length > 600) return reader.select(null);
      const paneEl = sel.anchorNode?.parentElement?.closest<HTMLElement>("[data-pane]");
      if (!paneEl) return;
      const range = sel.getRangeAt(0);
      const r = range.getBoundingClientRect();
      const next: ReaderSelection = {
        text,
        fromIndex: parseInt(paneEl.dataset.pane ?? "-1", 10),
        x: r.left + r.width / 2,
        y: r.bottom,
      };
      if (hasHighlightApi()) {
        CSS.highlights.set(HIGHLIGHT, new Highlight(range.cloneRange()));
        sel.removeAllRanges();
      }
      reader.select(next);
    }, 10);
  };

  return { onMouseUp, clear: () => reader.select(null) };
}

export function SelectionPopover() {
  const reader = useReader();
  const selection = useStore((s) => s.session.selection);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (selection) setTimeout(() => inputRef.current?.focus(), 30);
  }, [selection]);
  if (!selection) return null;

  const ask = () => reader.ask(inputRef.current?.value.trim() || undefined);
  return (
    <div data-rh-pop="1" className="fixed z-40 animate-pop-fade" style={{ left: selection.x, top: selection.y, transform: "translate(-50%, 10px)" }}>
      <div className="flex items-center rounded-full border border-line bg-paper py-[3px] pr-1.5 pl-3.5 shadow-[0_6px_24px_rgba(23,26,38,.10)]">
        <BareInput
          ref={inputRef}
          placeholder="explain…"
          className="w-[200px] flex-none py-[7px] text-[12.5px]"
          onKeyDown={(e) => {
            if (e.key === "Enter") ask();
            if (e.key === "Escape") reader.select(null);
          }}
        />
        <Button variant="ghost" size="xs" title="Ask" className="py-[5px]" onClick={ask}>
          ↵
        </Button>
      </div>
    </div>
  );
}
