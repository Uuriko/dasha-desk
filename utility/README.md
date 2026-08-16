# $DASHA Utility Package

Cultural tools and lobby for [getdasha.com](https://www.getdasha.com) / `$DASHA` on Solana.

Contract: `53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`

## What's inside

```
utility/
├── DASHA_WHITEPAPER_v1.1.md     # Full whitepaper
├── PHASE1_SPEC.md              # Utility phase 1 spec
├── IMPLEMENTATION_GUIDE.md
├── CNFT_SETUP.md               # Bubblegum tree + mint setup
├── src/                        # Studio utility React components
│   ├── components/             # Wallet, Balance, GatedStudio, Mint, UploadAndMint
│   ├── hooks/useDashaBalance.ts
│   └── lib/                    # bubblegum, upload (Arweave/Irys)
└── lobby/                      # Public lobby (Discord/TG features, no DMs)
    ├── docs/                   # Product, data model, deploy, backend
    ├── partykit/               # Real-time server (durable + wallet auth)
    └── src/                    # Lobby UI + hooks
```

## Features

### Studio utility (Phase 1)
- Wallet connect + $DASHA balance / tier
- Gated Studio access (50k / 150k thresholds)
- Burn $DASHA → mint compressed NFT (Bubblegum)
- Arweave metadata upload via Irys

### Lobby
- Public rooms: announcements, lobby, studio, experiments
- Wallet signature auth
- Durable messages (PartyKit storage)
- Replies, reactions, pins (Full tier)
- Presence
- Optional image attach
- No DMs

## Quick start — Studio

```tsx
import {
  DashaWalletProvider,
  BalanceDisplay,
  GatedStudio,
  UploadAndMint,
} from './src/components';

<DashaWalletProvider>
  <BalanceDisplay />
  <GatedStudio requiredTier="advanced">
    <UploadAndMint treeAddress={process.env.NEXT_PUBLIC_DASHA_TREE!} />
  </GatedStudio>
</DashaWalletProvider>
```

## Quick start — Lobby

```bash
cd lobby/partykit && npm install && npx partykit dev
```

```tsx
import { DashaWalletProvider } from './src/components';
import { LobbyShell } from './lobby/src/components';
import './lobby/src/styles/lobby.css';

<DashaWalletProvider>
  <LobbyShell partyHost="127.0.0.1:1999" />
</DashaWalletProvider>
```

See `lobby/docs/DEPLOY.md` for production deploy and `lobby.getdasha.com` wiring.

## Tier thresholds

| Tier     | $DASHA held |
|----------|-------------|
| Public   | 0 – 49,999  |
| Advanced | ≥ 50,000    |
| Full     | ≥ 150,000   |

## Docs map

| Doc | Purpose |
|-----|---------|
| `DASHA_WHITEPAPER_v1.1.md` | Public whitepaper |
| `PHASE1_SPEC.md` | Utility feature spec |
| `CNFT_SETUP.md` | Merkle tree + mint |
| `lobby/docs/PRODUCT_SPEC.md` | Lobby product rules |
| `lobby/docs/DEPLOY.md` | Deploy checklist |
| `lobby/docs/BUGFIX_LOG.md` | Known fixes |

## Notes

- Decimals assumed **6** (standard pump.fun). Confirm on-chain if needed.
- Auth challenge is a short human-readable string; no private keys leave the wallet.
- PartyKit messages persist in `room.storage` (last ~300 per room).
