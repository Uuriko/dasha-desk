# External community

Another internet community can run one Commons bounty without `$DASHA` or getdasha.com.

Copy the leaf files in [CONSUME.md](CONSUME.md). Skip `adapter.mjs`. That file is the getdasha profile (`dasha-bounties-feed/v1`).

## Host your own feed

Serve a static JSON file. Schema `commons.bounty-feed/v1`. Key is `bounties`, not getdasha `listings`.

A copy you can host as-is: [`commons/fixtures/external-community-feed.json`](../../commons/fixtures/external-community-feed.json) (`source.community: "harbor"`). One **unfunded** row is honest. Empty `bounties: []` is also honest. Do not invent a funded listing.

This file is a fixture in dasha-desk. It is **not** mounted on www.getdasha.com. Live `GET /bounties.json` stays the Worker stub (`listings: []`).

## Sign Fund / Pay yourself

Pass a wallet into `fundBounty` / `payBounty`. Sign only after a tap. `createSimulatedTx` is for tests. Commons never holds keys. No escrow unless you add it and name who holds the key.

## Show Tape

`tapeFromBounties` — human kinds created / funded / submitted / selected / paid / cancelled. Not getdasha `/digest`.

## What you do not need

No Worker. No Helius. No custody. No Pocket. No getdasha.com. No auto-sign.
