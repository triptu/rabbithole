import { describe, expect, test } from "bun:test";
import { markTerms } from "./markers";
import { inlineToText, parseSource } from "./source";

describe("source parsing", () => {
  test("jina header, headings, paragraphs, code, quotes, links, images", () => {
    const raw = `Title: Attention Is All You Need\n\nURL Source: https://arxiv.org/abs/1706.03762\n\nMarkdown Content:\n# Abstract\n\nThe dominant [sequence transduction](https://x) models…\n![fig](img.png)\n\n> a quote\n\n\`\`\`\nconst x = 1;\n\`\`\`\n\n- first\n- second`;
    const p = parseSource(raw);
    expect(p.title).toBe("Attention Is All You Need");
    expect(p.blocks).toEqual([
      { type: "heading", level: 1, text: "Abstract" },
      { type: "paragraph", text: "The dominant sequence transduction models…" },
      { type: "note", text: "a quote" },
      { type: "code", lines: ["const x = 1;"] },
      { type: "paragraph", text: "• first" },
      { type: "paragraph", text: "• second" },
    ]);
  });

  test("plain pasted text splits on blank lines", () => {
    expect(parseSource("one\ntwo\n\nthree").blocks).toEqual([
      { type: "paragraph", text: "one two" },
      { type: "paragraph", text: "three" },
    ]);
  });

  test("wikipedia via jina: citations dropped, link titles ignored, adjacent bold spans, image links", () => {
    const raw = `[![Image 1](https://i.png)](https://l)\n\nAn **mRNA****vaccine** is a type of [vaccine](https://en.wikipedia.org/wiki/Vaccine "Vaccine") response.[[1]](https://x#cite_note-1) It works.[[2]](https://x#cite_note-2)[[3]](https://x#cite_note-3)\n\n| Test | Result |\n|---|---|\n| A1c | 5.9 |`;
    const p = parseSource(raw);
    expect(p.blocks).toEqual([
      { type: "paragraph", text: "An mRNA vaccine is a type of vaccine response. It works." },
      { type: "table", columns: ["Test", "Result"], rows: [[{ text: "A1c" }, { text: "5.9" }]] },
    ]);
  });

  test("inline markdown is flattened", () => {
    expect(inlineToText("**bold** and `code` and [link](u) and *em*")).toBe("bold and code and link and em");
  });
});

describe("markTerms", () => {
  test("first occurrence, word boundaries, longest first, no nesting", () => {
    const { text, placed } = markTerms("Multi-head attention uses attention. Attentional is different.", ["attention", "multi-head attention"]);
    expect(text).toBe("[[multi-head attention|Multi-head attention]] uses [[attention]]. Attentional is different.");
    expect(placed).toEqual(["multi-head attention", "attention"]);
  });
  test("skips terms that are absent or already inside a marker", () => {
    const { text, placed } = markTerms("A [[softmax]] layer", ["softmax", "nothing"]);
    expect(text).toBe("A [[softmax]] layer");
    expect(placed).toEqual([]);
  });
});
