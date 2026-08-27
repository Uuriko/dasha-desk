# Source provenance

This directory publishes the MIT-licensed Dasha Compute open-alpha kit as browseable,
forkable source. It was imported from the archive served at
`https://www.getdasha.com/dasha-compute-open-alpha.tar.gz` on 2026-08-27.

Original archive SHA-256:

```text
dac7249b2ae63da395d26c1a7ce2cedca9bbe115acf69dee2f586104f3357f46
```

Before import, all eight upstream end-to-end tests passed with Node 20+ and Python
3.10+. This source adds one installer hardening correction plus its regression test:
coordinator URLs written into the shell-sourced macOS service configuration reject
shell metacharacters. The resulting suite has nine passing tests.

The live downloadable archive should be regenerated from reviewed repository source
after this change is merged. Until then, treat this directory as the review source and
the live archive as the currently distributed artifact.
