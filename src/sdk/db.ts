/**
 * Persistence: Dexie (IndexedDB).
 *
 * The store is the in-memory source of truth while the app runs; every mutation is
 * written through here, and `loadAll()` hydrates the store on boot. A future sync
 * engine plugs in at this layer (mirror the same tables to a server) without touching
 * the store or UI.
 */
import Dexie, { type Table } from "dexie";
import type { Concept, Document, Profile, ReaderNote, Thread, Trail } from "./types";

type Setting = { key: string; value: unknown };

export class RabbitholeDB extends Dexie {
  documents!: Table<Document, string>;
  concepts!: Table<Concept, string>;
  threads!: Table<Thread, string>;
  trails!: Table<Trail, string>;
  notes!: Table<ReaderNote, string>;
  settings!: Table<Setting, string>;

  constructor(name = "rabbithole") {
    // resolve the IndexedDB implementation at construction time (lets tests inject fake-indexeddb)
    const g = globalThis as { indexedDB?: IDBFactory; IDBKeyRange?: typeof IDBKeyRange };
    super(name, g.indexedDB ? { indexedDB: g.indexedDB, IDBKeyRange: g.IDBKeyRange } : undefined);
    this.version(1).stores({
      documents: "id, openedAt, source",
      concepts: "id, docId, openedAt",
      threads: "conceptId",
      trails: "docId",
      notes: "id, createdAt",
      settings: "key",
    });
  }
}

export interface Snapshot {
  documents: Document[];
  concepts: Concept[];
  threads: Thread[];
  trails: Trail[];
  notes: ReaderNote[];
  profile: Profile | null;
  seeded: boolean;
}

export const SETTING_PROFILE = "profile";
export const SETTING_SEEDED = "seeded";

/** Read everything the store needs at boot. */
export async function loadAll(db: RabbitholeDB): Promise<Snapshot> {
  const [documents, concepts, threads, trails, notes, profile, seeded] = await Promise.all([
    db.documents.toArray(),
    db.concepts.toArray(),
    db.threads.toArray(),
    db.trails.toArray(),
    db.notes.toArray(),
    db.settings.get(SETTING_PROFILE),
    db.settings.get(SETTING_SEEDED),
  ]);
  return {
    documents,
    concepts,
    threads,
    trails,
    notes,
    profile: (profile?.value as Profile | undefined) ?? null,
    seeded: Boolean(seeded?.value),
  };
}

/**
 * Write-through helpers. Fire and forget from the store; failures are logged, never
 * thrown into the UI (IndexedDB can be unavailable in private windows).
 */
export function writer(db: RabbitholeDB) {
  const safe = (p: Promise<unknown>) => {
    p.catch((e) => console.warn("[rabbithole] persist failed", e));
  };
  return {
    document: (d: Document) => safe(db.documents.put(d)),
    concept: (c: Concept) => safe(db.concepts.put(c)),
    thread: (t: Thread) => safe(db.threads.put(t)),
    trail: (t: Trail) => safe(db.trails.put(t)),
    notes: (notes: ReaderNote[]) =>
      safe(db.transaction("rw", db.notes, async () => {
        await db.notes.clear();
        await db.notes.bulkPut(notes);
      })),
    profile: (p: Profile) => safe(db.settings.put({ key: SETTING_PROFILE, value: p })),
    seeded: () => safe(db.settings.put({ key: SETTING_SEEDED, value: true })),
    bulk: (s: Partial<Omit<Snapshot, "profile" | "seeded">>) =>
      safe(db.transaction("rw", [db.documents, db.concepts, db.threads, db.trails, db.notes], async () => {
        if (s.documents) await db.documents.bulkPut(s.documents);
        if (s.concepts) await db.concepts.bulkPut(s.concepts);
        if (s.threads) await db.threads.bulkPut(s.threads);
        if (s.trails) await db.trails.bulkPut(s.trails);
        if (s.notes) await db.notes.bulkPut(s.notes);
      })),
  };
}

export type Writer = ReturnType<typeof writer>;
