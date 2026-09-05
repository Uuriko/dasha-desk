/**
 * In-process credit reservations.
 *
 * The append-only ledger records final usage, but a balance check by itself permits
 * many concurrent requests to observe the same balance before any of them clears.
 * Reserve the worst-case prompt + requested completion budget before dispatch, then
 * release it after the request settles. This is an alpha spend-control boundary for
 * one gateway process, not a distributed billing system.
 */
import { randomUUID } from 'node:crypto';

export class QuotaReservations {
  constructor() {
    this.byConsumer = new Map();
  }

  held(consumer) {
    const holds = this.byConsumer.get(consumer);
    if (!holds) return 0;
    let total = 0;
    for (const amount of holds.values()) total += amount;
    return total;
  }

  async reserve(consumer, amount, readBalance) {
    if (typeof consumer !== 'string' || !consumer) throw new TypeError('consumer is required');
    if (!Number.isSafeInteger(amount) || amount < 1) {
      throw new TypeError('reservation amount must be a positive safe integer');
    }
    if (typeof readBalance !== 'function') throw new TypeError('readBalance is required');

    // Calculate outstanding holds only after the asynchronous balance read. In one
    // Node process, competing callers then resume and install holds serially, so a
    // second request observes the first reservation even if both queried the same
    // ledger balance concurrently.
    const balance = await readBalance();
    if (!Number.isSafeInteger(balance)) throw new Error('ledger returned an invalid balance');
    const held = this.held(consumer);
    const available = balance - held;
    if (available < amount) {
      return { ok: false, balance, held, available, required: amount };
    }

    const id = randomUUID();
    const holds = this.byConsumer.get(consumer) || new Map();
    holds.set(id, amount);
    this.byConsumer.set(consumer, holds);
    let released = false;
    return {
      ok: true,
      id,
      consumer,
      amount,
      balance,
      heldBefore: held,
      release: () => {
        if (released) return false;
        released = true;
        const current = this.byConsumer.get(consumer);
        if (!current) return false;
        current.delete(id);
        if (!current.size) this.byConsumer.delete(consumer);
        return true;
      },
    };
  }
}
