# Integrating into dasha-desk

This package is meant to live under:

```
dasha-desk/utility/
```

It does **not** replace the existing static `studio/` or `lobby/` surfaces.
Those remain the lightweight HTML tools.

## Layout after push

```
dasha-desk/
├── studio/          # existing Meme Studio (static)
├── lobby/           # existing static lobby
├── utility/         # ← this package
│   ├── README.md
│   ├── DASHA_WHITEPAPER_v1.1.md
│   ├── PHASE1_SPEC.md
│   ├── src/         # React: wallet, gating, mint, upload
│   └── lobby/       # React Lobby + PartyKit backend
└── ...
```

## Contract

`53uxQtB9pcjWvCHguz3JTTndvuKqGxhrD37EetnCpump`

## Next for production

1. Create Bubblegum tree → set `NEXT_PUBLIC_DASHA_TREE`
2. `cd utility/lobby/partykit && npx partykit deploy`
3. Set `NEXT_PUBLIC_PARTYKIT_HOST`
4. Optionally surface utility tools from getdasha.com / lobby.getdasha.com
