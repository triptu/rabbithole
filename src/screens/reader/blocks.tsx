/**
 * One renderer per document block type. To support a new kind of input (PDF, PR…),
 * add a Block variant in sdk/types.ts, produce it in the sdk, and render it here.
 */
import { Fragment } from "react";
import { Marked } from "@/components/marked";
import { blockText, type Block, type DiffLine } from "@/sdk";

export function Blocks({ blocks }: { blocks: Block[] }) {
  return (
    <div className="flex flex-col gap-4">
      {blocks.map((b, i) => (
        <BlockView key={i} block={b} />
      ))}
    </div>
  );
}

function BlockView({ block }: { block: Block }) {
  const context = blockText(block).slice(0, 800);
  switch (block.type) {
    case "paragraph":
      return (
        <p className="m-0 font-serif text-[16px] leading-[1.75] text-ink-2 [text-wrap:pretty]">
          <Marked text={block.text} context={context} />
        </p>
      );
    case "note":
      return (
        <p className="m-0 font-serif text-[15.5px] leading-[1.7] text-slate [text-wrap:pretty]">
          <Marked text={block.text} context={context} />
        </p>
      );
    case "hint":
      return <p className="m-0 text-[12.5px] leading-[1.6] text-faint">{block.text}</p>;
    case "code":
      return (
        <div className="overflow-x-auto rounded-[10px] border border-line bg-paper-2 px-[22px] py-5 font-mono text-[12.5px] leading-[2] text-ink-3">
          {block.lines.map((line, i) => (
            <div key={i} className="whitespace-pre">
              {line === "" ? " " : <CodeLine line={line} context={context} />}
            </div>
          ))}
        </div>
      );
    case "diff":
      return (
        <div className="overflow-hidden rounded-[10px] border border-line font-mono text-[12.5px] leading-[1.9]">
          <div className="bg-panel px-4 py-2 text-[11px] text-slate">{block.file}</div>
          <div className="px-4 py-2.5 text-ink-3">
            {block.lines.map((l, i) => (
              <DiffRow key={i} line={l} context={context} />
            ))}
          </div>
        </div>
      );
    case "summary":
      return (
        <div className="flex gap-[18px] rounded-[10px] border border-line bg-paper-2 px-[18px] py-3.5 text-[12.5px] leading-[1.6] text-ink-3">
          {block.items.map((it) => (
            <div key={it.k} className="flex-1">
              <span className={`rh-kicker ${it.tone === "warn" ? "text-rust" : "text-accent"}`}>
                {it.k}
              </span>
              <br />
              <Marked text={it.text} context={context} />
            </div>
          ))}
        </div>
      );
    case "table": {
      const template = block.columns.length === 4 ? "1.4fr .7fr .9fr .6fr" : `repeat(${block.columns.length}, 1fr)`;
      return (
        <div className="overflow-hidden rounded-[10px] border border-line text-[13.5px]">
          <div className="rh-kicker grid gap-x-3 bg-panel px-4 py-[9px] text-muted" style={{ gridTemplateColumns: template }}>
            {block.columns.map((c) => (
              <span key={c}>{c}</span>
            ))}
          </div>
          {block.rows.map((row, r) => (
            <div key={r} className="grid gap-x-3 border-t border-line px-4 py-2.5 text-ink-3" style={{ gridTemplateColumns: template }}>
              {row.map((cell, c) => (
                <span
                  key={c}
                  className={[cell.mono ? "font-mono" : "", cell.muted ? "text-faint" : "", cell.flag ? "font-semibold text-rust" : ""].join(" ")}
                >
                  <Marked text={cell.text} context={context} />
                </span>
              ))}
            </div>
          ))}
        </div>
      );
    }
  }
}

/**
 * Tiny tokenizer, enough for the demo listing: `//` comments dimmed (markers allowed
 * inside), a few keywords in accent, `: Type` annotations muted.
 */
function CodeLine({ line, context }: { line: string; context: string }) {
  const at = line.indexOf("//");
  const code = at === -1 ? line : line.slice(0, at);
  const comment = at === -1 ? null : line.slice(at);
  return (
    <>
      {tokenize(code).map((t, i) => (
        <span key={i} className={TOKEN_CLASS[t.kind]}>
          {t.text}
        </span>
      ))}
      {comment !== null && (
        <span className="text-faint">
          <Marked text={comment} context={context} />
        </span>
      )}
    </>
  );
}

const TOKEN_CLASS = { plain: "", kw: "text-accent", type: "text-muted" } as const;
const KEYWORDS = /\b(const|let|function|return|if|else|import|export|new|for|while)\b/g;
const TYPES = /(:\s*)([A-Z]\w*|number|string|boolean)\b/g;

function tokenize(code: string): { kind: "plain" | "kw" | "type"; text: string }[] {
  const out: { kind: "plain" | "kw" | "type"; text: string }[] = [];
  const marks: { start: number; end: number; kind: "kw" | "type" }[] = [];
  for (const m of code.matchAll(KEYWORDS)) marks.push({ start: m.index!, end: m.index! + m[0].length, kind: "kw" });
  for (const m of code.matchAll(TYPES)) {
    const start = m.index! + m[1]!.length;
    marks.push({ start, end: start + m[2]!.length, kind: "type" });
  }
  marks.sort((a, b) => a.start - b.start);
  let last = 0;
  for (const mk of marks) {
    if (mk.start < last) continue;
    if (mk.start > last) out.push({ kind: "plain", text: code.slice(last, mk.start) });
    out.push({ kind: mk.kind, text: code.slice(mk.start, mk.end) });
    last = mk.end;
  }
  if (last < code.length) out.push({ kind: "plain", text: code.slice(last) });
  return out;
}

function DiffRow({ line, context }: { line: DiffLine; context: string }) {
  const style: Record<DiffLine["kind"], string> = {
    add: "-mx-4 bg-diff-add-bg px-4 text-diff-add",
    del: "-mx-4 bg-danger-bg px-4 text-danger",
    ctx: "text-ink-3",
    skip: "text-faint",
  };
  const prefix = line.kind === "add" ? "+ " : line.kind === "del" ? "- " : "  ";
  return (
    <div className={`whitespace-pre-wrap ${style[line.kind]}`}>
      {prefix}
      {line.kind === "skip" ? (
        line.text
      ) : (
        <Fragment>
          <Marked text={line.text} context={context} />
        </Fragment>
      )}
    </div>
  );
}
