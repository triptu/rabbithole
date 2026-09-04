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
 * Nothing starts out visited or bookmarked: history and "pick up where you left off"
 * fill in as the reader actually uses the app. The demo pages exist in the library
 * (reachable from the suggestions) but carry no history of their own.
 */
const PAGE_ORDER: string[] = [];
const CONCEPT_ORDER: string[] = [];

export function buildSeed(now = Date.now()): SeedData {
  // same day → keep the listed order by spacing items a minute apart
  const stamp = (daysAgo: number, rank: number) => now - daysAgo * DAY - rank * 60_000;
  /** visit time for listed items, undefined for never-visited ones */
  const visited = (order: string[], id: string, daysAgo: number) => {
    const i = order.indexOf(id);
    return i === -1 ? undefined : stamp(daysAgo, i);
  };

  // `bookmarked` from the canned data is deliberately ignored: nothing starts bookmarked
  const documents = Object.values(DEMO_PAGES).map(({ daysAgo, bookmarked: _b, ...page }): Document => ({
    ...page,
    source: "demo",
    createdAt: stamp(daysAgo, 0),
    openedAt: visited(PAGE_ORDER, page.id, daysAgo),
    bookmarked: false,
  }));

  const concepts = Object.entries(DEMO_CONCEPTS).map(([id, { daysAgo, bookmarked: _b, ...c }]): Concept => ({
    id,
    ...c,
    source: "demo",
    createdAt: stamp(daysAgo, 0),
    openedAt: visited(CONCEPT_ORDER, id, daysAgo),
    bookmarked: false,
  }));

  const notes = DEMO_NOTES.map((n, i) => ({ id: `seed-note-${i}`, ...n, createdAt: now - (DEMO_NOTES.length - i) }));

  return { documents, concepts, notes, profile: { ...DEMO_PROFILE, goal: "" } };
}
