# TinyRustLM Plain PHP Site v1.3.0

This package is a plain PHP project website for `https://TinyRustLM.mirust.com/`.
It is not a WordPress theme and does not require WordPress.

## Requirements

- PHP 8.0 or newer
- Apache with `.htaccess` rewrite support, or equivalent Nginx rewrites to `index.php`
- No Composer install required
- No npm install required
- No database required
- No Bootstrap, jQuery, Tailwind, React, Vue, CDN assets, or page builder

## Deploy

1. Upload all files in this folder to the TinyRustLM subdomain document root.
2. Ensure `index.php`, `data/`, `includes/`, `assets/`, `docs/`, `.uai/`, `agent-file-handoff/`, `.htaccess`, `llms.txt`, `llms-full.txt`, `robots.txt`, and `sitemap.xml` are at the web root.
3. Preserve dotfiles when uploading or unzipping. The `.uai/` folder and `.htaccess` are intentional.
4. Point clean routes to `index.php` and verify `/docs/`, `/contact/`, `/llms.txt`, and `/sitemap.xml`.

## v1.3.0 changes

- Added `/docs/` as a first-class docs and UAI-memory surface.
- Developer documentation now points to the protected TinyRustLM NuGet SDK distribution in `SLMComposer.com`: public `.slm` validation/inspection, native-backed runtime harness operations, metadata-bound P2P share/import workflows with local manifest-piece verification, `.slm` assembly, typed announcement/catalog application and inspection, announcement JSON handoff helpers, receipt sidecars, and receipt-sidecar inspection, .NET wrappers, samples, tests, version-derived PowerShell/Bash package verification, required metadata/XML documentation package audits, source/debug/generated-output/local-path leakage audits through matching package-audit report schemas, official `win-x64`/`linux-x64`/`osx-x64`/`osx-arm64` native-asset release gating, strict three-package publish-set audits that reject stale or unintended extra `TinyRustLM*.nupkg` files and require package hashes/sizes to match the package-audit report, publish-plan reports with package hash/source/feed/audit-match evidence, redacted push-failure evidence, and no secret material, release-readiness reports with local gate status, target-feed status, blockers, next actions, auth mode, and non-secret API-key/Trusted-Publishing evidence, release workflow support for scoped API keys plus NuGet.org Trusted Publishing through GitHub OIDC, push-skip behavior when readiness is already `published_current`, mandatory release-workflow feed-current plus feed package-hash verification after publish/current-feed proof, optional post-publish clean consumer feed smoke, and manual plus opt-in scheduled feed-current checks with optional clean consumer smoke and optional retained-publish-plan package-byte checks, without publishing private conversion, quantization authoring, adapter, selector, breeding, premium, telemetry, licensing, or training internals.
- Package-audit reports now record declared package-file entries and package documentation entries, expose `missing_package_file_count`, and fail when declared README/license files are missing from `.nupkg` contents.
- Package-audit reports also record expected packaged documentation source hashes and fail when packaged README/license/package docs do not byte-match the current `docs/nuget` source files.
- Package-audit reports now enforce the exact source-versioned package set: `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`; missing or unexpected `TinyRustLM*.nupkg` files fail before publish.
- Package-audit reports also fail if any package's nuspec `id` or `version` differs from its protected filename and the source-declared package version.
- Package-audit reports also enforce the public NuGet dependency graph: `TinyRustLM.Abstractions` has no package dependencies, `TinyRustLM.Core` depends only on same-version `TinyRustLM.Abstractions`, and `TinyRustLM.P2P` depends only on same-version `TinyRustLM.Abstractions` and `TinyRustLM.Core`.
- Package-audit dependency checks also require protected package references to retain `exclude=Build,Analyzers` metadata.
- Package-audit reports also enforce native asset placement: native runtime entries are allowed only in `TinyRustLM.Core`, while `TinyRustLM.Abstractions` and `TinyRustLM.P2P` remain managed API/metadata packages.
- Package-audit reports also allow only the expected Core native filenames: `tinyrustlm_native.dll` for Windows, `libtinyrustlm_native.so` for Linux, and `libtinyrustlm_native.dylib` for macOS.
- Package-audit reports also enforce a narrow package-entry allow-list: NuGet metadata, nuspec, README/license, package docs, `lib/net8.0` DLL/XML outputs, and approved Core native assets.
- The NuGet .NET wrapper and native public runtime SDK validate generation options before runtime mutation: non-positive `MaxNewTokens` / `max_new_tokens`, non-finite or negative `Temperature` / `temperature`, `TopK` / `top_k` outside `1..1024`, and non-finite or out-of-range `TopP` / `top_p` fail before generation work begins. Direct native callers receive an `invalid_generation_options` JSON envelope before runtime-handle lookup or lossy floating-point casts.
- The NuGet .NET wrapper also rejects embedded NUL characters in managed paths, prompts, JSON handoff documents, optional catalog JSON, and P2P share-kit request fields before P/Invoke, preventing native C-string truncation at the public SDK boundary.
- The same bridge preserves empty managed strings as native empty strings instead of null pointers, so empty prompts remain empty prompts while null continues to mean an omitted optional native argument.
- The NuGet .NET P2P wrapper validates `PrepareShareKitRequest` before native JSON serialization: `ModelPath` and `OutputDir` must be present, and `PieceSize` must be omitted or between 1 KiB and 16 MiB while deeper URL, identifier, manifest, and artifact checks remain Rust-owned.
- The NuGet .NET P2P wrapper mirrors Rust JSON byte budgets before P/Invoke: manifests over 1 MiB, announcements or local import receipts over 256 KiB, and announcement catalogs over 4 MiB fail as managed argument errors before native allocation or parsing.
- NuGet P2P announcement URL validation now accepts HTTPS or explicit-port loopback HTTP only, validates `PublicBaseUrl` directly before writing announcements, and rejects credentials, whitespace, query strings, fragments, backslashes, dot-segment traversal, and encoded traversal before metadata is trusted. Received catalogs deduplicate honest announcement replays but reject conflicting same-peer/same-manifest metadata before mutation; `InspectAnnouncementCatalog` reports catalog SHA/count/byte evidence and rejects catalog JSON above 4 MiB before parsing.
- MiniModel signed-manifest verification now accepts only `signature.kind=external-signature-v0`, rejects comments and unsafe or missing key routes, requires `signature.payload_sha256` to match the canonical sorted non-signature manifest body, and prints the canonical digest from `minimodel verify-manifest` for publisher review; full cryptographic key policy remains future work.
- MiniModel catalog/feed inspection now reports exact metadata byte counts plus SHA-256 values and rejects `models.v0.json` or `peer-source-announcements.v0.json` above 4 MiB before parsing. TinyRustLM browser smoke `hf-peer-announcement-budget-ui` also proves oversized local peer-source announcement/feed files are rejected at the browser metadata budget before JSON parse or peer-source application, while `hf-catalog-announcement-route-budget-ui` proves oversized catalog-declared feed routes report `Peer-source announcement metadata exceeded browser budget`, stay at `Set Peer URL`, and save no peer import kit.
- Publication status as of 2026-07-06: local package-folder verification passes for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P` version `0.1.1`, but NuGet.org reports zero listed versions for those package IDs and the current release-readiness report is `blocked_missing_api_key`. Public NuGet.org availability remains incomplete until authenticated publish plus feed-current and feed-hash verification passes.
- Added `docs/long-term-memory.md` as durable long-term body memory.
- Added `docs/report-index.md` as the preserved report manifest.
- Copied all attached reports into `docs/reports/` with stable filenames and SHA-256 checksums.
- Added `.uai/` file-memory suite: index, system profile, startup packet, receiver brief, context, constraints, architecture, coding standards, operations, test plan, progress, decisions, memory, short-term memory, long-term pointer ledger, file handoff, intake ledger, and next recursive prompt.
- Added `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/` placeholder intake buckets.
- Added top-menu `Docs + Memory` group with deep links to docs and .uai memory.
- Updated `llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`, and footer machine-readable links.

## v1.2.0 carried forward

- `/contact/` remains a first-class route.
- Footer heading and link remains exactly: `Contact Mike Kappel`.
- Direct contact actions remain available for email, phone, contact hub, LinkedIn, GitHub, and NuGet.
- Top menu remains grouped and accessible without third-party JavaScript.

## Content model

- `data/site.php`: global metadata, grouped navigation, and contact metadata.
- `data/pages.php`: primary public page content.
- `docs/index.php`: documentation landing page.
- `docs/long-term-memory.md`: durable body memory.
- `docs/report-index.md`: report manifest and checksums.
- `docs/reports/*`: preserved full report bodies.
- `.uai/*.uai`: compact agent file-memory records.
- `includes/functions.php`: routing, navigation helpers, links, and Markdown negotiation.
- `includes/header.php` and `includes/footer.php`: shared layout.
- `assets/css/site.css`: custom CSS only.
- `assets/js/site.js`: mobile menu and disclosure-menu behavior only.

## Agent-readable files

- `/llms.txt`: compact agent index.
- `/llms-full.txt`: bundled text content for key pages and memory index.
- `/docs/`: report archive and memory read order.
- `/.uai/index.uai`: UAI memory read order.
- `/.uai/long-term-memory.uai`: semantic pointer ledger into `/docs`.
- Any PHP-rendered page can also return Markdown with `?format=md` or an `Accept: text/markdown` request.
