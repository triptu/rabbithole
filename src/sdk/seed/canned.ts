/**
 * Demo content: the documents and concepts the app ships with so it reads well
 * before any agent is connected. Migrated verbatim from the design prototype
 * (`ai-export/rabbithole-data.js` + the article bodies in `rabbithole.html`).
 *
 * `daysAgo` is relative — the seeder turns it into real timestamps so history
 * labels ("today", "yesterday", …) stay meaningful.
 */
import type { Block, Document, Link } from "../types";

export type DemoPage = Omit<Document, "createdAt" | "openedAt" | "bookmarked" | "source"> & {
  daysAgo: number;
  bookmarked?: boolean;
};

export type DemoConcept = {
  docId: string;
  label: string;
  short: string;
  long: string;
  anec: string | null;
  links: Link[];
  bookmarked?: boolean;
  daysAgo: number;
};

const yt = (t: string, q = t): Link => ({ k: "YT", t, u: "https://www.youtube.com/results?search_query=" + encodeURIComponent(q) });
const read = (t: string, q = t): Link => ({ k: "READ", t, u: "https://www.google.com/search?q=" + encodeURIComponent(q) });
const wiki = (t: string, q = t): Link => ({ k: "WIKI", t, u: "https://en.wikipedia.org/w/index.php?search=" + encodeURIComponent(q) });

const para = (text: string): Block => ({ type: "paragraph", text });

// ------------------------------------------------------------------ pages

export const DEMO_PAGES: Record<string, DemoPage> = {
  tx: {
    id: "tx",
    title: "Attention Is All You Need",
    url: "arxiv.org/abs/1706.03762",
    domain: "arxiv.org",
    meta: "Vaswani et al., 2017 · Google Brain",
    termCount: 6,
    daysAgo: 2,
    blocks: [
      para("Dominant sequence models rely on recurrent or convolutional networks with an encoder and a decoder. We propose the Transformer, a simpler architecture based entirely on [[selfattention|self-attention]], dispensing with recurrence and convolutions entirely."),
      para("Because the model contains no recurrence, we inject [[positional|positional encodings]] so it can use token order. Attention weights are normalized with a [[softmax]], and [[multihead|multi-head attention]] lets the model watch different relationships in parallel."),
      para("Decoding is [[autoregressive]]: each output token conditions on the ones already produced. On English→German translation the model reaches 28.4 [[bleu|BLEU]], beating prior ensembles at a fraction of the training cost."),
    ],
  },

  cr: {
    id: "cr",
    title: "CRISPR gene editing",
    url: "en.wikipedia.org/wiki/CRISPR_gene_editing",
    domain: "wikipedia.org",
    meta: "Wikipedia · simplified view",
    termCount: 8,
    daysAgo: 14,
    blocks: [
      para("[[crispr|CRISPR]] is a family of DNA sequences found in the genomes of [[prokaryotic]] organisms such as bacteria. Each sequence is copied from a [[bacteriophage]] that infected the cell in the past, so the collection works as a molecular memory of previous attacks."),
      para("The name is short for clustered, regularly interspaced, short [[palindromic]] repeats. When the same invader returns, the cell uses the stored snippet to recognize it — then deploys an [[endonuclease]] to slice the intruder's DNA apart."),
      para("In 2012, researchers showed that one such protein, [[cas9|Cas9]], could be reprogrammed with a synthetic [[guiderna|guide RNA]] to cut nearly any DNA sequence. The main open challenge is [[offtarget|off-target]] effects, where edits land in unintended places."),
    ],
  },

  bft: {
    id: "bft",
    title: "Byzantine fault tolerance",
    url: "en.wikipedia.org/wiki/Byzantine_fault",
    domain: "wikipedia.org",
    meta: "Wikipedia · simplified view",
    termCount: 3,
    daysAgo: 0,
    blocks: [
      para("A reliable computer system must handle components that fail in confusing ways — not just crashing, but sending conflicting information to different parts of the system. This is called a [[byzantine|Byzantine fault]], after a thought experiment about generals coordinating an attack through messengers who may be traitors."),
      para("Tolerating it means reaching [[consensus]]: every honest node commits the same decisions in the same order. Practical protocols do this by collecting a [[quorum]] of matching votes — with 3f+1 nodes, agreement survives f traitors."),
    ],
  },

  code: {
    id: "code",
    title: "hyperloglog.ts",
    url: "github.com/acme/analytics/blob/main/src/hyperloglog.ts",
    domain: "github.com",
    meta: "Code · src/hyperloglog.ts · main",
    termCount: 4,
    daysAgo: 1,
    blocks: [
      {
        type: "code",
        lines: [
          "// Estimate distinct users without storing them — [[hyperloglog|HyperLogLog]]",
          "const REGISTERS = 2048;  // m = 2^11",
          "",
          "function add(hash: number, M: Uint8Array) {",
          "  const idx = hash >>> 21;  // first 11 bits pick a register",
          "  const rho = Math.clz32(hash << 11) + 1;  // [[leadingzeros|leading-zero rank]]",
          "  M[idx] = Math.max(M[idx], rho);  // keep the record streak",
          "}",
          "",
          "function estimate(M: Uint8Array): number {",
          "  const Z = 1 / sum(M, r => 2 ** -r);  // [[harmonicmean|harmonic mean]] of 2^-r",
          "  return ALPHA * REGISTERS ** 2 * Z;  // [[biascorrection|bias-corrected]] [[cardinality]]",
          "}",
        ],
      },
      { type: "hint", text: "Highlight any line and ask — “why shift by 21?” works here too." },
    ],
  },

  pr: {
    id: "pr",
    title: "PR #482 · cache: LRU → W-TinyLFU",
    url: "github.com/acme/gateway/pull/482",
    domain: "github.com",
    meta: "Pull request · acme/gateway · +38 −9",
    termCount: 4,
    daysAgo: 0,
    blocks: [
      {
        type: "summary",
        items: [
          { k: "WHAT", text: "Adds a frequency gate in front of cache eviction.", tone: "accent" },
          { k: "WHY", text: "Nightly exports flush the working set — [[hitratio|hit ratio]] drops 30pts.", tone: "accent" },
          { k: "RISK", text: "New-key cold starts if the admission window is sized wrong.", tone: "warn" },
        ],
      },
      {
        type: "diff",
        file: "src/cache/session-cache.ts",
        lines: [
          { kind: "del", text: "const cache = new LRUCache({ max: 50_000 });" },
          { kind: "add", text: "const sketch = new [[countminsketch|CountMinSketch]]({ width: 4096, depth: 4 });" },
          { kind: "add", text: "const cache = new [[tinylfu|WTinyLFU]]({ max: 50_000, sketch });" },
          { kind: "skip", text: "..." },
          { kind: "ctx", text: "set(key: string, value: Session) {" },
          { kind: "add", text: "  // reject one-hit wonders before they evict warm keys ([[scanresistance|scan resistance]])" },
          { kind: "add", text: "  if (cache.isFull() && !sketch.admit(key)) return;" },
          { kind: "ctx", text: "  cache.set(key, value);" },
          { kind: "ctx", text: "}" },
        ],
      },
      { type: "hint", text: "Highlight a hunk and ask “how is this different from our impl?” — with repo context, the answer compares against your codebase." },
    ],
  },

  lab: {
    id: "lab",
    title: "Blood test results · Aug 28",
    url: "portal.quest.example/results/8841",
    domain: "patient portal",
    meta: "Comprehensive metabolic panel + lipids · fasting",
    termCount: 6,
    daysAgo: 0,
    blocks: [
      {
        type: "table",
        columns: ["TEST", "RESULT", "REFERENCE", "FLAG"],
        rows: [
          [{ text: "[[hba1c|Hemoglobin A1c]]" }, { text: "5.9 %", mono: true }, { text: "< 5.7", muted: true }, { text: "HIGH", flag: true }],
          [{ text: "Glucose, fasting" }, { text: "104 mg/dL", mono: true }, { text: "65–99", muted: true }, { text: "HIGH", flag: true }],
          [{ text: "[[creatinine|Creatinine]]" }, { text: "1.02 mg/dL", mono: true }, { text: "0.70–1.25", muted: true }, { text: "" }],
          [{ text: "[[egfr|eGFR]]" }, { text: "88", mono: true }, { text: "> 60", muted: true }, { text: "" }],
          [{ text: "[[ldl|LDL cholesterol]]" }, { text: "131 mg/dL", mono: true }, { text: "< 100", muted: true }, { text: "HIGH", flag: true }],
          [{ text: "HDL cholesterol" }, { text: "52 mg/dL", mono: true }, { text: "> 40", muted: true }, { text: "" }],
          [{ text: "[[triglycerides|Triglycerides]]" }, { text: "168 mg/dL", mono: true }, { text: "< 150", muted: true }, { text: "HIGH", flag: true }],
        ],
      },
      { type: "note", text: "Physician note: A1c and lipids trending up since Feb. Recommend lifestyle changes and recheck in 3 months. Not a diagnosis." },
      { type: "hint", text: "Highlight a row and ask “should I be worried about this?” — the answer is tuned to you, not a generic pamphlet." },
    ],
  },

  tax: {
    id: "tax",
    title: "Schedule K-1 (Form 1065)",
    url: "irs.gov/forms-pubs/about-schedule-k-1-form-1065",
    domain: "irs.gov",
    meta: "Partner’s share of income · tax year 2025",
    termCount: 5,
    // not in the demo history → treated as opened around the same time as the oldest entries
    daysAgo: 14,
    blocks: [
      para("You received this form because the partnership you invested in is a [[passthrough|pass-through entity]]: it doesn’t pay tax itself. Instead each partner reports their share of every kind of income on their own return."),
      para("Box 1 shows your [[ordinaryincome|ordinary business income]] of $18,420. You owe tax on it even though only $6,000 was distributed to you in cash. If you actively work in the business, it is also subject to [[secatax|self-employment tax]]."),
      para("Box 12 carries a $3,100 [[section179|Section 179 deduction]] you may be able to use this year. Item L tracks your [[capitalaccount|capital account]] — the number that will matter when you eventually sell your stake."),
    ],
  },
};

// --------------------------------------------------------------- concepts

export const DEMO_CONCEPTS: Record<string, DemoConcept> = {
  // — Transformer paper —
  selfattention: {
    docId: "tx", label: "self-attention", bookmarked: true, daysAgo: 2,
    short: "A layer where every token in the sequence looks at every other token and decides how much each one matters for understanding itself.",
    long: "Each token is projected into a query, a key, and a value vector. Token i's query is dotted against every key to get relevance scores; those scores (after a [[softmax]]) weight a sum of the value vectors. Token i's new representation becomes a mixture of whichever tokens mattered to it — computed for all pairs at once as matrix multiplies. Running several of these in parallel is [[multihead|multi-head attention]].",
    anec: "A hash-join over the whole sequence: every row queries every other row, scores the matches, and aggregates — one vectorized op instead of a loop.",
    links: [yt("Attention, visualized (3Blue1Brown)"), read("The Illustrated Transformer")],
  },
  softmax: {
    docId: "tx", label: "softmax", daysAgo: 2,
    short: "A function that turns a list of raw scores into positive weights that add up to 1 — a probability distribution.",
    long: "Exponentiate each score, then divide by the sum of the exponentials. Big scores get amplified, small ones shrink toward zero, everything stays positive and sums to 1. In attention it converts raw match scores into 'how much should I listen to each token' percentages.",
    anec: "Normalizing a ranker's scores: exp() then divide by the total, so downstream code can treat outputs as percentages.",
    links: [yt("Softmax in 60 seconds"), wiki("Softmax function")],
  },
  positional: {
    docId: "tx", label: "positional encoding", daysAgo: 2,
    short: "Extra numbers added to each token's embedding that encode where it sits in the sequence — because [[selfattention|attention]] itself ignores order.",
    long: "[[selfattention|Attention]] treats input as a set: 'dog bites man' and 'man bites dog' would look identical. The fix is adding a position-dependent vector to each embedding. The paper uses sine and cosine waves of different frequencies, so each position gets a unique fingerprint and relative offsets stay easy to learn.",
    anec: "Like carrying an index column when you shove rows into an unordered set — the structure loses order, so position rides along as a field.",
    links: [yt("Positional encodings explained"), read("Transformer architecture notes")],
  },
  multihead: {
    docId: "tx", label: "multi-head attention", daysAgo: 2,
    short: "Running several [[selfattention|attention]] layers in parallel, each with its own learned projections, then concatenating the results.",
    long: "One attention pass can only mix information one way. With 8 heads, each projects tokens into its own smaller subspace and attends independently — one head might track syntax, another coreference. Outputs are concatenated and projected back: same total compute, more expressive. Each head still normalizes its own scores with a [[softmax]].",
    anec: "Sharding one big query across 8 workers, each hitting a different index, then merging the result sets.",
    links: [yt("Multi-head attention, visualized")],
  },
  autoregressive: {
    docId: "tx", label: "autoregressive", daysAgo: 2,
    short: "Generating output one token at a time, where each new token is predicted from everything generated so far.",
    long: "The decoder can't see the future: at step t it conditions only on tokens 1..t−1, enforced by masking. At inference you sample a token, append it, and run again — which is why generation is sequential even though training parallelizes.",
    anec: "A fold over your own output: each iteration's input includes everything you've already emitted.",
    links: [wiki("Autoregressive model")],
  },
  bleu: {
    docId: "tx", label: "BLEU", daysAgo: 2,
    short: "A 0–100 score for machine translation: how much the output's word chunks overlap with human reference translations.",
    long: "BLEU counts matching n-grams (1–4 word chunks) between system output and references, with a penalty for outputs that run short. It's crude — it sees overlap, not meaning — but it's cheap and consistent enough to compare systems. 28.4 was state of the art for English→German in 2017.",
    anec: "A diff score against a golden fixture — measures token overlap, not semantic correctness.",
    links: [wiki("BLEU")],
  },

  // — CRISPR page —
  crispr: {
    docId: "cr", label: "CRISPR", daysAgo: 14,
    short: "A filing system bacteria keep of [[bacteriophage|viruses]] that attacked them — scientists repurposed it as a precise 'find & replace' for DNA.",
    long: "Bacteria paste small snippets of an attacker's DNA between repeating [[palindromic]] spacers in their own genome. Next time that attacker shows up, the [[prokaryotic]] cell transcribes the snippet, hands it to a cutting protein, and destroys anything that matches. In the lab we swap in a snippet of our choosing — so the machinery cuts wherever we point it.",
    anec: "A denylist the cell maintains: fingerprints of past attackers, pattern-matched against every piece of incoming DNA.",
    links: [yt("CRISPR in 100 seconds"), wiki("CRISPR gene editing")],
  },
  prokaryotic: {
    docId: "cr", label: "prokaryotic", daysAgo: 14,
    short: "Describes simple single-celled life — like bacteria — whose cells have no nucleus; the DNA floats freely inside.",
    long: "Life runs on two cell plans. Prokaryotes (bacteria, archaea) keep DNA coiled loose in the cytoplasm; eukaryotes (plants, animals, you) wrap theirs in a membrane-bound nucleus. Prokaryotes are smaller, older, and reproduce in minutes — which is why they evolve defenses like CRISPR so fast.",
    anec: "Everything runs in one global scope — there's no nucleus acting as a separate namespace for the DNA.",
    links: [yt("Prokaryotes vs eukaryotes"), read("Khan Academy — cell structure")],
  },
  bacteriophage: {
    docId: "cr", label: "bacteriophage", daysAgo: 14,
    short: "A virus that only infects [[prokaryotic|bacteria]]: it lands on the cell, injects its DNA, and hijacks the cell to make copies of itself.",
    long: "Phages are the most abundant biological entities on Earth — a protein shell wrapped around a strand of genetic code. One lands on a [[prokaryotic|bacterium]], injects its DNA, and the host's own machinery is repurposed to assemble new phages until the cell bursts. CRISPR evolved specifically as a defense against them.",
    anec: "A code-injection attack: the phage delivers a payload that hijacks the host runtime to compile copies of itself.",
    links: [yt("The deadliest being on Earth"), wiki("Bacteriophage")],
  },
  palindromic: {
    docId: "cr", label: "palindromic", daysAgo: 14,
    short: "Reads the same forwards and backwards — in DNA, a sequence that matches its mirror on the paired strand, like GAATTC.",
    long: "Reading one strand forwards matches reading the paired strand backwards — GAATTC pairs with CTTAAG. These mirror structures can fold into hairpins, which makes them easy landmarks for proteins to find and bind.",
    anec: "A string that equals its reverse — except DNA checks it against the complementary strand, like validating a reversed checksum.",
    links: [wiki("Palindromic sequence")],
  },
  endonuclease: {
    docId: "cr", label: "endonuclease", daysAgo: 14,
    short: "An enzyme that cuts DNA from the middle of the strand, not from the ends — molecular scissors.",
    long: "Nucleases are enzymes that break down nucleic acids. Exonucleases nibble from the ends; endonucleases cut somewhere in the middle. Restriction endonucleases — the kind bacteria aim at invaders — cut only at specific short sequences, which is what makes them useful as precision tools. The famous [[cas9|Cas9]] belongs to this family.",
    anec: "splice(), not pop(): it cuts mid-array instead of trimming from the ends.",
    links: [wiki("Nuclease"), read("Molecular scissors, explained")],
  },
  cas9: {
    docId: "cr", label: "Cas9", bookmarked: true, daysAgo: 14,
    short: "The protein that does the actual cutting in CRISPR editing — scissors that open DNA and snip both strands wherever the [[guiderna|guide RNA]] points.",
    long: "Cas9 grabs a [[guiderna|guide RNA]], unzips DNA wherever it finds a match, and makes a clean double-strand cut — textbook [[endonuclease]] behavior. The cell's repair crew rushes in — and we exploit that repair to delete or paste in new sequence.",
    anec: "A generic execution engine: the same binary runs everywhere, and the guide RNA is just the config file that sets the target.",
    links: [yt("How CRISPR-Cas9 works (animation)"), read("Nature — the CRISPR toolbox")],
  },
  guiderna: {
    docId: "cr", label: "guide RNA", daysAgo: 14,
    short: "A short synthetic RNA strand that tells Cas9 exactly where to cut — the address label for the scissors.",
    long: "About 20 letters long. It base-pairs with matching DNA; only where all ~20 letters line up does Cas9 cut. Change the guide, change the target — no need to engineer a new protein each time. Loose matches are what cause [[offtarget|off-target]] cuts.",
    anec: "A ~20-character search pattern: Cas9 is grep, the guide RNA is the regex.",
    links: [yt("Designing guide RNAs"), read("Addgene — guide RNA 101")],
  },
  offtarget: {
    docId: "cr", label: "off-target", daysAgo: 14,
    short: "When the edit lands somewhere it shouldn't — Cas9 cuts a similar-but-wrong DNA sequence.",
    long: "Genomes are huge, so near-matches of any 20-letter guide exist somewhere. Cuts there can disable a random gene. Better guide design and higher-fidelity Cas9 variants reduce this — it's the main safety hurdle for therapies.",
    anec: "Your regex was too loose — it matched strings you never meant to touch.",
    links: [read("Off-target effects in therapies"), wiki("Off-target genome editing")],
  },

  // — Byzantine fault tolerance page —
  byzantine: {
    docId: "bft", label: "Byzantine fault", bookmarked: true, daysAgo: 0,
    short: "A failure where a component doesn't just crash — it keeps running and sends wrong or contradictory information, possibly maliciously.",
    long: "Named after a thought experiment: generals besieging a city must agree on a plan, but some messengers — or generals — may be traitors sending different messages to different people. A crashed node is easy; a lying node is the hard case — surviving it while still reaching [[consensus]] is what Byzantine fault tolerant protocols do.",
    anec: "A service that returns 200 with corrupted payloads is far worse than one that just dies — that is the Byzantine case.",
    links: [yt("Byzantine generals problem, explained"), wiki("Byzantine fault")],
  },
  consensus: {
    docId: "bft", label: "consensus", daysAgo: 0,
    short: "Getting a group of machines to agree on a single value or ordering, even when some fail or messages arrive late.",
    long: "Every honest node must commit the same decisions in the same order, despite lost messages, slow networks, and faulty peers. Crash-tolerant protocols (Raft, Paxos) assume nodes fail silently; Byzantine protocols (PBFT) survive nodes that lie, at the cost of more replicas and more message rounds. Commits count only once a [[quorum]] of matching votes arrives.",
    anec: "The problem Raft and Paxos solve — one agreed, replicated log that every node applies identically.",
    links: [read("Raft — understandable consensus"), wiki("Consensus (computer science)")],
  },
  quorum: {
    docId: "bft", label: "quorum", daysAgo: 0,
    short: "The minimum number of nodes that must agree for a decision to count — sized so any two quorums always overlap.",
    long: "With 3f+1 replicas you need 2f+1 matching votes to commit: any two such sets share at least f+1 nodes, so at least one honest node witnesses both decisions and conflicting commits become impossible.",
    anec: "Majority write concern in your database: overlap between read and write sets is what makes the guarantee hold.",
    links: [wiki("Quorum (distributed computing)")],
  },

  // — code demo: hyperloglog.ts —
  hyperloglog: {
    docId: "code", label: "HyperLogLog", bookmarked: true, daysAgo: 1,
    short: "An algorithm that counts distinct items in a stream using a few kilobytes, by tracking [[leadingzeros|lucky hash patterns]] instead of storing the items.",
    long: "Hash every item. Rare patterns (many leading zeros) imply you must have seen many distinct items — one item with 20 leading zeros suggests ~2^20 distinct inputs. Split the stream across 2048 registers, keep each register’s record streak, and combine them with a [[harmonicmean|harmonic mean]] for a [[cardinality]] estimate within ~2%.",
    anec: "COUNT(DISTINCT user_id) over a firehose with 2KB of memory instead of a 4GB hash set — this is what Redis PFCOUNT does.",
    links: [yt("HyperLogLog explained visually", "HyperLogLog explained"), read("The original HLL paper, annotated", "hyperloglog paper annotated")],
  },
  cardinality: {
    docId: "code", label: "cardinality", daysAgo: 1,
    short: "The number of distinct elements in a set — 1M events from 40K users has cardinality 40K.",
    long: "Exact cardinality needs memory proportional to the answer (a set of everything seen). Sketches like HyperLogLog trade exactness for constant memory — fine when “about 40K” is as actionable as “39,847”.",
    anec: "SELECT COUNT(DISTINCT x) — the expensive one your query planner warns you about.",
    links: [wiki("Cardinality")],
  },
  leadingzeros: {
    docId: "code", label: "leading-zero rank (ρ)", daysAgo: 1,
    short: "The position of the first 1-bit in a hash. A hash starting with k zeros is a 1-in-2^k event — evidence you’ve seen ~2^k distinct items.",
    long: "Think coin flips: flipping 10 heads in a row is rare, so if your best streak is 10, you’ve probably flipped ~2^10 times. Each hash is a run of coin flips; the register just remembers the best streak it has witnessed. One register is noisy — that’s why HLL keeps 2048 and averages.",
    anec: "Math.clz32(hash) — the CPU even has an instruction for it (LZCNT).",
    links: [yt("Why leading zeros estimate counts", "hyperloglog leading zeros intuition")],
  },
  harmonicmean: {
    docId: "code", label: "harmonic mean", daysAgo: 1,
    short: "An average that’s dominated by the smallest values — one wild overestimate can’t drag it up the way it would an ordinary mean.",
    long: "Average of rates: n divided by the sum of reciprocals. In HLL each register’s estimate is a power of two, so a single lucky register could be 1000× too high; the arithmetic mean would be wrecked, the harmonic mean barely moves. It’s the statistical seatbelt of the algorithm.",
    anec: "Same reason you don’t average request rates directly when boxes handle different loads — outlier resistance, like p50 vs mean.",
    links: [wiki("Harmonic mean")],
  },
  biascorrection: {
    docId: "code", label: "bias correction (α)", daysAgo: 1,
    short: "A constant (≈0.72 for 2048 registers) that cancels the systematic overestimate the raw formula produces.",
    long: "The raw harmonic-mean estimate is provably biased high by a factor that depends only on the register count, so it’s corrected with a precomputed α. Small and large counts get extra corrections (linear counting below ~5m/2, hash-space clamping near 2^32).",
    anec: "A calibration constant — like subtracting your scale’s known 300g offset rather than buying a better scale.",
    links: [read("HLL bias correction explained", "hyperloglog bias correction alpha")],
  },

  // — PR demo: LRU -> TinyLFU —
  tinylfu: {
    docId: "pr", label: "W-TinyLFU", bookmarked: true, daysAgo: 0,
    short: "A cache admission policy: before a new key may evict a warm one, it must prove it’s seen more often — frequency tracked in a tiny [[countminsketch|sketch]].",
    long: "LRU admits everything, so one table scan can flush your working set. TinyLFU keeps an approximate frequency count of everything that has knocked on the door; on a full cache, the newcomer is compared with the eviction victim and only wins if its count is higher. A small LRU “window” in front catches genuinely new-but-hot keys. This is what Caffeine uses, and why its hit rates beat plain LRU.",
    anec: "A bouncer with a clicker: you don’t get into the full club just for showing up — someone leaves only if you’ve been seen at the door more than they have.",
    links: [read("TinyLFU paper / Caffeine design", "tinylfu caffeine cache design"), yt("Caffeine cache internals talk", "caffeine cache tinylfu talk")],
  },
  countminsketch: {
    docId: "pr", label: "count-min sketch", daysAgo: 0,
    short: "A tiny 2D array of counters that answers “about how many times has X occurred?” using hashing — never undercounts, occasionally overcounts.",
    long: "d hash functions map each key to one counter per row; increment all d on write, take the minimum on read. Collisions only inflate counts, so min-of-d bounds the error. TinyLFU uses 4-bit counters and periodically halves everything so the sketch “forgets” stale popularity.",
    anec: "A Bloom filter that counts instead of answering yes/no — same trick, hash collisions traded for O(1) memory.",
    links: [wiki("Count–min sketch")],
  },
  scanresistance: {
    docId: "pr", label: "scan resistance", daysAgo: 0,
    short: "A cache’s ability to survive a burst of one-time keys (a backup job, a crawler) without evicting the keys that actually get re-used.",
    long: "Sequential scans are poison for LRU: every scanned key is “most recent”, so the whole working set is evicted for keys that will never be requested again. Admission policies fix this at the door — a key seen once loses the frequency comparison and never enters.",
    anec: "The nightly export that used to tank your Redis hit rate from 94% to 60% until morning traffic re-warmed it.",
    links: [read("Cache scan resistance patterns", "cache scan resistance lru")],
  },
  hitratio: {
    docId: "pr", label: "hit ratio", daysAgo: 0,
    short: "The fraction of lookups served from cache. The number this whole PR exists to move.",
    long: "Every point of hit ratio is load taken off the backing store — going 92%→96% doesn’t read as “4% better”, it halves the miss traffic your database sees. Admission policies buy hit ratio without buying RAM.",
    anec: "The dashboard panel you check after this deploy: cache_hits / (cache_hits + cache_misses).",
    links: [read("Measuring cache effectiveness", "cache hit ratio measurement")],
  },

  // — Blood test page —
  hba1c: {
    docId: "lab", label: "HbA1c", daysAgo: 0,
    short: "Your average blood sugar over the last ~3 months, read off how much sugar has stuck to your red blood cells. 5.9% is the [[prediabetes|prediabetic]] band (5.7–6.4).",
    long: "Glucose bonds permanently to hemoglobin; red cells live about 120 days, so the share that is “sugared” is a rolling 3-month average that one good week can’t fake. Below 5.7 is normal, 6.5+ is the diabetes threshold. Diet, exercise and sleep move it, slowly — retest in 3 months, not 3 weeks.",
    anec: "It’s a rolling average of a noisy metric — a single point-in-time glucose reading is a spot sample; this is the p50 over a quarter.",
    links: [read("A1C test — what the number means", "hba1c 5.9 meaning")],
  },
  prediabetes: {
    docId: "lab", label: "prediabetes", daysAgo: 0,
    short: "Blood sugar is above normal but below the diabetes cut-off. It’s a warning, not a diagnosis — and it’s often reversible.",
    long: "Roughly a third of adults are in this band and most don’t know it. Losing 5–7% of body weight and 150 min/week of movement cuts progression risk by about half in trials. Your doctor may also look at fasting glucose and [[triglycerides]] together with this.",
    anec: null,
    links: [read("Prediabetes — CDC overview", "prediabetes reversible cdc")],
  },
  egfr: {
    docId: "lab", label: "eGFR", daysAgo: 0,
    short: "An estimate of how much blood your kidneys filter per minute. 88 is normal (60+); it’s computed from [[creatinine]], age and sex — not measured directly.",
    long: "GFR stands for glomerular filtration rate. Above 90 is “normal”, 60–89 is “mildly decreased” but only meaningful with other signs of kidney damage; below 60 for 3+ months defines chronic kidney disease. A single value swings with hydration, a heavy workout the day before, or a big steak dinner.",
    anec: "Think of it as throughput derived from a proxy metric — the lab measures a waste product and infers the filter rate from it.",
    links: [read("eGFR ranges explained", "egfr 88 normal")],
  },
  creatinine: {
    docId: "lab", label: "creatinine", daysAgo: 0,
    short: "A waste product from muscle turnover that healthy kidneys clear at a steady rate. Higher creatinine = kidneys filtering less — or just more muscle.",
    long: "Because it’s produced in proportion to muscle mass, a muscular person has naturally higher creatinine without any kidney problem, which is why [[egfr|eGFR]] adjusts for age and sex. Dehydration and creatine supplements also push it up temporarily.",
    anec: null,
    links: [read("Creatinine — what affects it", "creatinine levels what affects")],
  },
  ldl: {
    docId: "lab", label: "LDL cholesterol", daysAgo: 0,
    short: "The cholesterol carried by particles that tend to lodge in artery walls — the “bad” kind. 131 mg/dL is “near optimal / borderline”; under 100 is the usual target.",
    long: "LDL particles ferry cholesterol out to tissues; when there are too many, some get trapped in artery walls and start plaques. Whether 131 matters depends on the rest of your risk picture — blood pressure, smoking, family history, [[triglycerides]] — which is why doctors use a 10-year risk calculator rather than this number alone.",
    anec: "The absolute number is less important than the trend and the context — like a latency figure that only means something next to traffic and error rate.",
    links: [read("LDL ranges and targets", "ldl 131 borderline high")],
  },
  triglycerides: {
    docId: "lab", label: "triglycerides", daysAgo: 0,
    short: "Fat circulating in your blood, mostly from recent meals and from the liver converting excess sugar and alcohol. 168 mg/dL is mildly high (normal is under 150).",
    long: "They rise with refined carbs, alcohol and being sedentary, and fall fast — weeks — with the opposite. High triglycerides alongside a high [[hba1c|HbA1c]] often point at the same root cause: insulin resistance. A non-fasting draw can inflate the number.",
    anec: null,
    links: [read("Triglycerides — how to lower them", "triglycerides 168 how to lower")],
  },

  // — Schedule K-1 page —
  passthrough: {
    docId: "tax", label: "pass-through entity", daysAgo: 14,
    short: "A business that pays no income tax itself — profits “pass through” to the owners, who report their share on their own returns. Partnerships and most LLCs work this way.",
    long: "Instead of the entity filing and paying, it files an information return (Form 1065) and sends each partner a K-1 saying “here is your slice”. You owe tax on that slice whether or not any cash was actually paid out to you — the famous “phantom income” problem.",
    anec: null,
    links: [read("Pass-through taxation explained", "pass-through entity taxation")],
  },
  ordinaryincome: {
    docId: "tax", label: "ordinary business income", daysAgo: 14,
    short: "Box 1: your share of the partnership’s operating profit. Taxed at your regular income-tax rates — and usually also subject to [[secatax|self-employment tax]] if you’re an active partner.",
    long: "This is the headline number. It excludes items that get special treatment (capital gains, dividends, [[section179|Section 179]] deductions) — those are broken out in their own boxes so they keep their character on your return.",
    anec: null,
    links: [read("K-1 Box 1 — ordinary income", "k-1 box 1 ordinary business income")],
  },
  secatax: {
    docId: "tax", label: "self-employment tax", daysAgo: 14,
    short: "Social Security + Medicare (15.3%) that employees split with an employer — as a partner you pay both halves on your share of active income.",
    long: "It applies to general partners and LLC members who work in the business; limited partners typically owe it only on guaranteed payments. Half of it is deductible on your 1040. Above the Social Security wage base only the 2.9% Medicare part continues.",
    anec: null,
    links: [read("Schedule SE basics", "self-employment tax partner k-1")],
  },
  section179: {
    docId: "tax", label: "Section 179 deduction", daysAgo: 14,
    short: "Lets the business write off the full cost of equipment in the year it was bought instead of depreciating it over years. Your share shows up in Box 12.",
    long: "It’s an election, and it’s capped both at the entity level and at your own level — you can only use it up to your total active business income. Anything you can’t use this year carries forward.",
    anec: null,
    links: [read("Section 179 — limits", "section 179 deduction limits 2025")],
  },
  capitalaccount: {
    docId: "tax", label: "capital account", daysAgo: 14,
    short: "Your running “equity balance” in the partnership: what you put in, plus your share of profits, minus what you took out. Item L tracks it year over year.",
    long: "It matters when you sell your stake or the partnership winds down — it’s the basis against which your gain is measured. Since 2020 it must be reported on the tax basis method, so it may not match the books you see internally.",
    anec: null,
    links: [read("K-1 Item L — capital account analysis", "k-1 item L capital account tax basis")],
  },
};

// ------------------------------------------------------------ home screen

/** SUGGESTED RABBIT HOLES on the home screen. `url` ones go live through the agent. */
/** one of docId / url / demo is set: open a demo page, analyze a live url, or run the narrated walkthrough */
export const DEMO_SUGGESTIONS: { label: string; tag: string; docId?: string; url?: string; demo?: true }[] = [
  { label: "Attention Is All You Need", tag: "paper", docId: "tx" },
  { label: "My blood test results", tag: "health", docId: "lab" },
  { label: "Schedule K-1 I just got", tag: "tax", docId: "tax" },
  { label: "CRISPR gene editing", tag: "wiki", docId: "cr" },
  { label: "Byzantine fault tolerance", tag: "wiki", docId: "bft" },
  { label: "hyperloglog.ts · a file I inherited", tag: "code", docId: "code" },
  { label: "Watch the agent read with me", tag: "agent", demo: true },
  { label: "Quantum entanglement", tag: "live", url: "https://en.wikipedia.org/wiki/Quantum_entanglement" },
  { label: "How mRNA vaccines work", tag: "live", url: "https://en.wikipedia.org/wiki/MRNA_vaccine" },
  { label: "Black hole thermodynamics", tag: "live", url: "https://en.wikipedia.org/wiki/Black_hole_thermodynamics" },
];

// ---------------------------------------------------------------- profile

/** Starting reader-model notes ("learned from your sessions"). */
export const DEMO_NOTES: { text: string; source: string }[] = [
  { text: "you like an analogy before the formal definition", source: "agent" },
  { text: "you elaborate ML terms, skim the biology ones", source: "agent" },
];

export const DEMO_PROFILE: { role: string; notes: string; prefs: Record<string, boolean> } = {
  role: "Software engineer — distributed systems, TypeScript",
  notes: "Compare biology things to distributed systems when you can. Keep the first pass under three sentences.",
  prefs: { "code analogies": true, "systems metaphors": true, "concrete first": true, "visual sketches": false },
};
