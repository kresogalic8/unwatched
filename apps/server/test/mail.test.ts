import { describe, it, expect } from "vitest";
import { digestMail, letterMail, sendMail, mailEnabled } from "../src/mail.ts";

describe("the morning mail", () => {
  it("writes the digest as paper and ink, with the three lines and one button, and no outside assets", () => {
    const m = digestMail({ to: "owner@example.com", name: "Mira Kovač", day: 9, headline: "Mira took the mill job", text: "She asked twice and got it.", lines: ["day 9 08:00: Mira asked at the mill.", "day 9 09:00: The miller said yes."], url: "https://unwatched.world/digest" });
    expect(m.subject).toBe("Mira took the mill job");
    expect(m.html).toContain("#F7F6F3"); expect(m.html).toContain("#14161A"); expect(m.html).toContain("#E4572E"); expect(m.html).toContain("#1E5A63");
    expect(m.html).toContain("Familjen Grotesk");
    expect(m.html).toContain("The miller said yes.");
    expect(m.html).toContain('href="https://unwatched.world/digest"');
    expect(m.html).not.toMatch(/<img|<link|<script/);
    expect(m.text).toContain("Read the digest: https://unwatched.world/digest");
  });
  it("escapes what a citizen wrote, so a letter cannot carry markup into an inbox", () => {
    const m = letterMail({ to: "owner@example.com", name: "Mira Kovač", day: 3, text: "The <b>mill</b> & I are done.", url: "https://unwatched.world/letters" });
    expect(m.subject).toBe("A letter from Mira Kovač");
    expect(m.html).toContain("The &lt;b&gt;mill&lt;/b&gt; &amp; I are done.");
    expect(m.html).toContain("Write back");
  });
  it("sends nothing without a key, and says so", async () => {
    delete process.env.RESEND_API_KEY;
    const lines: string[] = [];
    expect(mailEnabled()).toBe(false);
    expect(await sendMail({ to: "a@b.c", subject: "s", html: "", text: "" }, (l) => lines.push(l), async () => { throw new Error("must not be called"); })).toBe(false);
    expect(lines[0]).toContain("no RESEND_API_KEY");
  });
  it("posts to Resend with the key when there is one", async () => {
    process.env.RESEND_API_KEY = "re_test";
    let seen: { url: string; init: RequestInit } | null = null;
    const ok = await sendMail({ to: "a@b.c", subject: "s", html: "<p>h</p>", text: "t" }, () => {}, (async (url: string | URL | Request, init?: RequestInit) => { seen = { url: String(url), init: init! }; return new Response("{}", { status: 200 }); }) as typeof fetch);
    delete process.env.RESEND_API_KEY;
    expect(ok).toBe(true);
    expect(seen!.url).toBe("https://api.resend.com/emails");
    expect((seen!.init.headers as Record<string, string>).Authorization).toBe("Bearer re_test");
    expect(JSON.parse(String(seen!.init.body))).toMatchObject({ to: ["a@b.c"], subject: "s" });
  });
});
