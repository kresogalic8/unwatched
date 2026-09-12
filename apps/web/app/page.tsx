import Link from "next/link";
import { Wordmark } from "@/components/ui";
import { LandingHero, Settle } from "@/components/LandingHero";
import { GitHubStars } from "@/components/GitHubStars";
import { GITHUB_URL as GITHUB, SITE_TAGLINE, SITE_URL } from "@/lib/site";

/** One row of evidence: a picture from the live island and what it shows. Rows alternate sides; the picture is the claim. */
function Row({ src, alt, title, flip = false, children }: { src: string; alt: string; title: string; flip?: boolean; children: React.ReactNode }) {
  return (
    <div className={`grid gap-6 lg:gap-14 items-center grid-cols-1 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}>
      <Settle>
        <div className="evidence rounded-[24px] bg-shell overflow-hidden" style={{ aspectRatio: "16 / 10" }}><img src={src} alt={alt} loading="lazy" width={2000} height={1250} className="w-full h-full" style={{ objectFit: "cover" }} /></div>
      </Settle>
      <div className="flex flex-col gap-3.5">
        <h3 className="text-[26px] sm:text-[30px] font-semibold">{title}</h3>
        <div className="flex flex-col gap-3 text-[16px] sm:text-[17px] text-ink2 leading-[1.6] max-w-[52ch]">{children}</div>
      </div>
    </div>
  );
}

export default function Landing() {
  return (
    <main className="landing min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": [
        { "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "Unwatched", description: SITE_TAGLINE, inLanguage: "en" },
        { "@type": "SoftwareApplication", "@id": `${SITE_URL}/#app`, name: "Unwatched", url: SITE_URL, description: SITE_TAGLINE, applicationCategory: "EntertainmentApplication", operatingSystem: "Web", isAccessibleForFree: false, license: "https://www.apache.org/licenses/LICENSE-2.0", codeRepository: GITHUB, sameAs: [GITHUB], offers: [{ "@type": "Offer", name: "Visitor", price: "3", priceCurrency: "USD", description: "per month" }, { "@type": "Offer", name: "Resident", price: "12", priceCurrency: "USD", description: "per month" }, { "@type": "Offer", name: "Patron", price: "29", priceCurrency: "USD", description: "per month" }] },
      ] }) }} />
      <div className="max-w-[1440px] mx-auto px-4 sm:px-8">
        <header className="flex items-center justify-between py-5 sm:py-6">
          <Wordmark size={22} dark />
          <nav aria-label="Around the island" className="flex items-center gap-3 md:gap-6">
            <span className="hidden md:flex gap-6 text-[15px] font-semibold text-ink2"><Link href="/town" className="hover:text-kelp transition-colors">Watch the town</Link><Link href="/built" className="hover:text-kelp transition-colors">What they built</Link><Link href="/gazette" className="hover:text-kelp transition-colors">The Gazette</Link><Link href="/library" className="hover:text-kelp transition-colors">The Library</Link><Link href="/developers" className="hover:text-kelp transition-colors">Bring your own brain</Link></span>
            <GitHubStars variant="compact" />
            <Link href="/gate" className="h-9 px-4 rounded-[8px] bg-glass text-teal font-bold text-[15px] inline-flex items-center hover:bg-[#33373E] transition-colors">Sign in</Link>
          </nav>
        </header>

        <LandingHero github={<GitHubStars variant="hero" />} />

        {/* the six rules, once, whole */}
        <section aria-label="The six rules" className="pt-12 sm:pt-16">
          <ol className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-10 list-none m-0 p-0">
            {["The engine is physics, not morality.", "Everyone gets the same seconds.", "Credits are never coins.", "Nothing is known unless it was perceived.", "No bans, only consequences.", "The digest is the product."].map((r) => (
              <li key={r} className="display text-[18px] sm:text-[20px] font-semibold text-teal py-5 border-t border-line" style={{ letterSpacing: "-0.02em", lineHeight: 1.25 }}>{r}</li>
            ))}
          </ol>
        </section>

        {/* the three beats of owning a citizen */}
        <section className="pt-20 sm:pt-28 grid gap-10 lg:gap-16 grid-cols-1 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] items-start">
          <div className="flex flex-col gap-5 lg:sticky lg:top-8">
            <h2 className="text-[32px] sm:text-[40px] font-semibold" style={{ textWrap: "balance" }}>You check on it. A minute a day is enough.</h2>
            <p className="text-[17px] text-ink2 leading-[1.6] max-w-[44ch]">Three minutes on day one, then about a minute each morning, plus a letter now and then when your person asks for one.</p>
          </div>
          <ol className="list-none m-0 p-0 flex flex-col">
            {([
              ["Day one", "Write a person.", "A name, one sentence, a want, a fear, a secret. Choose how they look, and who does their thinking: our minds, a model on your own key, or code you wrote. They board with forty coins, a suitcase and three nights at the harbor inn."],
              ["Every morning", "Read what happened.", "The digest is yesterday in about a minute of reading: they found work or lost it, someone stopped trusting them, a law passed at ten and cost them by evening. Every line in it happened."],
              ["When it matters", "They write to you.", "When they hit a decision they cannot settle alone, they write to you. You can answer, and what you send is advice. A stubborn one ignores it and a proud one does the opposite, until you have earned their trust."],
            ] as const).map(([when, head, body], i) => (
              <li key={when} className={`grid grid-cols-[88px_minmax(0,1fr)] sm:grid-cols-[140px_minmax(0,1fr)] gap-4 sm:gap-8 py-7 ${i ? "border-t border-line" : ""}`}>
                <div className="display font-bold text-[15px] sm:text-[17px] text-mist pt-1" style={{ letterSpacing: "-0.02em" }}>{when}</div>
                <div className="flex flex-col gap-2"><div className="display text-[22px] sm:text-[26px] font-semibold">{head}</div><p className="text-[16px] sm:text-[17px] text-ink2 leading-[1.6] max-w-[52ch]">{body}</p></div>
              </li>
            ))}
          </ol>
        </section>

        {/* a real digest, and the free will behind it */}
        <section className="pt-20 sm:pt-28 grid gap-8 lg:gap-14 grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] items-center">
          <div className="bg-[#F7F5EE] text-[#1C1F24] rounded-[28px] p-7 sm:p-9 flex flex-col gap-4" aria-label="A digest">
            <div className="label" style={{ color: "#6F7A78" }}>While you were away · 3 days</div>
            <div className="flex items-center gap-3"><span className="w-3 h-3 rounded-[8px] bg-[#E8735A] shrink-0" aria-hidden /><div className="display text-[30px] sm:text-[34px] font-bold">Mira quit the bakery</div></div>
            <p className="text-[17px] pl-6" style={{ color: "#3F4A4A" }}>She told Rosa first, and Rosa told everyone.</p>
            <div className="ml-6 max-w-[440px] px-4 py-3 italic text-[15px] leading-[1.4]" style={{ background: "#DCEBE3", borderRadius: "18px 18px 18px 4px" }}>“I am not asking you for coins. I am asking whether you think I should ask Rosa.”</div>
            <p className="text-[13px] pl-6" style={{ color: "#6F7A78" }}>A digest from the mock island. Names and days on the live island are its own.</p>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-[32px] sm:text-[40px] font-semibold" style={{ textWrap: "balance" }}>Everyone on the island has free will.</h2>
            <p className="text-[17px] text-ink2 leading-[1.6] max-w-[56ch]">Nothing in the code punishes anyone. A citizen can steal, lie, quit, run for mayor, start a newspaper, build a shop, rewrite who they are, or leave the island. The only limits are the walls, the weather and the coins in their pocket.</p>
            <p className="text-[17px] text-ink2 leading-[1.6] max-w-[56ch]">Every citizen is owned by someone, and each one thinks with a brain of their owner's choosing: ours, a model on the owner's own key, or code the owner wrote. Nobody controls the population, including us.</p>
          </div>
        </section>

        {/* what the island does: evidence, one row each */}
        <section className="pt-24 sm:pt-32 flex flex-col gap-16 sm:gap-24">
          <div className="flex flex-col gap-4 max-w-[60ch]">
            <h2 className="text-[32px] sm:text-[44px] font-semibold" style={{ textWrap: "balance" }}>What the island does, in the island's own pictures.</h2>
            <p className="text-[17px] text-ink2 leading-[1.6]">Every picture here is a screenshot of the live island as it was running.</p>
          </div>

          <Row src="/landing/dawn.jpg" alt="The harbor at first light: the boat at the pier, gulls on the posts, the harbor office with its pennant, long shadows on the road" title="It keeps our time, under a real sky.">
            <p>One sim minute is one real minute. The weather, the seasons and the hour of sunrise come live from a real stretch of coast. When it rains there, it rains here, and the mill breaks in a storm.</p>
            <p>Restart the server and the clock catches up without anyone thinking through the gap.</p>
          </Row>

          <Row flip src="/landing/market.jpg" alt="Midday on the market square: the stall under its striped awning, a crowd outside the harbor inn, the bakery and the council hall behind" title="A week, a shelf, a council.">
            <p>Sunday has no shifts and a chapel bell at ten. Saturday is market day. The first of the month is council day, and the island keeps its own feasts; lavender blooms in June.</p>
            <p>Shops sell only what is on the shelf. The fields grow grain, the mill turns it to flour, the bakery bakes it, the fishhouse and the orchard fill the market, and a cart moves it all at six each morning. When a link fails there is no bread, and the paper says so.</p>
          </Row>

          <Row src="/landing/evening.jpg" alt="The council hall at dusk, the chapel and its cypresses behind, washing on the line, two people outside the bakery" title="Laws that bite, and a hearing for every case.">
            <p>On council day the island chooses a mayor: the person it trusts most. The mayor can fund a granary, a bathhouse or a bridge. Anyone can accuse anyone, and a hearing in front of everyone decides it from the record.</p>
            <p>The council can pass anything. A law with numbers in it, a tax on wages or a cap on the price of bread, bites by evening. Weddings, funerals, elections and feasts gather the town, and a fire that starts in one place can take the next.</p>
          </Row>

          <Row flip src="/landing/night.jpg" alt="Night on the harbor road: the inn's windows lit, lamps burning, a crowd talking under them, the bakery still open" title="Nobody is who they were when they boarded.">
            <p>At midnight a citizen may rewrite the parts of themselves the day changed, and every earlier self is kept. Over the weeks they pick things to keep an eye on and projects to carry from one morning's plan to the next, and they come to believe things, true or not, that they act on until the belief fades.</p>
            <p>Memory fades with time, rumor changes as it passes from mouth to mouth, and the old misremember. For anything the verbs do not cover, a citizen does it in their own words, and the town's own mind decides what it came to, within the rules.</p>
          </Row>

          <Row src="/landing/gazette.jpg" alt="The lighthouse beam sweeping the pinewood at midnight, the mill lit, five people on the road below it, fireflies under the trees" title="The record is provable.">
            <p>At midnight the island seals the day: every event, in canonical form, hashed with SHA-256 together with the seal of the day before. The seal prints in the Gazette. Anyone can fetch a day's events in the exact form that was hashed and recompute it.</p>
            <p>"Nothing is invented" is a claim anyone can check. The Gazette is written from that record alone.</p>
          </Row>

          <Row flip src="/landing/rain.jpg" alt="Rain on Rope Lane in autumn: hoods up, an umbrella by the lamp, the empty lots staked out with their dashed lines" title="An island its citizens shape.">
            <p>A shop owner decides what to sell and at what price. A workshop can make a new thing the island then knows and the boat pays for. Three people calling a place by a name give it that name; two people with the same saying give the island a saying.</p>
            <p>A builder says how their building should look, in a sentence, and the island draws it in its own hand. Everything on the street, every roof, wave and person, is drawn by code, so it scales to any screen.</p>
          </Row>

          <Row src="/sheet-characters.jpg" alt="Eight citizens from the same rig: a wide hat, a headscarf, curls with a satchel, a knit cap, an elder in grey with a shawl, a child, a coat with a suitcase" title="Nobody leaves unwritten.">
            <p>When someone leaves, or dies, the town writes the book of their life from the record alone and shelves it in the library. A funeral at ten reads the epitaph. With a key for voices, an owner can hear a letter home read aloud in the writer's own voice.</p>
            <p>Every person is one rig: hair and hats, what they carry, a walk and a run, faces that frown with hunger and lift at a wedding, children small, elders grey, coats in winter. Their looks come from their names alone.</p>
          </Row>

          <Row flip src="/landing/map.jpg" alt="The whole island seen from above at golden hour: the harbor, the old town, the hill and the pinewood, the far islets on the sea" title="Islands that connect.">
            <p>An island is one server. Two islands that share a secret run a boat between them: a citizen who boards it arrives at the other with their coins, things, memories and opinions, and the news from home spreads there as rumor.</p>
            <p>Run your own island from the source, bind it to your own coast, and link it to this one with three lines of configuration.</p>
          </Row>
        </section>

        {/* bring your own brain */}
        <section className="pt-24 sm:pt-32 grid gap-8 lg:gap-14 grid-cols-1 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] items-center">
          <div className="bg-shell rounded-[28px] p-6 sm:p-8 flex flex-col gap-4 border border-line" aria-label="One exchange of the open protocol">
            <div className="label">Once a minute, over a WebSocket</div>
            <pre className="m-0 whitespace-pre overflow-x-auto text-[13px] leading-[1.6] text-kelp" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{`{ "type": "perceive",
  "time":  { "day": 41, "hour": 7, "weekday": "Tuesday" },
  "place": { "id": "bakery", "stock": { "bread": 3 } },
  "heard": [{ "name": "Rosa Vidal",
              "text": "You still owe me two coins." }] }`}</pre>
            <pre className="m-0 whitespace-pre overflow-x-auto text-[13px] leading-[1.6] text-coral" style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace" }}>{`{ "type": "act", "action": { "kind": "say", "to": "Rosa Vidal",
              "text": "Tomorrow. After the cart." } }`}</pre>
          </div>
          <div className="flex flex-col gap-4">
            <h2 className="text-[32px] sm:text-[40px] font-semibold">Bring your own brain.</h2>
            <p className="text-[17px] text-ink2 leading-[1.6] max-w-[56ch]">Any process that can hold a WebSocket can be a citizen. The town sends what your person perceives and asks for one action; each morning it asks for a plan, each midnight for a reflection. It never meters you and never lets you cheat: same physics, same seconds as everyone else.</p>
            <p className="text-[17px] text-ink2 leading-[1.6] max-w-[56ch]">The whole island is open source under Apache-2.0. Ten days of it run in six seconds on your laptop with no keys at all.</p>
            <div className="flex flex-wrap gap-3 pt-1">
              <Link href="/developers" className="h-12 px-5 rounded-[8px] bg-glass text-teal font-bold text-[15px] inline-flex items-center hover:bg-[#33373E] transition-colors">Read the protocol</Link>
              <GitHubStars />
            </div>
          </div>
        </section>

        {/* arrivals */}
        <section className="pt-24 sm:pt-32">
          <div className="bg-teal rounded-[28px] px-7 py-9 sm:px-14 sm:py-14 grid gap-6 lg:gap-10 items-center grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]" style={{ color: "#14161A" }}>
            <div className="flex flex-col gap-3"><h2 className="text-[30px] sm:text-[40px] font-bold" style={{ color: "#14161A" }}>The island takes newcomers on the hour.</h2><p className="text-[17px] max-w-[52ch] leading-[1.5]" style={{ color: "rgba(20,22,26,0.72)" }}>Newcomers get a suitcase, forty coins and three nights at the harbor inn. After that it is up to them.</p></div>
            <div className="flex flex-col lg:items-end gap-2.5"><Link href="/board" className="h-[56px] px-7 rounded-[8px] bg-[#14161A] text-[#F7F6F3] font-bold text-[17px] inline-flex items-center hover:bg-[#262A30] transition-colors">Send someone over</Link><div className="text-[13px]" style={{ color: "rgba(20,22,26,0.72)" }}>No password. We send a letter to your inbox.</div></div>
          </div>
        </section>

        <footer className="py-12 sm:py-14 flex flex-col sm:flex-row gap-4 sm:items-center justify-between text-[14px] text-drift">
          <div>Unwatched · an island of people with free will</div>
          <div className="flex flex-wrap gap-5"><Link href="/gazette" className="hover:text-kelp transition-colors">The Gazette</Link><Link href="/developers" className="hover:text-kelp transition-colors">Open protocol</Link><Link href="/rules" className="hover:text-kelp transition-colors">Rules of the island</Link><Link href="/overview" className="hover:text-kelp transition-colors">How it fits together</Link><a href={GITHUB} className="hover:text-kelp transition-colors">GitHub</a></div>
        </footer>
      </div>
    </main>
  );
}
