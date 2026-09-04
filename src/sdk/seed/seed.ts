/**
 * Turns the demo content into real records on first boot.
 */
import type { Concept, Document, Profile, ReaderNote } from "../types";
import { DEMO_CONCEPTS, DEMO_NOTES, DEMO_PAGES, DEMO_PROFILE } from "./canned";

const DAY = 86_400_000;

export interface SeedData {
  documents: Document[];
  concepts: Concept[];
  notes: ReaderNote[];
  profile: Profile;
}

/**
 * What the demo reader has already visited, most recent first — the prototype's history
 * lists. Anything not listed exists in the library but has never been opened.
 */
const PAGE_ORDER = ["lab", "pr", "bft", "code", "tx", "cr"];
const CONCEPT_ORDER = [
  "hba1c", "egfr", "tinylfu", "countminsketch", "quorum", "consensus", "byzantine", "harmonicmean",
  "positional", "multihead", "softmax", "selfattention", "offtarget", "guiderna", "cas9", "endonuclease", "crispr",
];

export function buildSeed(now = Date.now()): SeedData {
  // same day → keep the listed order by spacing items a minute apart
  const stamp = (daysAgo: number, rank: number) => now - daysAgo * DAY - rank * 60_000;
  /** visit time for listed items, undefined for never-visited ones */
  const visited = (order: string[], id: string, daysAgo: number) => {
    const i = order.indexOf(id);
    return i === -1 ? undefined : stamp(daysAgo, i);
  };

  const documents = Object.values(DEMO_PAGES).map(({ daysAgo, bookmarked, ...page }): Document => ({
    ...page,
    source: "demo",
    createdAt: stamp(daysAgo, 0),
    openedAt: visited(PAGE_ORDER, page.id, daysAgo),
    bookmarked: bookmarked ?? false,
  }));

  const concepts = Object.entries(DEMO_CONCEPTS).map(([id, { daysAgo, bookmarked, ...c }]): Concept => ({
    id,
    ...c,
    source: "demo",
    createdAt: stamp(daysAgo, 0),
    openedAt: visited(CONCEPT_ORDER, id, daysAgo),
    bookmarked: bookmarked ?? false,
  }));

  const notes = DEMO_NOTES.map((n, i) => ({ id: `seed-note-${i}`, ...n, createdAt: now - (DEMO_NOTES.length - i) }));

  return { documents, concepts, notes, profile: { ...DEMO_PROFILE, goal: "" } };
}
