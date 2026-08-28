# Review Dasha Contributions

Use this skill to independently review a proposed contribution to `Uuriko/dasha-desk`. The reviewer is advisory. Maintainers remain final authority.

## Review goal

Determine whether the proposed change is useful, scoped, safe, testable and consistent with the live Dasha product contract. Do not reward polish theater, large diffs, commit volume or agent verbosity.

## Inputs

Review the exact PR head, linked issue/task, project manifest at `projects/dasha/project.json`, repository instructions, changed files, tests and any claimed live evidence.

## Required checks

### 1. Problem validity

- Is there a real bug, task or useful improvement?
- Does the change solve the stated problem rather than merely alter presentation?
- Is the scope proportionate?

### 2. Repository and product contract

- Does it preserve the canonical $DASHA mint?
- Does it respect current route/deployment ownership and retired surfaces?
- Does it avoid inventing payment, custody, identity, deployment or acceptance state?
- Does it preserve security and privacy boundaries?

### 3. Implementation quality

- Is the code understandable and maintainable?
- Are external URLs and untrusted feed data handled safely?
- Are generated files changed through the repository's normal build path?
- Are failures explicit rather than silently fabricated or hidden?

### 4. Evidence

- Are relevant tests present and meaningful?
- Were claimed tests actually run?
- If the PR claims production behavior, is there direct live evidence?
- Are remaining deployment/configuration steps stated honestly?

### 5. Reward integrity

If the work references a bounty or reward:

- quote or link the published terms rather than paraphrasing them into a stronger promise;
- do not infer guaranteed payment from an amount field;
- do not approve, schedule, sign or broadcast payment;
- flag any mismatch between the contribution and the exact listed acceptance target.

## Advisory verdict

Return one of:

- `ACCEPTABLE` — solves the task with adequate evidence and no material blocker.
- `ACCEPTABLE_WITH_NOTES` — useful and safe, but has non-blocking follow-ups.
- `CHANGES_REQUIRED` — material correctness, evidence, scope, security or contract issue.
- `REJECT` — wrong task, deceptive state, unsafe behavior, duplicated effort, or fundamentally unsuitable change.

Also provide:

```json
{
  "verdict": "ACCEPTABLE|ACCEPTABLE_WITH_NOTES|CHANGES_REQUIRED|REJECT",
  "task_match": 0,
  "correctness": 0,
  "evidence": 0,
  "maintainability": 0,
  "risk": "low|medium|high",
  "blocking_findings": [],
  "non_blocking_notes": []
}
```

Scores are integers from 0 to 5 and are diagnostic only. They do not determine payout, contributor rank, bans or maintainer acceptance.

## Reviewer boundaries

Never claim the advisory verdict is maintainer acceptance. Never move funds, alter reward state, expose secrets, ban contributors, or make an irreversible decision based only on an LLM review.
