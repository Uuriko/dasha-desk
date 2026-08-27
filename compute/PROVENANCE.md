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

Repository source is now canonical. `npm run release:build` creates a deterministic
archive, external SHA-256 file, and release manifest from the reviewed allowlist in
`release-files.json`. The main-branch GitHub workflow uploads those files and creates
build provenance for the archive. The live download remains a separate deployment and
must not be described as updated until its bytes match a reviewed repository artifact.
