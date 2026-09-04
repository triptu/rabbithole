import { describe, expect, test } from "bun:test";
import { alternateUrls, fetchReadable, isDegenerate } from "./fetch";

const jina = (title: string, body: string) => `Title: ${title}\n\nURL Source: x\n\nWarning: cached\n\nMarkdown Content:\n${body}`;

describe("fetch helpers", () => {
  test("arXiv html/abs links get the pdf and abstract as alternates", () => {
    expect(alternateUrls("https://arxiv.org/html/2602.06917v1")).toEqual(["https://arxiv.org/pdf/2602.06917v1", "https://arxiv.org/abs/2602.06917v1"]);
    expect(alternateUrls("https://arxiv.org/abs/1706.03762")).toEqual(["https://arxiv.org/pdf/1706.03762"]);
    expect(alternateUrls("https://en.wikipedia.org/wiki/CRISPR")).toEqual([]);
  });

  test("a figure caption or a stub is degenerate; an article is not", () => {
    expect(isDegenerate(jina("learner_distribution_001.svg", "An example of speedup."))).toBe(true);
    expect(isDegenerate(jina("Short", "Just a line."))).toBe(true);
    expect(isDegenerate(jina("Real paper", "x".repeat(500)))).toBe(false);
  });

  test("fetchReadable falls through to the first candidate with real text", async () => {
    const calls: string[] = [];
    const fetchImpl = (async (input: string | URL | Request, init?: RequestInit) => {
      const u = String(input);
      calls.push(u + ((init?.headers as Record<string, string>)?.["X-No-Cache"] ? " (no-cache)" : ""));
      const body = u.includes("/pdf/") ? jina("Real paper", "y".repeat(600)) : jina("fig.svg", "caption");
      return new Response(body, { status: 200 });
    }) as typeof fetch;
    const r = await fetchReadable("https://arxiv.org/html/2602.06917v1", { fetchImpl });
    expect(r.sourceUrl).toBe("https://arxiv.org/pdf/2602.06917v1");
    expect(calls).toEqual(["https://r.jina.ai/https://arxiv.org/html/2602.06917v1", "https://r.jina.ai/https://arxiv.org/pdf/2602.06917v1"]);
  });

  test("fetchReadable throws when every candidate is junk", async () => {
    const fetchImpl = (async () => new Response(jina("fig.svg", "caption"), { status: 200 })) as unknown as typeof fetch;
    await expect(fetchReadable("https://example.com/x", { fetchImpl })).rejects.toThrow(/without readable text/);
  });
});
