# RabbitHole


Dense documents are hard to read, even in your own field. Research papers, articles, lab results, tax forms, unfamiliar code. Rabbithole lets you zoom in on the parts you don't understand and the explaining is done by your personal assistant aware about your context.

Try at - https://rabbithole.tushar.ai/

## Where RabbitHole fits

![Where It fits](assets/where-it-fits.png)

If we divide reading into two axes -
- x axis - the granularity you read the text in - from "hand it over for a summary" to "every word"
- y axis - the amount of personalized help you have while reading(could be human but let's focus on AI here)

RabbitHole sits on top right. It's immensely useful for cases where you want to actually read, understand or skim over a piece, than only working with a derivative of the original text(summaries or questions asked on top).

## Inspiration

I read a lot - articles, papers, code, engineering spec, wiki pages and so much more. And I love going down rabbit holes, which there are many of when I'm reading dense documents or text in domains I'm not proficient in. So very often, I start at something, have a dozen open tabs a few hours later plus a long thread with an AI, and have lost track of whatever I was reading in the first place. I wanted to fix this workflow.You know how fun it is to read and figure something out with a smarter friend who also knows your gaps? Everything gets so much easier. Well, that's the experience I wanted to create.

I'm also trying to imagine a future where web feels more collaborative, where you and your agent do things together, like partners. As agents become more personal, I don't just want them to be doing things *for* me on some remote cloud machine. I want them to be ambiently present *with* me, across every surface.

The design inspiration is https://notes.andymatuschak.org.

## What it does

- True to its name, it lets you go as deep as you want into anything, starting from something you want to read and understand.
- There is a nice sliding pane UI(Andy Matuschak's style).
- You start with pasting the text or link for what you want to read and asking your agent to help you with reading alongside. 
- Your personal agent(codex, claude, openclaw, hermes, littlebird, anything that supports WebMCP) highlights the terms and parts that are non trivial "for you".  A biologist probably doesn't know "apophenia"; a psychologist probably doesn't know "Cas9". So whatever terms are likely unfamiliar to you gets highlighted.
- But you're not limited to them, you can also pick anything else or even multiple sentences, and drill into that.
- Everything you drill into opens a pane on the right. From there you can keep elaborating on that thing, or go deeper into something else and open more panes.
- Every explanation, elaboration, and answer takes into account both the context it sits in and *you* — your goals, your familiarity with the concepts, other things you've been doing that might connect.
- You can set an explicit goal for why you're reading. Maybe you're reading papers on homeschooling to decide the best course for your child, or researching vocal technique to sing better. Knowing the goal, on top of everything else about your life, lets the agent explain things even better.
- It stores the concepts you drilled into so they're easy to revisit.
- Once you have it in your agent's memory, you can also just ask it - "open this thing in RabbitHole".
- While elaborating on a chosen concept, there is an optional "focus on…" field to steer a single explanation or even have a chat.
- Personalization - (role, notes, preferences) shapes every explanation
Reader model the agent writes to — notes on how you like things explained
- Everything persistent lives in the browser (IndexedDB via Dexie), so a sync engine can be added later without touching the UI
- You can also your agent to just start with whatever text, so your starting point could be an Agent generated article for e.g. if you are trying to understand a new concept, ask it to, "explain <concept> and open the explanation in rabbithole"


## What's next

- Support for more types of inputs - PDFs for e.g.
- More software eng specific coverage - PRs for example.
- URL based state of the whole path which others can open and see the explanation in terms they would understand best.
- Login and server side storage to carry what you're reading and concepts you're interested in across sessions and AI agents.
- More proactivity - capture your attention and pass it to the agent. If you're lingering on a paragraph, the agent can proactively offer you help.
- Suggested actions — "add this to our repo" while reading an engineering blog, or "add this to your slides" if it relates to a presentation you're working on.


## Set up and run

```bash
bun install        # dependencies
bun dev            # dev server with hot reload (serves index.html for every route)
bun test           # sdk tests (markers, seed data, duplex round trip against a fake modelContext)
bun run build      # production bundle → dist/ (what Vercel deploys; vercel.json rewrites all routes to index.html)
```

Without a WebMCP browser, open the agent drawer (the "agent" pill) and run the mock agent: it answers events through the same duplex tools a real agent would use, so every flow can be exercised locally. "Watch the agent read with me" on the home page is a scripted walkthrough of what a linked agent does.

## Code Details

```
src/sdk/                    no UI. Everything the app *does*.
  index.ts                  createRabbithole() → { store, reader, agent }
  types.ts                  domain model: Document, Block, Concept, Thread, Pane, Profile …
  store.ts                  zustand vanilla store + mutators (the only place state changes; writes through to Dexie)
  db.ts                     Dexie schema, load on boot, write-through persister — swap point for a sync engine
  reader.ts                 use-cases the UI calls: open documents, slide panes, ask, elaborate, bookmarks, profile
  agent/agent.ts            Agent: queue(event) → duplex channel → on(type, handler); tool registration; activity log
  agent/events.ts           the page → agent event contract (payloads, results, validators)
  agent/instructions.ts     what the agent is told about each event (the prompts)
  agent/tools.ts            agent → page tools: get_state, open, set_goal, remember
  agent/duplex-mcp-sdk.js   the reliable await_event / complete_event channel (from webmcp-duplex-prototype, verbatim)
  agent/mock.ts             dev stand-in agent that drives the real channel
  content/markers.ts        [[term]] parsing, slugs, ids;  content/fetch.ts  url → text (Jina)
  seed/                     the demo documents and concepts

src/App.tsx                 router + shell;  src/hooks.ts  useStore(selector), useReader(), useAgent()
src/components/             top bar, agent drawer, toast, <Marked/> (clickable terms), ui/ primitives
src/screens/home.tsx · history.tsx · profile.tsx
src/screens/reader/         reader.tsx (stepper + pane strip), article-pane, concept-pane, blocks (one renderer per block type),
                            selection-popover (highlight-to-ask), use-sliding-panes (the sticky-pane geometry)
styles/globals.css          the palette, fonts and keyframes as Tailwind theme tokens
```

Flux architecture - Data flow is one-directional: UI → `reader.*` / `agent.queue()` → store mutation (+ Dexie) → React re-renders through selectors. Agent results arrive through `rabbithole_complete_event`, are validated, and land in the store the same way.

Adding a new input type (a PDF, a PR) means: a new `Block` variant in `sdk/types.ts`, code that produces it (an event in `agent/events.ts` or a parser in `sdk/content`), and a renderer in `screens/reader/blocks.tsx`.
