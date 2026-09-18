# Provider offline & reconnect behavior

What `compute/provider/agent.py` does when the coordinator is unreachable, what
happens to an in-flight job, and what providers can expect when their Mac goes
to sleep. Read this before trusting the agent on a laptop you close daily.

Source of truth: `compute/provider/agent.py` (open-alpha kit). No local job
database, no disk queue — every statement below is traceable to that file.

## The short version

- **Idle and offline = nothing at risk.** The agent holds at most one job at a
  time (poll → run → report, synchronously). When the coordinator is down, the
  agent simply gets no new jobs. There is no local queue that can overflow,
  corrupt, or lose work.
- **Mid-job outage = job is reassigned, not retried locally.** If the
  coordinator drops while a job runs, the agent finishes the inference locally
  (or may finish), but the result report is fire-once; on failure it is dropped.
  The coordinator's lease expiry is the safety net: the job goes back to the
  queue and another provider picks it up.
- **Reconnect = automatic and silent.** The agent retries forever with
  exponential backoff. You do not need to restart it after an outage, a lid
  close, or a network change.

## Backoff schedule (exact)

On any coordinator poll failure the agent prints to stderr:

```
coordinator unavailable: <reason>; retrying in Ns
```

- First retry after **1s**, doubling each attempt: 1, 2, 4, 8, 16, then capped
  at **30s**. It stays at 30s indefinitely — there is no max-attempts limit and
  no exit-on-failure.
- The first successful poll **resets** the backoff to 1s.
- `--once` mode disables retrying entirely: it polls once and exits (useful
  under LaunchAgent/cron schedulers that impose their own schedule).

## In-flight job loss semantics

1. **Heartbeats.** While a job runs, a background thread renews the job lease
   every `min(30, max(5, lease_seconds // 3))` seconds (default lease 300s →
   every 30s). If a renewal fails, the thread logs
   `heartbeat failed <job-id>: <reason>` to stderr and **keeps the job running**
   — it does not abort local inference.
2. **Result reporting is fire-once.** `report(job_id, result)` is attempted one
   time. If the coordinator is unreachable at that moment, the exception is
   swallowed and the local result is **lost, not queued**. This is safe because
   the lease has also lapsed: the coordinator treats the job as uncompleted and
   reassigns it. No double-credit: a provider that later reports a result for an
   expired lease is not the job's owner.
3. **Streaming jobs** behave the same per-chunk: each `report_chunk` is one
   attempt, errors are reported once via an error chunk, then dropped. A
   cancelled flag (see below) short-circuits to "cancelled" with no report.
4. **Cancellation.** A successful heartbeat carrying `cancelled: true` (only on
   the `/compute/api` path) sets a stop event: streaming aborts mid-stream,
   non-streaming skips the final report. Either way the job is over locally.

In short: the agent never blocks, never holds results hostage, and never
double-reports. The coordinator's lease is the single arbiter of job ownership.

## Laptop-lid / sleep / network changes

- The Mac keeps its identity: `PROVIDER_ID` is derived deterministically from
  the hostname (`uuid5`), so the machine is the same provider across reboots
  (see also PR #187). The key lives in the macOS keychain; `provider.env`
  persists the rest of the config.
- While asleep, heartbeats miss; the coordinator reclaims the job at lease
  expiry and reassigns it. On wake, the backoff loop reconnects on the next
  cycle — no manual restart needed.
- Local inference is interrupted by sleep like any process; there is no
  resume-from-checkpoint. The job has already been (or will be) reassigned.

## Graceful shutdown

`SIGINT`/`SIGTERM` set a stop flag checked at the top of the poll loop: the
agent finishes the **current job** (including its single report attempt) and
then exits with `provider stopped`. It never abandons a report mid-send to exit
faster.

## Pre-flight: the doctor

`python3 provider/agent.py --doctor` checks, in order: coordinator
reachability (and provider auth on the `/compute/api` path), Ollama on
`OLLAMA_URL`, and that every model in `DASHA_MODEL_MAP` is installed — exiting
nonzero on any failure. Run it after install, OS updates, or any reconnect
trouble before assuming the coordinator is at fault.

## Known non-goals (by design)

- No durable outbox: results are never persisted to disk for later retry.
- No exactly-once delivery: lease-expiry reassignment is at-least-once from
  the coordinator's side; the agent's fire-once report keeps it from becoming
  double-counting.
- No resume-across-restart: a killed agent cannot pick up where it left off;
  the lease does that job instead.

---

*Task 5 of `workspace/tasks/dasha-desk/TASKS.md`. Docs-only; `compute/release-files.json` untouched (repo-root docs/ are never registered there — the manifest covers `compute/` entries only).*
