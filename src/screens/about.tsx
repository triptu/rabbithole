/**
 * About: what Rabbithole is, where it fits, and how the agent link works.
 * Copy follows the project README.
 */
import { Link } from "react-router";
import { GithubIcon } from "@/components/icons";
import { GITHUB_URL } from "@/sdk";
import whereItFits from "@/public/where-it-fits.png";

const P = ({ children }: { children: React.ReactNode }) => <p className="m-0 text-[14px] leading-[1.7] text-ink-3 [text-wrap:pretty]">{children}</p>;
const H = ({ children }: { children: React.ReactNode }) => <h2 className="mt-8 mb-2 font-serif text-[24px] font-medium text-ink">{children}</h2>;
const Kicker = ({ children }: { children: React.ReactNode }) => <div className="rh-kicker mb-2 tracking-[0.12em]">{children}</div>;

export function About() {
  return (
    <div className="flex-1 overflow-auto px-6 py-10">
      <div className="mx-auto flex max-w-[640px] animate-fade-up-350 flex-col gap-4">
        <h1 className="m-0 font-serif text-[36px] leading-[1.15] font-medium text-ink [text-wrap:pretty]">
          Read and understand anything better
        </h1>
        <P>
          Dense documents are hard to read, even in your own field. Research papers, articles, lab results, tax forms, unfamiliar code. Rabbithole lets you zoom in on the parts you don't understand and the explaining is done by your personal assistant aware about your context.
        </P>

        <H>Where Rabbithole fits</H>
        <img
          src={whereItFits}
          alt="Two axes: how much of the text you read, and how much the helper knows you. Rabbithole sits top right: read it all, with an assistant that knows you."
          className="rh-card w-full p-2"
        />
        <P>
          Divide reading into two axes. One is granularity: from “hand it over for a summary” to “every word”. The other is how much
          personalized help you have while reading. Rabbithole sits in the top right: you read the original text, at your pace, with an
          assistant that knows your gaps. It is for when you want to actually read and understand a piece, not only work with a derivative of
          it.
        </P>

        <H>What it does</H>
        <ul className="m-0 flex list-none flex-col gap-2.5 p-0">
          {[
            "Paste a link or text and read it verbatim. Your agent marks the terms and phrases likely to be unfamiliar to you — a biologist may not know “apophenia”, a psychologist may not know “Cas9”.",
            "Click any marked term — or highlight anything at all, even several sentences — and a pane slides in with an explanation written for you: your role, your goal, what you already know.",
            "Keep going. Elaborate, ask a follow-up, or open another term from inside a pane. Every pane is another step down the rabbit hole, and the trail is kept so you never lose the original text.",
            "Set a goal for why you’re reading. Knowing the goal, on top of everything it knows about you, lets the agent explain better.",
            "Everything you drill into is saved, so concepts are easy to revisit. Ask your agent to “open this in Rabbithole” and it will.",
            "The agent keeps notes on how you like things explained; they follow you into the next document.",
          ].map((t) => (
            <li key={t} className="flex gap-3 text-[14px] leading-[1.7] text-ink-3 [text-wrap:pretty]">
              <span className="mt-[9px] size-1.5 flex-none rounded-full bg-accent" />
              <span>{t}</span>
            </li>
          ))}
        </ul>

        <H>How the agent link works</H>
        <P>
          There is no server and no bundled model. Rabbithole exposes a few tools through WebMCP, and any agent with a browser — Codex,
          Claude, OpenClaw, Hermes, Littlebird — can pick them up. The page hands the agent work (which terms to mark, what a click means)
          and the agent answers; both directions are visible in the Agent link drawer. Paste the two-line prompt from that drawer into your
          agent once, and it stays in the loop while you read.
        </P>

        <div className="mt-6 rounded-xl bg-ink px-5 py-4 text-[12.5px] leading-[1.6] text-dark-text">
          <Kicker>
            <span className="text-accent-light">// INSPIRATION</span>
          </Kicker>
          The sliding-pane design follows{" "}
          <a href="https://notes.andymatuschak.org" target="_blank" rel="noopener" className="text-accent-light hover:text-white">
            Andy Matuschak’s notes
          </a>
          . The wider idea: a web where you and your agent do things together, with the agent ambiently present alongside you rather than
          working for you on a remote machine.
        </div>

        <div className="mt-2 flex items-center gap-4 text-[12.5px]">
          <a href={GITHUB_URL} target="_blank" rel="noopener" className="flex items-center gap-1.5 text-slate no-underline hover:text-accent">
            <GithubIcon /> source on GitHub
          </a>
          <Link to="/" className="text-slate no-underline hover:text-accent">
            ← start reading
          </Link>
        </div>
      </div>
    </div>
  );
}
