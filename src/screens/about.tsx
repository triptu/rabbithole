/**
 * About: the README, as a page. Keep the wording in step with README.md.
 */
import { Link } from "react-router";
import { GithubIcon } from "@/components/icons";
import { GITHUB_URL } from "@/sdk";
import whereItFits from "@/public/where-it-fits.png";

const P = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-[14px] leading-[1.7] text-ink-3 [text-wrap:pretty]">{children}</p>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-8 mb-2 font-serif text-[24px] font-medium text-ink">{children}</h2>;
const List = ({ items }: { items: React.ReactNode[] }) => (
  <ul className="m-0 flex list-none flex-col gap-2 p-0">
    {items.map((t, i) => (
      <li key={i} className="flex gap-3 text-[14px] leading-[1.7] text-ink-3 [text-wrap:pretty]">
        <span className="mt-[9px] size-1.5 flex-none rounded-full bg-accent" />
        <span>{t}</span>
      </li>
    ))}
  </ul>
);

export function About() {
  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="mx-auto flex max-w-[640px] animate-fade-up-350 flex-col gap-4">
        <h1 className="m-0 font-serif text-[36px] leading-[1.15] font-medium text-ink">RabbitHole</h1>
        <P>
          Dense documents are hard to read, even in your own field. Research papers, articles, lab results, tax forms, unfamiliar code.
          Rabbithole lets you zoom in on the parts you don't understand and the explaining is done by your personal assistant aware about
          your context.
        </P>

        <H>Where RabbitHole fits</H>
        <img
          src={whereItFits}
          alt="Where it fits: reading granularity on the x axis, personalized help on the y axis. RabbitHole sits top right."
          className="rh-card w-full p-2"
        />
        <P>If we divide reading into two axes -</P>
        <List
          items={[
            "x axis - the granularity you read the text in - from “hand it over for a summary” to “every word”",
            "y axis - the amount of personalized help you have while reading (could be human but let's focus on AI here)",
          ]}
        />
        <P>
          RabbitHole sits on top right. It's immensely useful for cases where you want to actually read, understand or skim over a piece,
          than only working with a derivative of the original text (summaries or questions asked on top).
        </P>

        <H>Inspiration</H>
        <P>
          I read a lot - articles, papers, code, engineering spec, wiki pages and so much more. And I love going down rabbit holes, which
          there are many of when I'm reading dense documents or text in domains I'm not proficient in. So very often, I start at something,
          have a dozen open tabs a few hours later plus a long thread with an AI, and have lost track of whatever I was reading in the first
          place. I wanted to fix this workflow. You know how fun it is to read and figure something out with a smarter friend who also knows
          your gaps? Everything gets so much easier. Well, that's the experience I wanted to create.
        </P>
        <P>
          I'm also trying to imagine a future where web feels more collaborative, where you and your agent do things together, like
          partners. As agents become more personal, I don't just want them to be doing things <em>for</em> me on some remote cloud machine. I
          want them to be ambiently present <em>with</em> me, across every surface.
        </P>
        <P>
          The design inspiration is{" "}
          <a href="https://notes.andymatuschak.org" target="_blank" rel="noopener">
            notes.andymatuschak.org
          </a>
          .
        </P>

        <H>What it does</H>
        <List
          items={[
            "True to its name, it lets you go as deep as you want into anything, starting from something you want to read and understand.",
            "There is a nice sliding pane UI (Andy Matuschak's style).",
            "You start with pasting the text or link for what you want to read and asking your agent to help you with reading alongside.",
            "Your personal agent (codex, claude, openclaw, hermes, littlebird, anything that supports WebMCP) highlights the terms and parts that are non trivial “for you”. A biologist probably doesn't know “apophenia”; a psychologist probably doesn't know “Cas9”. So whatever terms are likely unfamiliar to you gets highlighted.",
            "But you're not limited to them, you can also pick anything else or even multiple sentences, and drill into that.",
            "Everything you drill into opens a pane on the right. From there you can keep elaborating on that thing, or go deeper into something else and open more panes.",
            "Every explanation, elaboration, and answer takes into account both the context it sits in and you — your goals, your familiarity with the concepts, other things you've been doing that might connect.",
            "You can set an explicit goal for why you're reading. Maybe you're reading papers on homeschooling to decide the best course for your child, or researching vocal technique to sing better. Knowing the goal, on top of everything else about your life, lets the agent explain things even better.",
            "It stores the concepts you drilled into so they're easy to revisit.",
            "Once you have it in your agent's memory, you can also just ask it - “open this thing in RabbitHole”.",
            "While elaborating on a chosen concept, there is an optional “focus on…” field to steer a single explanation or even have a chat.",
            "Personalization - (role, notes, preferences) shapes every explanation. Reader model the agent writes to — notes on how you like things explained.",
            "Everything persistent lives in the browser (IndexedDB), so a sync engine can be added later without touching the UI.",
            "You can also ask your agent to just start with whatever text, so your starting point could be an agent generated article for e.g. if you are trying to understand a new concept, ask it to, “explain <concept> and open the explanation in rabbithole”.",
          ]}
        />

        <H>What's next</H>
        <List
          items={[
            "Support for more types of inputs - PDFs for e.g.",
            "More software eng specific coverage - PRs for example.",
            "Login and server side storage to carry what you're reading and concepts you're interested in across sessions and AI agents.",
            "More proactivity - capture your attention and pass it to the agent. If you're lingering on a paragraph, the agent can proactively offer you help.",
            "Suggested actions — “add this to our repo” while reading an engineering blog, or “add this to your slides” if it relates to a presentation you're working on.",
          ]}
        />

        <div className="mt-6 flex items-center gap-4 text-[12.5px]">
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-slate no-underline hover:text-accent">
            <GithubIcon /> github.com/triptu/rabbithole
          </a>
          <Link to="/" className="text-slate no-underline hover:text-accent">
            Start reading
          </Link>
        </div>
      </div>
    </div>
  );
}
