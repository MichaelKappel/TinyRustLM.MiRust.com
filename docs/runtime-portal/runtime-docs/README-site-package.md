# Runtime.MiRust.com plain PHP Root Package v1.0.4

This package contains the plain PHP site, root discovery files, root `.uai` memory, root `agent-file-handoff/` intake folders, and the public `/docs/` corpus.

## Root extraction

Extract this ZIP directly at the web root. It is intentionally not wrapped in an extra package directory. Extraction should create or update:

- ``
- `.uai/`
- `docs/`
- `agent-file-handoff/`
- `.well-known/security.txt`
- `llms.txt`
- `llms-full.txt`
- `sitemap.xml`
- `robots.txt`

## Public memory routes

- `/.uai/index.uai`
- `/.uai/docs-routing.uai`
- `/.uai/long-term-memory.uai`
- `/docs/index.md`
- `/docs/reports/index.md`
- `/docs/long-term-memory.uai`

## v1.0.4 rebrand

- Public site name updated to `Runtime.MiRust.com`.
- Theme folder updated to `runtime-mirust`.
- Text domain, PHP constants, function prefixes, script/style handles, seeded meta keys, comments, docs, `.uai` routing, root discovery files, and package paths use the Runtime.MiRust naming.
- Technical references to GGUF remain only where GGUF is the model-format roadmap/boundary being discussed.


## Plain PHP rebuild v1.0.5

The WordPress deployment path is superseded. Runtime.MiRust.com now ships as a root-extractable plain PHP site with `/index.php`, `/inc/site.php`, `/data/pages.json`, `/assets/`, `/docs/`, and `/.uai/`. See `/docs/implementation/runtime-mirust-plain-php-rebuild-v1.0.5.md`.
