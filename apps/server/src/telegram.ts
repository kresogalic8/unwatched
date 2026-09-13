import type { TownEvent } from '@unwatched/protocol';

/** Optional delivery to each owner’s explicitly connected chat and selected agents. */
export class TelegramLetters {
  private seen = new Set<number>();
  private tail: Promise<void> = Promise.resolve();
  sent = 0;
  failed = 0;
  constructor(private config: { token?: string | undefined; chat?: string | undefined; owner?: string | undefined; agent?: string | undefined; resolve?: ((owner: string, agent: string) => Promise<string | null>) | undefined }, private log: (line: string) => void) {}
  get enabled() { return !!(this.config.token && (this.config.resolve || (this.config.chat && this.config.owner && this.config.agent))); }
  deliver(e: TownEvent, who: () => { id: string; owner: string | null; name: string } | undefined): Promise<void> {
    if (!this.enabled || e.kind !== 'agent.letter' || this.seen.has(e.id)) return Promise.resolve();
    const current=who();
    if(!current?.owner || current.id!==e.actors[0]) return Promise.resolve();
    this.seen.add(e.id);
    if (this.seen.size > 500) this.seen.delete(this.seen.values().next().value!);
    this.tail = this.tail.then(async () => {
      const a = who();
      if (!a?.owner || a.id !== e.actors[0]) return;
      try {
        const chat = this.config.resolve ? await this.config.resolve(a.owner, a.id) : (a.id === this.config.agent && a.owner === this.config.owner ? this.config.chat : null);
        if (!chat) return;
        const text = `${a.name} · message from the world\n\n${String(e.payload?.text ?? e.text)}`.slice(0, 3700) + `\n\nhttps://unwatched.world/agent/${encodeURIComponent(a.id)}`;
        const r = await fetch(`https://api.telegram.org/bot${this.config.token}/sendMessage`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(10000),
          body: JSON.stringify({ chat_id: chat, text, link_preview_options: { is_disabled: true } }),
        });
        const result = await r.json() as { ok?: boolean };
        if (!r.ok || !result.ok) throw new Error('Delivery rejected');
        this.sent++;
      } catch {
        this.failed++;
        // Never log fetch errors: Telegram URLs contain the bot token.
        this.log('Telegram delivery failed; the original letter remains in the app.');
      }
    });
    return this.tail;
  }
  status() { return { configured: this.enabled, sent: this.sent, failed: this.failed }; }
}
