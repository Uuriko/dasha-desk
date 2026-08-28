/**
 * Append-only usage ledger — local/JSONL implementation.
 *
 * Used for development and tests. Production uses `pg-ledger.mjs` against Postgres;
 * both expose the same async interface so the gateway does not know which it has.
 *
 * The interface is async because Postgres cannot be queried synchronously, and the
 * PDF is explicit that a cache in front of the balance is the wrong trade: a stale
 * balance means either serving free tokens or turning away a paying customer.
 *
 * Append-only is the property that matters. Rows are never updated or deleted, and
 * balances are folded from the log rather than stored.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { randomUUID } from 'node:crypto';

export class Ledger {
  constructor(path = 'ocm/.data/usage.jsonl') {
    this.path = path;
    mkdirSync(dirname(path), { recursive: true });
    this.entries = existsSync(path)
      ? readFileSync(path, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))
      : [];
  }

  async init() { return this; }

  /** Credit a consumer with granted balance. Billing is a later problem (PDF §05). */
  async grant(consumer, tokens, note = 'granted') {
    return this.#append({ kind: 'grant', consumer, tokens, note });
  }

  /**
   * Clear one request: debit the consumer, credit the provider.
   * `tokens` is what the GATEWAY counted, never what the host claimed.
   */
  async clear({ consumer, host, model, promptTokens, completionTokens, jobId }) {
    return this.#append({
      kind: 'usage', consumer, host, model, jobId,
      promptTokens, completionTokens,
      tokens: promptTokens + completionTokens,
    });
  }

  #append(partial) {
    const entry = { id: randomUUID(), at: new Date().toISOString(), ...partial };
    appendFileSync(this.path, JSON.stringify(entry) + '\n');
    this.entries.push(entry);
    return entry;
  }

  async balance(consumer) {
    let n = 0;
    for (const e of this.entries) {
      if (e.consumer !== consumer) continue;
      if (e.kind === 'grant') n += e.tokens;
      else if (e.kind === 'usage') n -= e.tokens;
    }
    return n;
  }

  /** How many grants this account has received. One redemption per account. */
  async grantCount(consumer) {
    return this.entries.filter((e) => e.kind === 'grant' && e.consumer === consumer).length;
  }

  async credited(host) {
    return this.entries
      .filter((e) => e.kind === 'usage' && e.host === host)
      .reduce((n, e) => n + e.completionTokens, 0);
  }

  /** Everything the console needs, in one call, so backends stay interchangeable. */
  async summary() {
    const usage = this.entries.filter((e) => e.kind === 'usage');
    const consumers = new Map();
    for (const e of this.entries) {
      if (!e.consumer) continue;
      const c = consumers.get(e.consumer)
        || { consumer: e.consumer, granted: 0, used: 0, requests: 0 };
      if (e.kind === 'grant') c.granted += e.tokens;
      else if (e.kind === 'usage') { c.used += e.tokens; c.requests += 1; }
      consumers.set(e.consumer, c);
    }
    const creditedByHost = {};
    for (const e of usage) {
      creditedByHost[e.host] = (creditedByHost[e.host] || 0) + e.completionTokens;
    }
    return {
      consumers: [...consumers.values()].map((c) => ({ ...c, balance: c.granted - c.used })),
      creditedByHost,
      totals: {
        requests: usage.length,
        prompt_tokens: usage.reduce((n, e) => n + e.promptTokens, 0),
        completion_tokens: usage.reduce((n, e) => n + e.completionTokens, 0),
      },
      recent: usage.slice(-10).reverse(),
    };
  }

  async close() {}
}
