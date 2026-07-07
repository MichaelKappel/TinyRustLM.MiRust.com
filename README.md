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
- Developer documentation now points to the protected TinyRustLM NuGet SDK distribution in `SLMComposer.com`: public `.slm` validation/inspection, native-backed runtime harness operations, UAIX `.uai` memory/persona package planning and inspection, metadata-bound P2P share/import workflows with local signed-manifest verification, local manifest-piece verification, `.slm` assembly, typed announcement/catalog application and inspection, announcement JSON handoff helpers, receipt sidecars, and receipt-sidecar inspection, .NET wrappers, samples, tests, version-derived PowerShell/Bash package verification with `cargo fmt --all --check` plus `cargo clippy --workspace --all-targets -- -D warnings`, required metadata/search-term/XML documentation package audits, source/debug/generated-output/local-path leakage audits through matching package-audit report schemas, official native-asset release gating, strict four-package publish-set audits for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory`, local Browser feed IDs for `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and controlled `UAIX.Browser.p2pLLM.Conversion`, publish-plan reports with package hash/source/feed/audit-match evidence, SHA256SUMS manifest hash/match evidence, plus non-secret git/CI source provenance, release-readiness reports with top-level package/symbol counts and SHA256SUMS binding fields, release workflow support for scoped API keys plus NuGet.org Trusted Publishing through GitHub OIDC, and SHA256SUMS-bound feed-current/feed-hash verification, without publishing private conversion internals, quantization authoring, adapter, selector, breeding, premium, telemetry, licensing, or training internals.
- `TinyRustLM.Memory` now inspects advanced-persona dimension evidence for `depth_level_0_to_10`, disclosure boundary, source confidence, and non-inference rules, exposes `PersonaDimensions`, `PersonaDimensionsValid`, and `PersonaDimensionWarningCount`, and fails validation when required dimension evidence is missing.
- The TinyRustLM browser UI mirrors `UAIX.Browser.Memory` `FileDeck` evidence for local UAIX memory decks: `local-memory-deck-ui` proves `UAIX memory active`, `FileDeck 62 required / 22 persona / 5 evidence / 6 exports`, `UAIX exports verified`, `persona source evidence bound`, and `uaix_memory=advanced_persona_profile` without Hugging Face or MiniModel network access.
- Package-audit reports now record declared package-file entries and package documentation entries, expose `missing_package_file_count`, and fail when declared README/license files are missing from `.nupkg` contents.
- Package-audit reports also record expected packaged documentation source hashes and fail when packaged README/license/package docs do not byte-match the current `docs/nuget` source files.
- Package-audit reports now enforce the exact source-versioned package set: `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory`; missing or unexpected `TinyRustLM*.nupkg` files fail before publish.
- Package-audit reports also enforce matching `.snupkg` symbol package files; publish-plan evidence records `symbol_package_count` and `symbol_publish_mode=explicit_snupkg_push_after_primary_package`, and the SHA256SUMS manifest is symbol-hash-bound so symbols stay bound to the audited SDK release. NuGet Package Manager generally lists installable `.nupkg` packages; each `.snupkg` is a debug-symbol sidecar verified through the local folder feed, workflow artifacts, `SymbolsPackage`/PDB evidence, SHA256SUMS membership, publish-plan hashes, and feed-hash reports.
- Package-audit reports now enforce NuGet discoverability metadata: package titles, descriptions, tags, release notes, project URL, and repository URL must carry required search terms such as `UAIX.Browser`, `p2pRuntime`, `p2pLLM`, `MiniModel`, `.slm`, `.uai`, `memory`, `ai-memory`, and `persona`.
- The local UAIX Browser folder feed has a dedicated `uaix.browser.nuget.feed_audit.v0` verifier for the five branded package IDs, matching `.snupkg` symbol packages, `SymbolsPackage` metadata, PDB evidence, required search metadata, dependency graph, `SHA256SUMS-UAIX.Browser-<version>.txt`, and local-path leakage checks.
- The Browser package lane has an audited `publish-browser-nuget.ps1` dry run that requires `uaix.browser.nuget.feed_audit.v0`, `SHA256SUMS-UAIX.Browser-<version>.txt`, five `.nupkg` files, and five `.snupkg` files, then writes `uaix-browser-nuget-publish-plan.json` with schema `uaix.browser.nuget.publish_plan.v0`.
- The UAIX Browser feed-current monitor sets `TINYRUSTLM_FEED_PACKAGE_IDS` to the five `UAIX.Browser.*` package IDs, writes `uaix-browser-nuget-feed-current.json`, and can run on schedule with `UAIX_BROWSER_NUGET_MONITOR_VERIFY_CURRENT=true`.
- The branded Browser release workflow `.github/workflows/release-browser-nuget.yml` publishes the five-package lane, gates publication with `audit-browser-nuget-release-readiness.ps1`, writes `uaix-browser-nuget-release-readiness.json` with schema `uaix.browser.nuget.release_readiness.v0`, skips redundant pushes when the feed is already `published_current`, blocks `blocked_remote_hash_mismatch` when an immutable feed version has different bytes, requires `uaix-browser-nuget-feed-current.json` and `uaix-browser-nuget-feed-hashes.json`, and can smoke `UAIX.Browser.p2pLLM.Runtime` plus `UAIX.Browser.p2pRuntime.P2P` through configurable consumer verification. If NuGet.org already lists the declared version with different bytes, bump `VersionPrefix` before publishing corrected Browser packages.
- Package-audit reports also fail if any package's nuspec `id` or `version` differs from its protected filename and the source-declared package version.
- Package-audit reports also enforce the public NuGet dependency graph: `TinyRustLM.Abstractions` has no package dependencies, `TinyRustLM.Core` depends only on same-version `TinyRustLM.Abstractions`, and `TinyRustLM.P2P` plus `TinyRustLM.Memory` depend only on same-version `TinyRustLM.Abstractions` and `TinyRustLM.Core`.
- Package-audit dependency checks also require protected package references to retain `exclude=Build,Analyzers` metadata.
- Package-audit reports also enforce native asset placement: native runtime entries are allowed only in `TinyRustLM.Core`, while `TinyRustLM.Abstractions`, `TinyRustLM.P2P`, and `TinyRustLM.Memory` remain managed API/metadata packages.
- Package-audit reports also allow only the expected Core native filenames: `tinyrustlm_native.dll` for Windows, `libtinyrustlm_native.so` for Linux, and `libtinyrustlm_native.dylib` for macOS.
- Package-audit reports also enforce a narrow package-entry allow-list: NuGet metadata, nuspec, README/license, package docs, `lib/net8.0` DLL/XML outputs, and approved Core native assets.
- Package-audit reports also enforce the public API surface from packaged XML docs, failing if Abstractions/Core/P2P/Memory expose managed members outside the approved SDK contract.
- Post-pack package tests also enforce the binary public surface, failing if exported types, public constructor arity, DTO properties, or declared workflow methods drift outside the approved SDK contract.
- Publish-plan source provenance now records the producing git commit, branch, dirty-tree flag, tracked/untracked change counts, CI provider label, SHA256SUMS manifest hash/match evidence, and non-secret GitHub Actions identifiers while keeping API keys and push tokens out of release evidence.
- The NuGet .NET wrapper and native public runtime SDK validate generation options before runtime mutation: non-positive `MaxNewTokens` / `max_new_tokens`, non-finite or negative `Temperature` / `temperature`, `TopK` / `top_k` outside `1..1024`, and non-finite or out-of-range `TopP` / `top_p` fail before generation work begins. Direct native callers receive an `invalid_generation_options` JSON envelope before runtime-handle lookup or lossy floating-point casts.
- The NuGet .NET wrapper also rejects embedded NUL characters in managed paths, prompts, JSON handoff documents, optional catalog JSON, and P2P share-kit request fields before P/Invoke, preventing native C-string truncation at the public SDK boundary.
- The same bridge preserves empty managed strings as native empty strings instead of null pointers, so empty prompts remain empty prompts while null continues to mean an omitted optional native argument.
- The NuGet .NET P2P wrapper validates `PrepareShareKitRequest` before native JSON serialization: `ModelPath` and `OutputDir` must be present, and `PieceSize` must be omitted or between 1 KiB and 16 MiB while deeper URL, identifier, manifest, and artifact checks remain Rust-owned.
- The NuGet .NET P2P wrapper mirrors Rust JSON byte budgets before P/Invoke: manifests or signed-manifest envelopes over 1 MiB, public-key JSON over 16 KiB, announcements or local import receipts over 256 KiB, and announcement catalogs over 4 MiB fail as managed argument errors before native allocation or parsing.
- NuGet P2P announcement URL validation now accepts HTTPS or explicit-port loopback HTTP only, validates `PublicBaseUrl` directly before writing announcements, and rejects credentials, whitespace, query strings, fragments, backslashes, dot-segment traversal, and encoded traversal before metadata is trusted. Received catalogs deduplicate honest announcement replays but reject conflicting same-peer/same-manifest metadata before mutation; `InspectAnnouncementCatalog` reports catalog SHA/count/byte evidence and rejects catalog JSON above 4 MiB before parsing.
- NuGet P2P signed-manifest verification now exposes `VerifySignedManifest` and `VerifySignedManifestJson` for local `tinyrustlm.p2p_signed_manifest.v0` envelopes against metadata-only `minimodel.public_key.v0` public-key JSON. It checks wrapped manifest validity, canonical payload SHA-256, `external-signature-v0`, `ed25519-base64:` signature bytes, matching publisher/key/route/SHA usage, and `revoked=false`, while signing, key hosting, remote key discovery, transparency-log lookup, and commercial publisher services remain outside the package.
- MiniModel signed-manifest verification now accepts only `signature.kind=external-signature-v0`, rejects comments and unsafe or missing key routes, requires `signature.payload_sha256` to match the canonical sorted non-signature manifest body, and prints the canonical digest from `minimodel verify-manifest` for publisher review. `minimodel verify-signed-manifest <manifest> <public-key-json>` now performs local Ed25519 verification against metadata-only `minimodel.public_key.v0` public-key JSON; transparency-log inclusion and remote key-discovery policy remain future work.
- MiniModel catalog/feed inspection now reports exact metadata byte counts plus SHA-256 values and rejects `models.v0.json` or `peer-source-announcements.v0.json` above 4 MiB before parsing. TinyRustLM browser smoke `hf-peer-announcement-budget-ui` also proves oversized local peer-source announcement/feed files are rejected at the browser metadata budget before JSON parse or peer-source application, while `hf-catalog-announcement-route-budget-ui` proves oversized catalog-declared feed routes report `Peer-source announcement metadata exceeded browser budget`, stay at `Set Peer URL`, and save no peer import kit.
- Publication status as of 2026-07-07: the protected source-level `TinyRustLM.Abstractions`, `TinyRustLM.Core`, `TinyRustLM.P2P`, and `TinyRustLM.Memory` lane is verified locally at source version `0.1.6`; public NuGet.org availability is currently carried by the branded `UAIX.Browser.Core.Abstractions`, `UAIX.Browser.p2pLLM.Runtime`, `UAIX.Browser.p2pRuntime.P2P`, `UAIX.Browser.Memory`, and `UAIX.Browser.p2pLLM.Conversion` package IDs, all published and post-publish verified at version `0.1.6` with matching `.snupkg` symbol sidecars and SHA256SUMS-bound feed-hash evidence.
- Current local release-gate evidence for 2026-07-06 is green for `cargo fmt --all --check`, `cargo clippy --workspace --all-targets -- -D warnings`, `cargo test --workspace`, and `eng\verify-package.ps1`; the package verifier itself now runs workspace rustfmt and clippy before Rust tests, rebuilt the native bridge, ran Rust/.NET tests, packed the four protected packages, wrote the package audit with required search-term evidence, and passed clean consumer `.slm` runtime plus UAIX memory/persona and P2P share/import/receipt smoke from local package references.
- TinyRustLM UI verification now writes `tinyrustlm.ui_verification.v0` evidence through `eng\verify-tinyrustlm-ui.ps1 -RunBrowserSmoke` and its Bash parity script; CI runs the static browser harness, loopback HTTP harness, and `source-options-ui`, `local-memory-deck-ui`, `local-connect-approval-ui`, `local-connect-endpoint-ui`, and `local-connect-rust-endpoint-ui` browser smokes for Local .slm, UAIX memory FileDeck evidence, Hugging Face, P2P import, Advanced tools, Local Connect approval presets, endpoint app inventory, digest-bound dry-run action flow, and the actual Rust `serve-approval-endpoint` path.
- TinyRustLM.com root verification writes `tinyrustlm.public_root_verification.v0` evidence through `eng\verify-tinyrustlm-public-root.ps1` and `eng/verify-tinyrustlm-public-root.sh`; it serves mapped `http://tinyrustlm.com:<port>/` with `tinyrustlm.com-loopback-browser-smoke`, runs `public-local-only`, `catalog-local-import`, `local-import-ambiguous-selection`, `peer-url-unsafe-ui`, `local-memory-deck-ui`, `local-connect-approval-ui`, `local-connect-endpoint-ui`, and `local-connect-rust-endpoint-ui`, and writes `tinyrustlm-public-root-verification.json`.
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
