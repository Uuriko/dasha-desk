# Console snapshot

This directory is the in-repo hop-up for Dasha Compute, not a second product.

Live HTML is owned by the dasha-lobby Worker at `getdasha.com/compute`. Do not wrangler-deploy from here. Do not Designer-publish. This snapshot matches that product:

- first paint is one step, **Use** or **Provide**;
- Use is one prompt and **Run**;
- hosted is Workers AI;
- coordinator is `https://lobby.getdasha.com/compute/api`;
- provider token goes in a 0600 file, not argv;
- Night / Build / status / network open after first success;
- `providers_online` is a real number or unread — never a checking chip.

The `app/` directory targets Next.js 16 / React 19 and uses only React plus plain CSS; move it into a compatible Next or Vinext project to run it.

The generated social card is omitted from the source archive because it is a binary media asset. `public/favicon.svg` is included and MIT-licensed with the code.
