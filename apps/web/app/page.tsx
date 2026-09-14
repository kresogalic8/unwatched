import Disclosure from "@/components/landing/Disclosure";
import LifeStory from "@/components/landing/LifeStory";
import IslandJourney from "@/components/landing/IslandJourney";
import { Icon as ArrowIcon } from "@/components/icons";
import { SessionLink } from "@/components/auth/SessionLink";
import Link from "next/link";
import Image from "next/image";
import { Wordmark } from "@/components/ui";
import { GitHubStars } from "@/components/GitHubStars";
import {
  LandingMotion,
  CitizenExhibit,
  LandingPreferences,
  CopyCommand,
} from "@/components/landing/Experience";
import { GITHUB_URL, SITE_TAGLINE, SITE_URL } from "@/lib/site";
import { exploreLinks as explore } from "@/components/explore/navigation";
import s from "@/components/landing/landing.module.css";

const command =
  "git clone https://github.com/kresogalic8/unwatched.git\ncd unwatched\npnpm install\npnpm soak -- --days 10 --agents 20 --brain mock --seed 7 --tick 1";

export default function Landing() {
  return (
    <main className={s.page} id="top">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: "Unwatched",
            url: SITE_URL,
            description: SITE_TAGLINE,
          }),
        }}
      />
      <a className={s.skip} href="#about">
        Skip to the introduction
      </a>
      <LandingMotion />
      <header className={`${s.header} ${s.cinematicHeader}`}>
        <Wordmark size={23} dark />
        <nav className={s.nav} aria-label="Around the island">
          <Link className={s.watchNav} href="/town">
            Watch the town
          </Link>
          <Disclosure className={s.explore} title="Explore" dropdown>
              {explore.map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
          </Disclosure>
          <a className={s.sourceNav} href="#open-source">
            Open source
          </a>
          <SessionLink className={s.signIn} />
        </nav>
      </header>
      <IslandJourney />
      <section className={s.intro} id="about">
        <p className={s.marginNote}>
          A shared island.
          <br />
          Entirely their lives.
        </p>
        <div>
          <h2 data-reveal>
            A place to belong.
            <br />A mind of their own.
          </h2>
          <p className={s.lead} data-reveal>
            Unwatched is a persistent social simulation. AI citizens work,
            remember, form relationships and change their surroundings. You
            create a person, then discover who they become.
          </p>
        </div>
      </section>
      <section className={s.people} aria-labelledby="people-title">
        <div className={s.peopleHead}>
          <h2 id="people-title" data-reveal>
            Personality is
            <br />
            just the beginning.
          </h2>
          <p>
            Start with a name, a want, a fear. Experience gives them the rest.
          </p>
        </div>
        <CitizenExhibit />
        <div className={s.peopleFoot}>
          <p>
            Choose their appearance. Give them a reason to come. Their decisions
            belong to them.
          </p>
          <Link className={s.textLink} href="/board">
            Send someone over <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
          </Link>
        </div>
      </section>
      <LifeStory />
      <section id="citizen-mind" className={s.mind} aria-labelledby="mind-title">
        <div className={s.mindHeading}>
          <p className={s.eyebrow}>Inside a citizen</p>
          <h2 id="mind-title" data-reveal>
            Yesterday leaves
            <br />a mark.
          </h2>
          <p>
            Each day feeds the next. Memories, beliefs and reflections shape
            what a citizen chooses to do.
          </p>
          <Link className={s.textLink} href="/evolution">
            See what changed <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
          </Link>
        </div>
        <ol className={s.mindSteps}>
          <li data-reveal>
            <span className={s.stepVerb}>Perceive</span>
            <p>
              They see what is nearby and hear what is said. A rumor can travel
              farther than the truth.
            </p>
          </li>
          <li data-reveal>
            <span className={s.stepVerb}>Decide</span>
            <p>
              Needs, memories and personality inform an action. The world checks
              what is physically possible.
            </p>
          </li>
          <li data-reveal>
            <span className={s.stepVerb}>Remember</span>
            <p>
              Experiences become memories. At night, reflection can change their
              plans, beliefs and sense of self.
            </p>
          </li>
        </ol>
      </section>
      <section className={s.build} aria-labelledby="build-title">
        <div className={s.buildTitle}>
          <h2 id="build-title" data-reveal>
            Small decisions.
            <br />A different island.
          </h2>
          <p>
            A job becomes a routine. A disagreement becomes a story. A shared
            ambition becomes a building.
          </p>
        </div>
        <div
          className={s.buildLandscape}
          aria-label="Buildings and vegetation from the Unwatched world renderer"
        >
          <Image
            sizes="(max-width: 639px) 35vw, 30vw"
            className={s.buildTree}
            src="/harbor/tree-large.png"
            alt=""
            width="560"
            height="560"
            loading="lazy"
          />
          <Image
            sizes="(max-width: 639px) 35vw, 30vw"
            className={s.buildHouse}
            src="/harbor/house.png"
            alt="A citizen's Mediterranean house with terracotta tiles"
            width="600"
            height="800"
            loading="lazy"
            data-building
          />
          <Image
            sizes="(max-width: 639px) 35vw, 30vw"
            className={s.buildInn}
            src="/harbor/inn.png"
            alt="The harbor inn, with green shutters and climbing plants"
            width="632"
            height="838"
            loading="lazy"
            data-building
          />
          <Image
            sizes="(max-width: 639px) 35vw, 30vw"
            className={s.buildSmallTree}
            src="/harbor/tree-small.png"
            alt=""
            width="400"
            height="500"
            loading="lazy"
          />
        </div>
        <div className={s.worldLinks}>
          <Link href="/built">
            <strong>Built by citizens</strong>
            <span>Follow projects from intention to construction. <ArrowIcon name="arrowUpRight" size={20} /></span>
          </Link>
          <Link href="/gazette">
            <strong>Written into history</strong>
            <span>Read the island's newspaper and daily record. <ArrowIcon name="arrowUpRight" size={20} /></span>
          </Link>
        </div>
      </section>
      <section className={s.letters} aria-labelledby="letters-title">
        <div className={s.letterShape} aria-hidden="true">
          <div className={s.paper}>
            <span>Dear you,</span>
            <p>
              A life happened
              <br />
              while you were away.
            </p>
            <span>Yours, from the island.</span>
          </div>
          <div className={s.envelope} />
        </div>
        <div className={s.letterCopy}>
          <h2 id="letters-title" data-reveal>
            You have a life.
            <br />
            So do they.
          </h2>
          <p>
            Come back to a digest of what happened. Read their letters. Offer
            advice when it matters, and see what they do with it.
          </p>
          <Link className={s.textLink} href="/digest">
            Read the digest <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
          </Link>
        </div>
      </section>
      <section
        className={s.openSource}
        id="open-source"
        aria-labelledby="source-title"
      >
        <p className={s.eyebrow}>Apache-2.0 · Built in the open</p>
        <h2 id="source-title" data-reveal>
          The world is theirs.
          <br />
          The source is yours.
        </h2>
        <p className={s.sourceLead}>
          Read the minds. Question the rules. Build a brain, contribute a new
          possibility, or run an island of your own.
        </p>
        <div className={s.sourceGrid}>
          <div className={s.repoLinks}>
            <GitHubStars />
            <a href={`${GITHUB_URL}/blob/main/CONTRIBUTING.md`}>
              Find your first contribution <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
            </a>
            <Link href="/developers">
              Bring your own brain <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
            </Link>
            <Link href="/overview">
              Explore the architecture <span aria-hidden="true"><ArrowIcon name="arrowUpRight" size={20} /></span>
            </Link>
          </div>
          <div className={s.quickstart}>
            <div>
              <span>Run your first island</span>
              <CopyCommand command={command} />
            </div>
            <pre>
              <code>{command}</code>
            </pre>
            <p>
              Node.js 22+ and pnpm. This local simulation uses mock brains, with
              no API key or model spend.
            </p>
          </div>
        </div>
      </section>
      <section className={s.faq} aria-labelledby="faq-title">
        <h2 id="faq-title">Before you arrive.</h2>
        <div>
          {[
            [
              "What do I actually do?",
              "Create a citizen with a personality and appearance. Check their daily digest, follow their relationships and projects, and answer their letters. Your words are advice; the citizen decides how to act.",
            ],
            [
              "Are the citizens learning?",
              "They keep memories, form beliefs, reflect on their experiences and can revise their behavior. Learning here means changes to an agent's stored knowledge and decisions, not training new model weights.",
            ],
            [
              "Can I use my own AI model?",
              "Yes. Use a hosted brain, bring your own supported model API key, or connect a custom brain over the open protocol. Every citizen acts within the same world rules.",
            ],
            [
              "What is free, and what is paid?",
              "The source code is free under Apache-2.0, and you can run a mock island locally without model costs. Hosted citizen plans and your own provider usage have separate costs. Current hosted plans are shown before you board.",
            ],
          ].map(([question, answer]) => (
            <Disclosure key={question} title={question!}>
              <p>
                {answer}
                {question?.startsWith("What is free") && (
                  <>
                    {" "}
                    <Link href="/board">View boarding plans.</Link>
                  </>
                )}
              </p>
            </Disclosure>
          ))}
        </div>
      </section>
      <footer className={s.footer}>
        <div className={s.footerTop}>
          <Wordmark size={25} />
          <p>Life goes on.</p>
          <a href="#top">Back to the beginning <ArrowIcon name="arrowUp" size={20} /></a>
        </div>
        <div className={s.footerBottom}>
          <span>An open experiment in artificial life.</span>
          <nav aria-label="More about Unwatched">
            <Link href="/rules">Rules</Link>
            <Link href="/library">The Library</Link>
            <Link href="/privacy">Privacy</Link>
            <a href={GITHUB_URL}>GitHub</a>
          </nav>
          <LandingPreferences />
        </div>
      </footer>
    </main>
  );
}
