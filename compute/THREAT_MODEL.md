# Threat model · version 0.3

## Current guarantee

- A local deployment keeps traffic on the operator's own network.
- A remote deployment can protect traffic in transit with correctly configured HTTPS.
- The bundled local coordinator holds prompts and outputs only in process memory for the life of a request.
- The live queue writes ordinary queued and leased prompts to Durable Object storage. Completion, failure, cancellation or expiry clears or deletes prompt text; completed answers, errors and chunks receive a ten-minute expiry and are removed by a subsequent prune. Night Shift retains its assignment prompt and up to five artifacts until its task is deleted.
- Neither coordinator intentionally logs prompt or output bodies.
- Local provider and consumer credentials use separate bearer secrets. Live provider tokens and developer keys are account-bound, stored only as hashes and owner-revocable.
- Request bodies are size-limited and accepted roles/models are validated.

## Not guaranteed

- The coordinator process or live Durable Object code can read prompts and outputs.
- The provider process and the person controlling that machine can read prompts and outputs.
- Local bearer keys are shared secrets, not user accounts, and have no revocation store.
- Local jobs disappear on coordinator restart and are not replicated.
- There is no hardware attestation, trusted execution environment, signed binary, encrypted memory isolation, billing ledger, tax handling or content moderation. Basic live rate limits and body caps are not comprehensive denial-of-service protection.
- Ollama and every model are separate dependencies with their own security and licenses.

## Assets

- Consumer prompts and model responses.
- Consumer and provider bearer secrets.
- Provider capacity, model inventory and hardware metadata.
- Future balances and metering records, which do not exist in this release.

## Trust boundaries

1. client to coordinator;
2. coordinator process and host;
3. coordinator to provider;
4. provider agent to local Ollama;
5. model artifacts loaded by Ollama.

## Safe use

Use version 0.3 only with trusted participants and non-sensitive evaluation prompts. Streaming changes response delivery, not the trust boundary. Bind locally or place the coordinator behind authenticated HTTPS. Rotate both local secrets after exposure; delete and reissue exposed live credentials. Do not describe this release as private from providers, end-to-end encrypted, hardware verified, audited or production ready.
