# Console snapshot

This directory contains the complete Dasha Compute v0.3 interface and honest local-console API states. The `app/` directory targets Next.js 16 / React 19 and uses only React plus plain CSS; move it into a compatible Next or Vinext project to run it.

The intended production split is:

- `getdasha.com/compute` for the compact marketing handoff;
- `console.getdasha.com` for this working surface;
- `compute.getdasha.com/v1` for the coordinator API.

The generated social card is omitted from the source archive because it is a binary media asset. `public/favicon.svg` is included and MIT-licensed with the code.
