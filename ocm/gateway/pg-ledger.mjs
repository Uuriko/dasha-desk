/**
 * Append-only usage ledger — Postgres implementation.
 *
 * Same interface as `ledger.mjs`. One table, insert-only: no UPDATE, no DELETE
 * anywhere in this file, which is the whole point of an audit trail. Balances are
 * aggregated on read rather than stored, so there is no cached figure to go stale
 * (PDF: a stale balance means free tokens or a turned-away customer).
 *
 * At launch scale Postgres carries the hot path alone. If aggregation ever becomes
 * the bottleneck, the fix is a materialised rollup with the log still authoritative
 * — not a mutable balance column.
 */
import pg from 'pg';
import { readFileSync, existsSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS usage_log (
  id               uuid PRIMARY KEY,
  at               timestamptz NOT NULL DEFAULT now(),
  kind             text        NOT NULL CHECK (kind IN ('grant','usage')),
  consumer         text        NOT NULL,
  host             text,
  model            text,
  job_id           text,
  prompt_tokens    integer     NOT NULL DEFAULT 0,
  completion_tokens integer    NOT NULL DEFAULT 0,
  tokens           integer     NOT NULL,
  note             text
);
CREATE INDEX IF NOT EXISTS usage_log_consumer_idx ON usage_log (consumer);
CREATE INDEX IF NOT EXISTS usage_log_host_idx     ON usage_log (host) WHERE host IS NOT NULL;
CREATE INDEX IF NOT EXISTS usage_log_at_idx       ON usage_log (at DESC);
`;

/**
 * TLS to RDS.
 *
 * With the RDS CA bundle present the server certificate is actually verified. Without
 * it the connection is encrypted but unauthenticated — which is a meaningfully weaker
 * thing, so it warns loudly rather than passing silently for "SSL: on".
 */
export function rdsTls(caPath = process.env.OCM_RDS_CA || '/etc/ocm/rds-ca.pem') {
  if (caPath && existsSync(caPath)) {
    return { ca: readFileSync(caPath, 'utf8'), rejectUnauthorized: true };
  }
  console.warn(JSON.stringify({ level: 'warn',
    msg: 'RDS CA bundle missing — Postgres TLS is encrypted but NOT verified',
    expected: caPath }));
  return { rejectUnauthorized: false };
}

export class PgLedger {
  constructor(connectionString, { ssl = true } = {}) {
    this.pool = new pg.Pool({
      connectionString,
      max: 8,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
      ssl: ssl ? rdsTls() : false,
    });
  }

  async init() {
    await this.pool.query(SCHEMA);
    return this;
  }

  async grant(consumer, tokens, note = 'granted') {
    return this.#insert({ kind: 'grant', consumer, tokens, note });
  }

  async clear({ consumer, host, model, promptTokens, completionTokens, jobId }) {
    return this.#insert({
      kind: 'usage', consumer, host, model, jobId,
      promptTokens, completionTokens,
      tokens: promptTokens + completionTokens,
    });
  }

  async #insert(e) {
    const id = randomUUID();
    await this.pool.query(
      `INSERT INTO usage_log
         (id, kind, consumer, host, model, job_id, prompt_tokens, completion_tokens, tokens, note)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
      [id, e.kind, e.consumer, e.host ?? null, e.model ?? null, e.jobId ?? null,
       e.promptTokens ?? 0, e.completionTokens ?? 0, e.tokens, e.note ?? null],
    );
    return { id, ...e };
  }

  async balance(consumer) {
    const { rows } = await this.pool.query(
      `SELECT COALESCE(SUM(CASE WHEN kind='grant' THEN tokens ELSE -tokens END),0)::bigint AS balance
         FROM usage_log WHERE consumer = $1`, [consumer]);
    return Number(rows[0].balance);
  }

  async grantCount(consumer) {
    const { rows } = await this.pool.query(
      `SELECT COUNT(*)::int AS n FROM usage_log WHERE kind='grant' AND consumer = $1`, [consumer]);
    return rows[0].n;
  }

  async credited(host) {
    const { rows } = await this.pool.query(
      `SELECT COALESCE(SUM(completion_tokens),0)::bigint AS n
         FROM usage_log WHERE kind='usage' AND host = $1`, [host]);
    return Number(rows[0].n);
  }

  async summary() {
    const [consumers, hosts, totals, recent] = await Promise.all([
      this.pool.query(
        `SELECT consumer,
                COALESCE(SUM(CASE WHEN kind='grant' THEN tokens ELSE 0 END),0)::bigint AS granted,
                COALESCE(SUM(CASE WHEN kind='usage' THEN tokens ELSE 0 END),0)::bigint AS used,
                COUNT(*) FILTER (WHERE kind='usage')::bigint AS requests
           FROM usage_log GROUP BY consumer ORDER BY consumer`),
      this.pool.query(
        `SELECT host, COALESCE(SUM(completion_tokens),0)::bigint AS n
           FROM usage_log WHERE kind='usage' AND host IS NOT NULL GROUP BY host`),
      this.pool.query(
        `SELECT COUNT(*)::bigint AS requests,
                COALESCE(SUM(prompt_tokens),0)::bigint AS prompt_tokens,
                COALESCE(SUM(completion_tokens),0)::bigint AS completion_tokens
           FROM usage_log WHERE kind='usage'`),
      this.pool.query(
        `SELECT id, at, consumer, host, model, job_id AS "jobId",
                prompt_tokens AS "promptTokens", completion_tokens AS "completionTokens", tokens
           FROM usage_log WHERE kind='usage' ORDER BY at DESC LIMIT 10`),
    ]);

    const creditedByHost = {};
    for (const r of hosts.rows) creditedByHost[r.host] = Number(r.n);
    const t = totals.rows[0];

    return {
      consumers: consumers.rows.map((r) => ({
        consumer: r.consumer,
        granted: Number(r.granted),
        used: Number(r.used),
        requests: Number(r.requests),
        balance: Number(r.granted) - Number(r.used),
      })),
      creditedByHost,
      totals: {
        requests: Number(t.requests),
        prompt_tokens: Number(t.prompt_tokens),
        completion_tokens: Number(t.completion_tokens),
      },
      recent: recent.rows,
    };
  }

  async close() { await this.pool.end(); }
}
