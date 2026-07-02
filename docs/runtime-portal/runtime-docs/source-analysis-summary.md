# Source Analysis Summary

## Current source-backed project identity

Runtime.MiRust.com is the public project website for TinyRustLM: a custom Rust/WASM browser-local SLM runtime and static browser UI. The supplied bundle describes the active implementation target as `tinyrustlm/`, with a no-crate Rust runtime, no JavaScript frameworks, no tokenizer libraries, no inference frameworks, no package-manager runtime, no remote inference API, and no CDN dependency.

## Content decisions

The generated plain PHP site emphasizes:

- the actual runtime architecture rather than generic AI marketing;
- `.slm` as the current model route rather than claiming broad GGUF import;
- deterministic smoke artifacts as runtime proof rather than trained assistant quality;
- ADP1, ASP1, and ALR1 adapter packages as controlled adapter lanes;
- selector registries, module-plan receipts, adapter-family receipts, and assembly receipts as browser route gates;
- model breeding as offline candidate lineage and promotion, not live autonomous replication;
- proof gates and explicit non-claims.

## Site architecture decisions

The theme uses standard plain PHP PHP templates, semantic HTML, custom CSS, and small handwritten JavaScript. It adds Markdown alternates, `llms.txt`, `llms-full.txt`, sitemap output, and a virtual robots.txt filter.

No Bootstrap, jQuery, Tailwind, Popper, external fonts, CDN scripts, or page builders are used.


## Contact and navigation revision

Version 1.0.1 adds a dedicated `/contact-mike-kappel/` page, a footer link labeled “Contact Mike Kappel,” a grouped native top menu, and contact/source notes derived from MikeKappel.com and MJK.tel public contact surfaces.


## Plain PHP rebuild v1.0.5

The WordPress deployment path is superseded. Runtime.MiRust.com now ships as a root-extractable plain PHP site with `/index.php`, `/inc/site.php`, `/data/pages.json`, `/assets/`, `/docs/`, and `/.uai/`. See `/docs/implementation/runtime-mirust-plain-php-rebuild-v1.0.5.md`.
