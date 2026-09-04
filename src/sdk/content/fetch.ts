/**
 * Fetching source text for a url. Uses Jina Reader (html → markdown) so the agent
 * receives clean text.
 *
 * Some pages defeat the reader (arXiv's HTML renders come back as one figure caption),
 * so `fetchReadable` tries a short list of candidates — the arXiv PDF for arXiv links,
 * then an uncached retry — and rejects results that carry no real text.
 */

const MAX_CHARS = 60_000;
/** fewer characters of body than this is a caption or an error page, not an article */
const MIN_BODY_CHARS = 400;

export function looksLikeUrl(input: string): boolean {
  const v = input.trim();
  return /^(https?:\/\/|www\.)?[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/i.test(v) && !v.includes(" ");
}

export function normalizeUrl(input: string): string {
  const v = input.trim();
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

export function domainOf(url: string): string {
  return url.replace(/^https?:\/\//i, "").split("/")[0] ?? url;
}

/** display form: no protocol */
export function displayUrl(url: string): string {
  return url.replace(/^https?:\/\//i, "");
}

export interface FetchOptions {
  /** ask the reader to skip its cache (slower, but a stale snapshot can be junk) */
  noCache?: boolean;
  fetchImpl?: typeof fetch;
}

/** One reader call. Throws on HTTP errors. */
export async function fetchUrlMarkdown(url: string, opts: FetchOptions = {}): Promise<string> {
  const clean = displayUrl(normalizeUrl(url));
  const headers: Record<string, string> = {};
  if (opts.noCache) headers["X-No-Cache"] = "true";
  const res = await (opts.fetchImpl ?? fetch)(`https://r.jina.ai/https://${clean}`, { headers });
  if (!res.ok) throw new Error(`Could not fetch that page (${res.status})`);
  const text = await res.text();
  return text.slice(0, MAX_CHARS);
}

const ARXIV = /^https?:\/\/(?:www\.)?arxiv\.org\/(?:html|abs|pdf)\/([\w.\-/]+?)(?:\.pdf)?\/?$/i;

/**
 * Where else the same document lives, in the order worth trying. arXiv's PDF reads
 * far better through the reader than its HTML render or its abstract page.
 */
export function alternateUrls(url: string): string[] {
  const m = url.match(ARXIV);
  if (m) {
    const id = m[1]!;
    return [`https://arxiv.org/pdf/${id}`, `https://arxiv.org/abs/${id}`].filter((u) => u !== url);
  }
  return [];
}

/** Jina's header block, up to and including the "Markdown Content:" line. */
const READER_HEADER = /^(?:[A-Z][\w ]*:[^\n]*\n\n?)*?Markdown Content:\n/;

/** True when the reader returned a caption, a stub or an error page rather than an article. */
export function isDegenerate(raw: string): boolean {
  const title = raw.match(/^Title:\s*(.+)$/m)?.[1]?.trim() ?? "";
  if (/\.(svg|png|jpe?g|gif|webp|pdf)$/i.test(title)) return true;
  const body = raw.replace(READER_HEADER, "").trim();
  return body.length < MIN_BODY_CHARS;
}

export interface Readable {
  text: string;
  /** the url that actually produced the text (may differ from what was asked) */
  sourceUrl: string;
}

/**
 * Fetch text worth reading: the url, then its alternates, then an uncached retry of
 * the url. Throws when nothing yields real text.
 */
export async function fetchReadable(url: string, opts: FetchOptions = {}): Promise<Readable> {
  const attempts: { url: string; noCache: boolean }[] = [
    { url, noCache: false },
    ...alternateUrls(url).map((u) => ({ url: u, noCache: false })),
    { url, noCache: true },
  ];
  let lastError: Error | null = null;
  for (const a of attempts) {
    try {
      const text = await fetchUrlMarkdown(a.url, { ...opts, noCache: a.noCache });
      if (!isDegenerate(text)) return { text, sourceUrl: a.url };
      lastError = new Error("the page came back without readable text");
    } catch (e) {
      lastError = e as Error;
    }
  }
  throw lastError ?? new Error("could not fetch that page");
}
