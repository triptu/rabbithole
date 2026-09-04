/**
 * Turning source text into verbatim blocks.
 *
 * The reader wants the original text, not a rewrite. Pasted text is split into
 * paragraphs; fetched pages arrive as markdown (Jina Reader) and are parsed with
 * `marked`, then flattened losslessly: headings, paragraphs, code, quotes, lists,
 * tables. Link text is kept and its url dropped, images vanish, Wikipedia-style
 * citation links (`[1]`) are removed, emphasis marks go.
 */
import { marked, type Token, type Tokens } from "marked";
import type { Block, TableRow } from "../types";

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

const ENTITIES: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&nbsp;": " " };
const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m);
const CITATION = /^\[?\d+\]?$|^\[?[a-z]\]?$|^note \d+$/i;

/** Inline tokens → plain text. */
function inlineText(tokens: Token[] | undefined): string {
  if (!tokens) return "";
  let out = "";
  for (const t of tokens) {
    switch (t.type) {
      case "text":
      case "escape":
      case "codespan":
        out += decode((t as Tokens.Text).text);
        break;
      case "strong":
      case "em":
      case "del":
        out += inlineText((t as Tokens.Strong).tokens);
        break;
      case "link": {
        const inner = inlineText((t as Tokens.Link).tokens).trim();
        if (!CITATION.test(inner)) out += inner; // keep the words, drop the url; drop [1] citations
        break;
      }
      case "image":
      case "html":
        break;
      case "br":
        out += " ";
        break;
      default:
        out += decode((t as { raw?: string }).raw ?? "");
    }
  }
  return out;
}

// stray "****" is Jina's rendering of two adjacent bold spans ("**mRNA****vaccine**"); a space is what was there
const tidy = (s: string) => s.replace(/\*{2,}/g, " ").replace(/\s+/g, " ").replace(/\s+([,.;:!?)])/g, "$1").trim();

/** Inline markdown → plain text, e.g. for a title. */
export function inlineToText(s: string): string {
  return tidy(inlineText(marked.lexer(s).flatMap((t) => (t as Tokens.Paragraph).tokens ?? [])));
}

export function markdownToBlocks(text: string): Block[] {
  const blocks: Block[] = [];
  const push = (b: Block | null) => b && blocks.push(b);

  const walk = (tokens: Token[]) => {
    for (const t of tokens) {
      switch (t.type) {
        case "heading": {
          const h = t as Tokens.Heading;
          const s = tidy(inlineText(h.tokens));
          if (s) push({ type: "heading", level: Math.min(3, h.depth) as 1 | 2 | 3, text: s });
          break;
        }
        case "paragraph": {
          const s = tidy(inlineText((t as Tokens.Paragraph).tokens));
          if (s) push({ type: "paragraph", text: s });
          break;
        }
        case "text": {
          // loose list items and blockquote bodies arrive as bare text tokens
          const s = tidy(inlineText((t as Tokens.Text).tokens ?? [t]));
          if (s) push({ type: "paragraph", text: s });
          break;
        }
        case "code": {
          const lines = (t as Tokens.Code).text.split("\n");
          if (lines.some((l) => l.trim())) push({ type: "code", lines });
          break;
        }
        case "blockquote": {
          const s = tidy(inlineText(flattenInline((t as Tokens.Blockquote).tokens)));
          if (s) push({ type: "note", text: s });
          break;
        }
        case "list": {
          const list = t as Tokens.List;
          list.items.forEach((item, i) => {
            const s = tidy(inlineText(flattenInline(item.tokens)));
            if (s) push({ type: "paragraph", text: `${list.ordered ? `${(Number(list.start) || 1) + i}.` : "•"} ${s}` });
          });
          break;
        }
        case "table": {
          const tb = t as Tokens.Table;
          const columns = tb.header.map((c) => tidy(inlineText(c.tokens)));
          const rows: TableRow[] = tb.rows.map((r) => r.map((c) => ({ text: tidy(inlineText(c.tokens)) })));
          if (columns.some(Boolean)) push({ type: "table", columns, rows });
          break;
        }
        default:
          break; // space, hr, html, def
      }
    }
  };
  walk(marked.lexer(text));
  return blocks;
}

/** block tokens inside a quote or list item → their inline tokens, joined by spaces */
function flattenInline(tokens: Token[]): Token[] {
  const out: Token[] = [];
  for (const t of tokens) {
    const inner = (t as { tokens?: Token[] }).tokens;
    if (t.type === "list") {
      for (const item of (t as Tokens.List).items) out.push(...flattenInline(item.tokens), { type: "text", raw: " ", text: " " } as Tokens.Text);
    } else if (inner && t.type !== "link" && t.type !== "strong" && t.type !== "em") out.push(...inner, { type: "text", raw: " ", text: " " } as Tokens.Text);
    else out.push(t);
  }
  return out;
}

/** Plain text of the blocks, for the agent (capped). */
export function sourceText(blocks: Block[], max = 12_000): string {
  const parts: string[] = [];
  for (const b of blocks) {
    if (b.type === "paragraph" || b.type === "heading" || b.type === "note") parts.push(b.text);
    else if (b.type === "code") parts.push(b.lines.join("\n"));
    else if (b.type === "table") parts.push([b.columns.join(" | "), ...b.rows.map((r) => r.map((c) => c.text).join(" | "))].join("\n"));
  }
  return parts.join("\n\n").slice(0, max);
}
