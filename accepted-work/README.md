# Dasha accepted work

This directory is the reviewed, append-only public record of accepted Dasha Build outcomes.

Each record lives in `accepted-work/records/<id>.json`. A record is evidence of an accepted outcome, not proof of payment. GitHub remains the source of truth for the underlying pull request and maintainer acceptance.

Rules:

- one logical accepted outcome per record;
- source PR URL and exact merged head SHA are required;
- contributor identity comes from the accepted GitHub record, not self-report;
- records are added through normal review and should not be silently rewritten after publication;
- reward state is separate from acceptance state;
- no LLM verdict can create an accepted record by itself;
- `index.json` is generated from reviewed records and must not be hand-edited.
