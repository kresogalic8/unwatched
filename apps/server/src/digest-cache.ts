/** Coalesces concurrent reads and briefly backs off failures. Never stores prompts or keys. */
export class DigestCache<T> {
  private entries = new Map<string, { until: number; value: T | null }>();
  private pending = new Map<string, Promise<T | null>>();
  private groups = new Map<string,number>();
  constructor(private now = Date.now) {}
  async get(key: string, generate: () => Promise<T>, group = key): Promise<T | null> {
    const hit = this.entries.get(key);
    if (hit && hit.until > this.now()) return hit.value;
    const running = this.pending.get(key);
    if (running) return running;
    if((this.groups.get(group)??0)>this.now())return null;
    this.groups.set(group,this.now()+300_000);
    for(const [id,until] of this.groups)if(until<=this.now())this.groups.delete(id);
    const work = (async () => {
      let value: T | null = null;
      try { value = await generate(); } catch { /* The chronological record is still available. */ }
      if(value===null)this.groups.set(group,this.now()+60_000);
      this.entries.delete(key);
      this.entries.set(key, { value, until: this.now() + (value === null ? 60_000 : 3_600_000) });
      while (this.entries.size > 256) this.entries.delete(this.entries.keys().next().value!);
      return value;
    })();
    this.pending.set(key, work);
    try { return await work; } finally { this.pending.delete(key); }
  }
}
