# Canonical Build Source Manifest

## Include

- Repository: `https://github.com/sanlorenzoprx/memoriesmystory`
- Packet 2 branch: `packet-2/local-first-capture`; each later packet branches intentionally from the accepted preceding packet head.
- Starting revision: the commit containing this manifest.
- All tracked source, Foundation, Product, Architecture, Execution, Security, Operations, tests, and packet receipts in that revision.
- Synthetic photographs/audio created specifically for tests, with no family or production data.
- Empty example environment files only.

## Exclude

- every legacy repository or ZIP;
- code, schemas, prompts, architecture, configuration, or business rules from another product;
- real family photographs, voices, transcripts, credentials, tokens, private URLs, or production exports;
- generated build output, Playwright reports, Wrangler local state, `.dev.vars*`, and `.env*` except tracked examples.

## Fresh-start check

Before implementation, verify the remote URL, branch/revision, clean worktree, technical identifier `memoriesmystory`, and absence of unrelated repository references. If source authority is ambiguous, stop before changing code.
