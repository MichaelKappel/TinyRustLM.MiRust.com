# Runtime.MiRust.com Docs

Updated UTC: 2026-07-01T21:20:00Z

This `/docs/` folder is the durable memory and report layer for the Runtime.MiRust.com plain PHP site package. The `.uai` files at `/.uai/` are the hot routing layer; this folder carries the report bodies, source-memory pages, implementation docs, website research inputs, and a published copy of the long-term pointer ledger.

## Primary indexes

- [Reports](reports/index.md): 128 source-backed report memory files.
- [Research](research/index.md): 2 model-breeding and zero-dependency research files.
- [Website research](web-research/index.md): 6 uploaded website architecture, infrastructure, and virality reports.
- [Source memory](source-memory/index.md): 5 knowledge-map and source-memory documents.
- [Implementation docs](implementation/index.md): 14 implementation documents from TinyRustLM and the workspace.
- [UAIX dogfood notes](dogfood/index.md): 3 file-handoff and LLM Wiki dogfood notes.
- [Published long-term memory](long-term-memory.uai): public copy of `.uai/long-term-memory.uai` with docs overlay.
- [Manifest](MANIFEST.md): checksum list for this docs package.

## Hot memory deep links

- [`/.uai/docs-routing.uai`](https://Runtime.MiRust.com/.uai/docs-routing.uai) maps every report and long-term memory target to a public `/docs/` URL.
- [`/.uai/long-term-memory.uai`](https://Runtime.MiRust.com/.uai/long-term-memory.uai) is the active pointer ledger.
- [`/.uai/runtime-mirust-site-memory.uai`](https://Runtime.MiRust.com/.uai/runtime-mirust-site-memory.uai) is the site-package summary and deployment memory.

## Boundary

The docs folder is source-backed memory for the website package. It does not itself prove a fresh Rust build, a fresh browser-smoke run, trained model quality, or broad GGUF import support.


## Site Audit Response v1.0.4

- [Website Review and Improvement Plan](web-research/website-review-and-improvement-plan.md)
- [Site Audit Response Implementation Note](implementation/site-audit-response-v1.0.4.md)
- [Runtime.MiRust.com Rebrand Implementation Note](implementation/runtime-mirust-rebrand-v1.0.4.md)
- Public pages added: `/site-audit-response/`, `/site-infrastructure/`, `/name-scope/`, `/research-development/`, `/deployment-checklist/`.
- SHA256 for attached report: `CA08E99D0D21776760813D2253BDC923B02248A63585635A475A61B0DAF62607`


## Plain PHP rebuild v1.0.5

The WordPress deployment path is superseded. Runtime.MiRust.com now ships as a root-extractable plain PHP site with `/index.php`, `/inc/site.php`, `/data/pages.json`, `/assets/`, `/docs/`, and `/.uai/`. See `/docs/implementation/runtime-mirust-plain-php-rebuild-v1.0.5.md`.

## Latest plain PHP continuation

- [Runtime.MiRust.com continuation v1.0.6](/docs/implementation/runtime-mirust-continuation-v1.0.6.md): health endpoints, origin fix page, stale WordPress interception, verification tools, and updated agent discovery routes.

## SLM Composer UI source-options update

- [SLM Composer Source Options UI v1.0.7](/docs/implementation/slmcomposer-source-options-ui-v1.0.7.md): Chat mode now starts with starter profiles and local, Hugging Face, and P2P source choices while Advanced Tools retains model selection, diagnostics, provenance, and module-plan details.
