import { describe, expect, test } from "bun:test";
import type { Block } from "../types";
import { DEMO_CONCEPTS, DEMO_PAGES, DEMO_SUGGESTIONS } from "./canned";

const MARKER = /\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g;

function markerIds(text: string): string[] {
  return [...text.matchAll(MARKER)].map((m) => m[1]!.trim());
}

function blockTexts(block: Block): string[] {
  switch (block.type) {
    case "paragraph":
    case "heading":
    case "note":
    case "hint":
      return [block.text];
    case "code":
      return block.lines;
    case "diff":
      return block.lines.map((l) => l.text);
    case "summary":
      return block.items.map((i) => i.text);
    case "table":
      return block.rows.flatMap((row) => row.map((c) => c.text));
  }
}

// `terms` counts as shown in the original design prototype
const ORIGINAL_TERM_COUNTS: Record<string, number> = { tx: 6, cr: 8, bft: 3, code: 4, pr: 4, lab: 6, tax: 5 };

describe("demo seed", () => {
  test("every marker in page blocks points at a known concept", () => {
    for (const page of Object.values(DEMO_PAGES)) {
      for (const block of page.blocks) {
        for (const text of blockTexts(block)) {
          for (const id of markerIds(text)) {
            expect(DEMO_CONCEPTS[id], `${page.id}: [[${id}]]`).toBeDefined();
          }
        }
      }
    }
  });

  test("every marker in concept text points at a known concept", () => {
    for (const [cid, c] of Object.entries(DEMO_CONCEPTS)) {
      for (const id of markerIds(c.short + " " + c.long)) {
        expect(DEMO_CONCEPTS[id], `${cid}: [[${id}]]`).toBeDefined();
      }
    }
  });

  test("every concept belongs to an existing page", () => {
    for (const [cid, c] of Object.entries(DEMO_CONCEPTS)) {
      expect(DEMO_PAGES[c.docId], `${cid} → ${c.docId}`).toBeDefined();
    }
  });

  test("page ids match their keys and termCount matches the original", () => {
    for (const [key, page] of Object.entries(DEMO_PAGES)) {
      expect(page.id).toBe(key);
      expect(page.termCount).toBe(ORIGINAL_TERM_COUNTS[key]!);
    }
    expect(Object.keys(DEMO_PAGES).sort()).toEqual(Object.keys(ORIGINAL_TERM_COUNTS).sort());
  });

  test("suggestions reference existing pages or carry a url", () => {
    for (const s of DEMO_SUGGESTIONS) {
      if (s.docId) expect(DEMO_PAGES[s.docId], s.label).toBeDefined();
      else if (!s.demo) expect(s.url, s.label).toMatch(/^https:\/\//);
    }
  });
});
