import { describe, expect, test } from "bun:test";
import { countMarkers, markerIds, phraseLabel, scopedId, segments, slug, strip } from "./markers";

const resolver = {
  labelFor: (id: string) => ({ softmax: "softmax", selfattention: "self-attention" })[id],
  idFor: (term: string) => scopedId("doc1", term),
};

describe("markers", () => {
  test("slug and scoped ids", () => {
    expect(slug("Multi-Head Attention!")).toBe("multiheadattention");
    expect(scopedId("d1", "guide RNA")).toBe("d1:guiderna");
  });

  test("segments known, aliased and unknown markers", () => {
    const segs = segments("a [[softmax]] then [[selfattention|attention]] and [[phage]].", resolver);
    expect(segs).toEqual([
      { kind: "text", text: "a " },
      { kind: "term", text: "softmax", label: "softmax", conceptId: "softmax" },
      { kind: "text", text: " then " },
      { kind: "term", text: "attention", label: "self-attention", conceptId: "selfattention" },
      { kind: "text", text: " and " },
      { kind: "term", text: "phage", label: "phage", conceptId: "doc1:phage" },
      { kind: "text", text: "." },
    ]);
  });

  test("strip keeps display text and known labels", () => {
    expect(strip("[[selfattention|Attention]] uses a [[softmax]] and [[phage]]", resolver.labelFor)).toBe(
      "Attention uses a softmax and phage",
    );
    expect(strip("[[selfattention]]")).toBe("selfattention");
  });

  test("count and ids", () => {
    expect(countMarkers("[[a]] [[b|x]] [[a]]")).toBe(3);
    expect(markerIds("[[a]] [[b|x]] [[a]]")).toEqual(["a", "b"]);
  });

  test("phraseLabel truncates", () => {
    expect(phraseLabel("short")).toBe("short");
    expect(phraseLabel("x".repeat(60))).toHaveLength(41);
  });
});
