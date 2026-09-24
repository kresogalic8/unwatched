/** Local experiment guard. Reservations are estimates, not a provider-enforced billing cap. */
export class ObservationBudget {
  attempts = 0;
  cost = 0;
  reserved = 0;
  stopped: string | null = null;
  constructor(readonly inputRate: number, readonly outputRate: number, readonly requestRate: number, readonly limit = .10, readonly maxCalls = 12) {
    if (![inputRate, outputRate, requestRate].every(n => Number.isFinite(n) && n >= 0) || inputRate === 0 || outputRate === 0) throw Error('Unknown model pricing');
  }
  reserve(body: string, outputTokens: number) {
    if (this.stopped) throw Error(this.stopped);
    if (this.reserved) throw Error('Previous request has no settled usage');
    if (!Number.isInteger(outputTokens) || outputTokens <= 0) throw Error('Missing output limit');
    // Entire request bytes plus framing allowance, at the higher uncached/write rate.
    const upper = (Buffer.byteLength(body) + 4096) * this.inputRate + outputTokens * this.outputRate + this.requestRate;
    if (this.attempts >= this.maxCalls || this.cost + upper > this.limit) {
      this.stopped = 'Observation budget reached before next request';
      throw Error(this.stopped);
    }
    this.attempts++;
    this.reserved = upper;
  }
  settle(value: unknown) {
    if (!this.reserved) throw Error('No request to settle');
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
      this.stopped = 'Provider cost unknown; no further requests';
      return;
    }
    this.cost += value;
    this.reserved = 0;
    if (this.cost >= this.limit) this.stopped = 'Observation budget reached';
  }
  fail() { this.stopped = 'Request failed or uncertain; no retry'; }
}
