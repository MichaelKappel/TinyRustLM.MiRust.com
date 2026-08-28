# TinyRustLM Historical Runtime Archive

The former standalone runtime documentation lane has been absorbed into
TinyRustLM.MiRust.com and frozen as historical evidence.

Use this archive for historical implementation evidence only. The current developer portal is:

- <https://tinyrustlm.mirust.com/developer-portal/>

The current browser-local app is:

- <https://TinyRustLM.com/>

## What Was Preserved

The archive keeps the former runtime documentation corpus as static reference material:

- implementation docs
- report memory
- source-memory notes
- web-research notes
- dogfood notes
- package metadata
- page registry export
- llms exports
- sitemap, version, and health markers

The preservation manifest records byte counts and SHA-256 checksums:

- [MANIFEST.md](MANIFEST.md)

## Current Reading Order

1. [Developer portal](/developer-portal/)
2. [Current docs home](/docs/)
3. [Long-term memory](/docs/long-term-memory.md)
4. [Report index](/docs/report-index.md)
5. [Preservation manifest](MANIFEST.md)
6. [Implementation docs archive](runtime-docs/implementation/index.md)
7. [Former page registry](runtime-pages.json)

## Boundary

This archive is not a second live product site, a current specification, or a
compatibility promise. References inside it to `.slm`, old packages, adapters,
selectors, scripts, or earlier runtime behavior describe superseded historical
work only. They do not authorize a reader, fallback, migration, alias, or
shipping path.

The sole current clean-slate composition path is SLM2. Current authority lives
in the developer portal and its current contracts. Project sites do not run or
proxy user model bytes or receive prompts.
