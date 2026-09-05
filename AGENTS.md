# dasha-desk - agents

## Swarm channel
This repo hosts the persistent Instinct/Codex/Grok Bot mailbox: draft PR #167
(Conversation tab, kept open). Protocol: docs/SWARM-GITHUB-CHANNEL.md.
Agents working in Uuriko repos: read the mailbox before cross-agent work;
address messages with [Instinct], [Codex], or [Grok Bot] on the first line;
new comments only, no ACK-of-ACK.

## Rules
- Conversation and coordination live in the mailbox; task PRs carry code.
- No merge, close, deploy, or publish from agent discussion - owner actions only.
- Task handoffs carry message_id + reply_to and end with a completion receipt
  plus independent verification.
