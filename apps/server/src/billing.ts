import Stripe from "stripe";
import type { AgentState, Tier } from "@unwatched/engine";
import type { Store, Wallet, Plan } from "@unwatched/store";

/**
 * What each plan buys per day, per citizen, per month. Provider cost must be measured
 * separately; these entitlements are not a dollar estimate or a shared-world budget.
 * Nobody thinks for free: an account with no plan has a citizen on habit alone. `gets` is the whole truth of the plan, shown as is.
 */
export const PLANS: Record<Plan, { name: string; price: number; tier1: number; tier2: number; reflect: boolean; blurb: string; gets: string[] }> = {
  none:     { name: "No plan",  price: 0,  tier1: 0,   tier2: 0,  reflect: false, blurb: "On habit alone until a plan is bought.", gets: ["Works, eats, sleeps and talks in set phrases", "No thoughts of their own, so no letters answered", "Friends notice"] },
  visitor:  { name: "Visitor",  price: 3,  tier1: 10,  tier2: 1,  reflect: false, blurb: "Ten thoughts a day. Enough to answer a letter and keep a job.", gets: ["10 thoughts a day, on Haiku 4.5", "1 careful decision a day, on Sonnet 5, so a letter home is possible but rare", "No nightly reflection, unless credits pay for one", "The digest and the paper", "No portrait, and letters are not read aloud"] },
  resident: { name: "Resident", price: 12, tier1: 50,  tier2: 6,  reflect: true,  blurb: "Thinks all day, reflects every night, writes to you at crossroads.", gets: ["50 thoughts a day, on Haiku 4.5", "6 careful decisions a day, on Sonnet 5", "A nightly reflection on Opus 5, and a morning plan", "Writes to you when something is at stake", "Their portrait, and letters read aloud in their voice", "The digest and the paper"] },
  patron:   { name: "Patron",   price: 29, tier1: 120, tier2: 15, reflect: true,  blurb: "Our most capable mind for every careful thought.", gets: ["120 thoughts a day, on Haiku 4.5", "15 careful decisions a day, on Opus 5", "A nightly reflection on Opus 5, and a morning plan", "Writes to you when something is at stake", "Their portrait, and letters read aloud in their voice", "Their book and paintings", "The digest and the paper"] },
};
export const PACKS: Record<string, { credits: number; price: number }> = { small: { credits: 100, price: 3 }, medium: { credits: 500, price: 12 }, large: { credits: 2000, price: 40 } };
/** What a thought costs in credits when the allowance is spent. */
export const COST: Record<Tier, number> = { 1: 1, 2: 4, 3: 10 };

/** Stripe price lookup keys, made by scripts/stripe-setup.mjs; the ids are found at start, so nothing is copied by hand. */
export const LOOKUP = { visitor: "unwatched_visitor_monthly", resident: "unwatched_resident_monthly", patron: "unwatched_patron_monthly", small: "unwatched_pack_small", medium: "unwatched_pack_medium", large: "unwatched_pack_large" } as const;

/**
 * Wallets in memory, written through to the store. Stripe when keys exist; an honest test mode when they do not.
 * Credits never become coins. There is no path from here into the town's economy.
 */
export class Billing {
  private wallets = new Map<string, Wallet>();
  readonly stripe: Stripe | null;
  readonly testMode: boolean;
  private prices = new Map<string, string>(); // lookup key -> price id
  private seen: string[] = []; // webhook event ids already applied, so a retry never grants twice
  /** Called when a plan changes through Stripe, so the town can apply it to the owner's citizens. */
  onPlan: ((ownerId: string, plan: Plan) => void) | null = null;
  constructor(private store: Store | null, private log: (l: string) => void) {
    const key = process.env.STRIPE_SECRET_KEY;
    this.stripe = key ? new Stripe(key) : null;
    this.testMode = !this.stripe;
  }
  async load() {
    if (this.store) for (const w of await this.store.allWallets()) this.wallets.set(w.ownerId, w);
    if (this.stripe) {
      try { const list = await this.stripe.prices.list({ lookup_keys: Object.values(LOOKUP), active: true, limit: 20 }); for (const pr of list.data) if (pr.lookup_key) this.prices.set(pr.lookup_key, pr.id); }
      catch (e) { this.log(`stripe: could not list prices: ${(e as Error).message}`); }
      for (const plan of ["visitor", "resident", "patron"] as const) { const env = process.env[`STRIPE_PRICE_${plan.toUpperCase()}`]; if (env) this.prices.set(LOOKUP[plan], env); }
      const missing = (["visitor", "resident", "patron"] as const).filter((p) => !this.prices.has(LOOKUP[p]));
      this.log(missing.length ? `stripe: live, but no price for ${missing.join(", ")} (run scripts/stripe-setup.mjs)` : `stripe: live, ${this.prices.size} prices`);
    }
  }
  wallet(ownerId: string): Wallet { let w = this.wallets.get(ownerId); if (!w) { w = { ownerId, plan: "none", credits: 0, stripeCustomer: null }; this.wallets.set(ownerId, w); } return w; }
  allowance(ownerId: string) { const p = PLANS[this.wallet(ownerId).plan]; return { tier1Max: p.tier1, tier2Max: p.tier2 }; }
  applyPlan(a: AgentState) { if (!a.owner || a.brainKind !== "hosted") return; const al = this.allowance(a.owner);
    a.budget.tier1Used ??= a.budget.tier1Max - a.budget.tier1Left;
    a.budget.tier2Used ??= a.budget.tier2Max - a.budget.tier2Left;
    a.budget.tier1Left = Math.max(0, al.tier1Max - a.budget.tier1Used);
    a.budget.tier2Left = Math.max(0, al.tier2Max - a.budget.tier2Used);
    a.budget.tier1Max = al.tier1Max; a.budget.tier2Max = al.tier2Max;
    a.budget.reflectionIncluded = PLANS[this.wallet(a.owner).plan].reflect;
    a.budget.planningIncluded = this.wallet(a.owner).plan !== "none"; }

  /** The engine asks; we answer from the wallet. */
  bank = (a: AgentState, tier: Tier): boolean => {
    if (!a.owner) return false;
    const w = this.wallet(a.owner); const cost = COST[tier];
    if (w.credits < cost) return false;
    w.credits -= cost;
    void this.store?.saveWallet(w); void this.store?.credit(a.owner, -cost, tier === 1 ? "thought" : tier === 2 ? "stakes" : "reflection", a.id);
    return true;
  };

  refund = (a: AgentState, tier: Tier): void => {
    if (!a.owner) return;
    const w = this.wallet(a.owner); w.credits += COST[tier];
    void this.store?.saveWallet(w); void this.store?.credit(a.owner, COST[tier], "failed-thought-refund", a.id);
  };

  async grant(ownerId: string, credits: number, reason: string, ref: string | null = null) { const w = this.wallet(ownerId); w.credits += credits; await this.store?.saveWallet(w); await this.store?.credit(ownerId, credits, reason, ref); return w; }
  async setPlan(ownerId: string, plan: Plan) { const w = this.wallet(ownerId); if (w.plan !== plan) { w.plan = plan; await this.store?.saveWallet(w); this.onPlan?.(ownerId, plan); } return w; }
  private async remember(ownerId: string, customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined) { const id = typeof customer === "string" ? customer : customer?.id; if (!id) return; const w = this.wallet(ownerId); if (w.stripeCustomer !== id) { w.stripeCustomer = id; await this.store?.saveWallet(w); } }
  private ownerOfCustomer(customer: string | null | undefined): string | null { if (!customer) return null; for (const w of this.wallets.values()) if (w.stripeCustomer === customer) return w.ownerId; return null; }

  /** Stripe Checkout for a pack, returning the URL to send the owner to. */
  async checkoutPack(ownerId: string, pack: string, origin: string): Promise<{ url: string } | { error: string }> {
    const p = PACKS[pack]; if (!p) return { error: "no such pack" };
    if (!this.stripe) return { error: "test mode" };
    const w = this.wallet(ownerId); const price = this.prices.get(LOOKUP[pack as keyof typeof LOOKUP]);
    const session = await this.stripe.checkout.sessions.create({
      mode: "payment", success_url: `${origin}/account/credits?paid=1`, cancel_url: `${origin}/account/credits`, client_reference_id: ownerId,
      ...(w.stripeCustomer ? { customer: w.stripeCustomer } : { customer_creation: "always" }), allow_promotion_codes: true,
      line_items: [price ? { price, quantity: 1 } : { quantity: 1, price_data: { currency: "usd", unit_amount: p.price * 100, product_data: { name: `${p.credits} Unwatched credits`, description: "Credits pay for thinking. They never become coins." } } }],
      metadata: { owner_id: ownerId, credits: String(p.credits), pack },
    });
    return session.url ? { url: session.url } : { error: "Stripe did not give a checkout link" };
  }
  async checkoutPlan(ownerId: string, plan: Plan, origin: string): Promise<{ url: string } | { error: string }> {
    if (!this.stripe) return { error: "test mode" };
    if (plan === "none") return { error: "no plan is not bought; it is what is left when one ends" };
    const priceId = this.prices.get(LOOKUP[plan]); if (!priceId) return { error: `no Stripe price configured for ${plan}` };
    const w = this.wallet(ownerId);
    const session = await this.stripe.checkout.sessions.create({
      mode: "subscription", success_url: `${origin}/account/credits?plan=${plan}`, cancel_url: `${origin}/account/credits`, client_reference_id: ownerId, allow_promotion_codes: true,
      ...(w.stripeCustomer ? { customer: w.stripeCustomer } : {}),
      line_items: [{ price: priceId, quantity: 1 }], metadata: { owner_id: ownerId, plan }, subscription_data: { metadata: { owner_id: ownerId, plan } },
    });
    return session.url ? { url: session.url } : { error: "Stripe did not give a checkout link" };
  }
  /** Stripe's own page for changing a card, switching or ending a plan, and the invoices. */
  async portal(ownerId: string, origin: string): Promise<{ url: string } | { error: string }> {
    if (!this.stripe) return { error: "test mode" };
    const w = this.wallet(ownerId); if (!w.stripeCustomer) return { error: "nothing bought yet" };
    const s = await this.stripe.billingPortal.sessions.create({ customer: w.stripeCustomer, return_url: `${origin}/account/credits` });
    return { url: s.url };
  }
  /** The plan a subscription stands for, read off its price; visitor once it is no longer paid. */
  private planOf(sub: Stripe.Subscription): Plan {
    if (!(sub.status === "active" || sub.status === "trialing" || sub.status === "past_due")) return "none";
    for (const it of sub.items.data) { const k = it.price.lookup_key; for (const plan of ["patron", "resident", "visitor"] as const) if (k === LOOKUP[plan] || it.price.id === this.prices.get(LOOKUP[plan])) return plan; }
    return (sub.metadata?.plan as Plan) ?? "none";
  }
  /** Webhook: the only place a purchase becomes credits or a plan. */
  async webhook(rawBody: string, signature: string | undefined): Promise<{ ok: boolean; note?: string }> {
    if (!this.stripe) return { ok: false, note: "test mode" };
    const secret = process.env.STRIPE_WEBHOOK_SECRET; if (!secret || !signature) return { ok: false, note: "no webhook secret" };
    let ev: Stripe.Event;
    try { ev = this.stripe.webhooks.constructEvent(rawBody, signature, secret); } catch (e) { return { ok: false, note: (e as Error).message }; }
    if (this.seen.includes(ev.id)) return { ok: true, note: "seen" }; this.seen.push(ev.id); if (this.seen.length > 2000) this.seen.shift();
    if (ev.type === "checkout.session.completed") {
      const s = ev.data.object; const owner = s.metadata?.owner_id ?? s.client_reference_id; if (!owner) return { ok: true, note: "no owner" };
      await this.remember(owner, s.customer);
      if (s.mode === "payment" && s.payment_status === "paid") await this.grant(owner, Number(s.metadata?.credits ?? 0), "purchase", s.id);
      if (s.mode === "subscription" && s.metadata?.plan) await this.setPlan(owner, s.metadata.plan as Plan);
      this.log(`stripe: ${s.mode} for ${owner}`);
    }
    if (ev.type === "customer.subscription.updated" || ev.type === "customer.subscription.deleted") {
      const sub = ev.data.object; const owner = sub.metadata?.owner_id ?? this.ownerOfCustomer(typeof sub.customer === "string" ? sub.customer : sub.customer.id);
      if (!owner) return { ok: true, note: "no owner for subscription" };
      await this.remember(owner, sub.customer);
      const plan = ev.type === "customer.subscription.deleted" ? "none" : this.planOf(sub);
      await this.setPlan(owner, plan); this.log(`stripe: ${owner} is a ${plan} (${sub.status})`);
    }
    if (ev.type === "invoice.payment_failed") { const inv = ev.data.object; const owner = this.ownerOfCustomer(typeof inv.customer === "string" ? inv.customer : inv.customer?.id); this.log(`stripe: payment failed for ${owner ?? "unknown"}`); }
    return { ok: true };
  }
}
