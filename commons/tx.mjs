/**
 * Transaction port. Commons never holds keys and never auto-signs.
 * CI uses createSimulatedTx. A browser may inject a wallet that only
 * signs after an explicit Fund / Pay click.
 *
 * No escrow. A funding signature is evidence the creator signed.
 * It is not proof we custody USDC.
 */
export const TX_ERRORS = Object.freeze({
  user_rejected: 'user_rejected',
  simulation_failed: 'simulation_failed',
  confirmation_timeout: 'confirmation_timeout',
});

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

export function txError(code, message) {
  const err = new Error(message || code);
  err.code = code;
  return err;
}

export function fakeSignature(seed) {
  const s = String(seed || '1');
  let out = '';
  for (let i = 0; i < 64; i++) out += B58[(s.charCodeAt(i % s.length) + i * 7) % 58];
  return out;
}

function peekFromOpts(opts, purpose) {
  return opts.signature || (opts.signatures && purpose && opts.signatures[purpose]) || null;
}

export function createSimulatedTx(opts = {}) {
  return {
    name: 'simulated',
    custody: false,
    autoSign: false,
    peekSignature(purpose) {
      return peekFromOpts(opts, purpose);
    },
    async requestSignature(intent) {
      if (typeof opts.onRequest === 'function') await opts.onRequest(intent);
      if (opts.reject) throw txError(TX_ERRORS.user_rejected, 'user rejected');
      if (opts.simulateFail) throw txError(TX_ERRORS.simulation_failed, 'simulation failed');
      const purpose = intent && intent.purpose;
      const signature = peekFromOpts(opts, purpose) || fakeSignature(purpose || 'tx');
      return { signature, intent: intent || null, origin: 'app' };
    },
    async confirm(signature) {
      if (opts.timeout) throw txError(TX_ERRORS.confirmation_timeout, 'confirmation timeout');
      return { signature, confirmed: true, origin: opts.origin || 'chain' };
    },
  };
}

export function createPastedTx(signature) {
  return {
    name: 'pasted',
    custody: false,
    autoSign: false,
    peekSignature() {
      return signature || null;
    },
    async requestSignature() {
      if (!signature) throw txError(TX_ERRORS.user_rejected, 'user rejected');
      return { signature, origin: 'app' };
    },
    async confirm(sig) {
      return { signature: sig, confirmed: true, origin: 'app' };
    },
  };
}
