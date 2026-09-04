/**
 * Turning source text into verbatim blocks.
 *
 * The reader wants the original text, not a rewrite. Pasted text is split into
 * paragraphs; fetched pages arrive as markdown (Jina Reader) and get a light, lossless
 * conversion: headings, paragraphs, code fences, quotes. Links keep their text,
 * images are dropped, everything else is left as written.
 */
import type { Block } from "../types";

export interface ParsedSource {
  title?: string;
  blocks: Block[];
}

/** Jina Reader prefixes its markdown with a small header block. */
const JINA_HEADER = /^Title:\s*(.+?)\n(?:\n?URL Source:\s*.+?\n)?(?:\n?Published Time:\s*.+?\n)?\n?Markdown Content:\n/s;

export function parseSource(raw: string): ParsedSource {
  let text = raw.replace(/\r\n?/g, "\n").trim();
  let title: string | undefined;
  const jina = text.match(JINA_HEADER);
  if (jina) {
    title = jina[1]?.trim();
    text = text.slice(jina[0].length).trim();
  }
  return { title, blocks: markdownToBlocks(text) };
}

/** Inline markdown → plain text: links keep their label, images vanish, emphasis marks go. */
export function inlineToText(s: string): string {
  return s
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(.+?)\1/g, "$2")
    .replace(/(^|\W)[*_]([^*_]+)[*_](?=\W|$)/g, "$1$2")
    .replace(/\s+/g, " ")
    .trim();
}

export function markdownToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const lines = text.split("\n");
  let para: string[] = [];
  const flush = () => {
    if (!para.length) return;
    const t = inlineToText(para.join(" "));
    if (t) blocks.push({ type: "paragraph", text: t });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const trimmed = line.trim();

    if (trimmed.startsWith("```")) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !lines[i]!.trim().startsWith("```")) code.push(lines[i]!), i++;
      if (code.length) blocks.push({ type: "code", lines: code });
      continue;
    }
    const heading = trimmed.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flush();
      const t = inlineToText(heading[2]!.replace(/\s#+$/, ""));
      if (t) blocks.push({ type: "heading", level: Math.min(3, heading[1]!.length) as 1 | 2 | 3, text: t });
      continue;
    }
    if (/^>\s?/.test(trimmed)) {
      flush();
      const quote: string[] = [trimmed.replace(/^>\s?/, "")];
      while (i + 1 < lines.length && /^>\s?/.test(lines[i + 1]!.trim())) quote.push(lines[++i]!.trim().replace(/^>\s?/, ""));
      const t = inlineToText(quote.join(" "));
      if (t) blocks.push({ type: "note", text: t });
      continue;
    }
    if (trimmed === "" || /^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
      flush();
      continue;
    }
    if (/^!\[[^\]]*\]\([^)]*\)$/.test(trimmed)) continue; // a lone image
    const bullet = trimmed.match(/^([-*+]|\d+[.)])\s+(.*)$/);
    if (bullet) {
      flush();
      const t = inlineToText(bullet[2]!);
      if (t) blocks.push({ type: "paragraph", text: `${/^\d/.test(bullet[1]!) ? bullet[1] : "•"} ${t}` });
      continue;
    }
    para.push(trimmed);
  }
  flush();
  return blocks;
}

/** Plain text of the blocks, for the agent (capped). */
export function sourceText(blocks: Block[], max = 12_000): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "heading" || b.type === "note") parts.push(b.text);
    else if (b.type === "code") parts.push(b.lines.join("\n"));
  }
  return parts.join("\n\n").slice(0, max);
}
