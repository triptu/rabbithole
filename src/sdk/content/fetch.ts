/**
 * Fetching source text for a url. Uses Jina Reader (html → markdown) so the agent
 * receives clean text. If this fails the agent is asked to fetch the url itself.
 */

const MAX_CHARS = 12_000;

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

export async function fetchUrlMarkdown(url: string, fetchImpl: typeof fetch = fetch): Promise<string> {
  const clean = displayUrl(normalizeUrl(url));
  const res = await fetchImpl(`https://r.jina.ai/https://${clean}`);
  if (!res.ok) throw new Error(`Could not fetch that page (${res.status})`);
  const text = await res.text();
  return text.slice(0, MAX_CHARS);
}
