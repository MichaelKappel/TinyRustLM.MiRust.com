# TinyRustLM Long-Term Memory

Current P2P UI note: TinyRustLM now supports MiniModel peer contact books beside single peer contact cards. The browser validates `minimodel.peer_contact_book.v0` metadata, embedded card SHA-256s, duplicate peer rejection, and no-byte/no-catalog-claim boundaries before rendering the reviewed peers as a chooser and using the selected peer as Known peer; `hf-peer-contact-book-ui` and `hf-peer-contact-book-reject-ui` cover the browser path.

Current peer readiness note: TinyRustLM now supports local `minimodel.peer_status_check` report import beside receipt-ledger and companion-inventory metadata. The browser validates `minimodel check-peer-status` output as metadata-only, rejects peer-piece/artifact byte-transfer claims, and shows peer URL, piece count, artifact size, companion route, report SHA-256, and `Rust reverify required`; generated receiver scripts revalidate saved reports with MiniModel `inspect-peer-status-check`, and `peer-status-check-ui` covers the browser path.

Current NuGet SDK note: SLMComposer.com carries the protected TinyRustLM NuGet SDK source for `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P`, exposing only `.slm` validation/inspection, native-backed runtime harness operations, metadata-bound P2P share/import workflows, typed announcement/catalog application and inspection, announcement JSON handoff helpers, and .NET wrappers while keeping conversion, quantization authoring, adapter/selector/breeding/premium/telemetry/licensing/training internals private. The .NET wrapper and native public runtime SDK validate generation options before runtime mutation: non-positive `MaxNewTokens` / `max_new_tokens`, non-finite or negative `Temperature` / `temperature`, `TopK` / `top_k` outside `1..1024`, and non-finite or out-of-range `TopP` / `top_p` fail before generation work begins; direct native callers receive an `invalid_generation_options` JSON envelope before runtime-handle lookup or lossy floating-point casts. The .NET wrapper also rejects embedded NUL characters in paths, prompts, JSON handoff documents, optional catalog JSON, and P2P share-kit request fields before P/Invoke, preventing native C-string truncation, preserves empty managed strings as native empty strings rather than null pointers, validates `PrepareShareKitRequest` before native JSON serialization, rejecting missing model/output paths and piece sizes outside 1 KiB through 16 MiB while Rust keeps deeper URL, identifier, manifest, and artifact validation, and mirrors Rust P2P JSON byte budgets before native calls for manifests, announcements, receipts, and announcement catalogs. As of 2026-07-06, local package-folder feed-current and package-hash verification pass for version `0.1.1`, the release-readiness audit writes `tinyrustlm-nuget-release-readiness.json` with non-secret auth-mode/API-key/Trusted-Publishing evidence, NuGet.org reports zero listed versions, and the current API-key-mode readiness status is `blocked_missing_api_key`; public NuGet.org availability remains incomplete until authenticated publish plus feed-current and feed-hash verification passes.

Current NuGet package-audit note: package-audit reports now record declared package-file entries and package documentation entries, expose `missing_package_file_count`, and fail when declared README/license files are missing from `.nupkg` contents.

Current NuGet package-documentation audit note: package-audit reports now list expected package documentation entries with source/package SHA-256 values and fail when packaged README/license/package docs do not byte-match the current `docs/nuget` source files.

Current NuGet exact package-set audit note: package-audit reports now list expected source-versioned package names plus missing/unexpected package entries and fail if `artifacts/packages` contains anything except `TinyRustLM.Abstractions`, `TinyRustLM.Core`, and `TinyRustLM.P2P` at the source-declared version.

Current NuGet package-identity audit note: package-audit reports now record expected package ID/version for each protected `.nupkg` and fail if nuspec `id` or `version` differs from the protected filename and source-declared package version.

Current NuGet dependency-audit note: package-audit reports now enforce the public dependency graph. Abstractions has no package dependencies, Core depends only on same-version Abstractions, and P2P depends only on same-version Abstractions and Core.

Current NuGet dependency-metadata audit note: package-audit expected dependency entries now include `exclude=Build,Analyzers`, and missing/unexpected dependency checks fail if protected package references drift from that metadata policy.

Current NuGet native-placement audit note: package-audit reports now enforce native asset placement. Native runtime entries are allowed only in TinyRustLM.Core, while TinyRustLM.Abstractions and TinyRustLM.P2P remain managed API/metadata packages.

Current NuGet native-filename audit note: package-audit reports now record `allowed_native_entries` and fail if TinyRustLM.Core carries native files outside the approved RID/native filename set: Windows `tinyrustlm_native.dll`, Linux `libtinyrustlm_native.so`, and macOS `libtinyrustlm_native.dylib`.

Current NuGet package-entry allow-list audit note: package-audit reports now record `package_entry_names`, `allowed_package_entry_patterns`, and `unexpected_package_content_entries`, and fail if protected `.nupkg` contents drift outside NuGet metadata, nuspec, README/license, package docs, `lib/net8.0` DLL/XML outputs, or approved Core native assets.

Current NuGet P2P URL/catalog note: the public SDK validates `PublicBaseUrl` directly before writing announcements. Announcement manifest URLs accept HTTPS or explicit-port loopback HTTP only and reject credentials, whitespace, query strings, fragments, backslashes, dot-segment traversal, and encoded traversal before metadata is trusted. Received catalogs deduplicate honest announcement replays but reject conflicting same-peer/same-manifest metadata before mutation. `InspectAnnouncementCatalog` reports catalog SHA/count/byte evidence and rejects catalog JSON above 4 MiB before parsing.

Current MiniModel manifest verifier note: signed manifests now fail closed unless `signature.kind=external-signature-v0`, comments are absent, `signature.key_id` is present, `signature.public_key_route` is safe, and `signature.payload_sha256` equals the canonical sorted non-signature manifest body digest printed by `minimodel verify-manifest`. This is a payload-integrity rule; cryptographic key-policy and transparency-log trust are still future work.

Current MiniModel catalog/feed budget note: `inspect-catalog-snapshot`, `inspect-peer-source-announcement-feed`, and feed-bound catalog writing report exact metadata byte counts plus SHA-256 values and reject catalog/feed JSON above 4 MiB before parsing; generated TinyRustLM conversion/share kits already run those inspectors before sharing or loading metadata. TinyRustLM mapped public-root smoke `hf-peer-announcement-budget-ui` also proves oversized local peer-source announcement/feed files fail at the browser metadata budget before JSON parse or peer-source application while the proof-ready row remains at `Set Peer URL`, and `hf-catalog-announcement-route-budget-ui` proves oversized catalog-declared feed routes report `Peer-source announcement metadata exceeded browser budget`, stay at `Set Peer URL`, and save no peer import kit.

Current Local Connect note: `tinyrustlm-local-connect serve-approval-endpoint` revalidates its watched approval-policy JSON before each request, applies valid saved-policy replacements without restart, and fails closed with `policy-reload-failed` when the watched policy is missing or invalid. The browser copy now tells users to save the endpoint policy JSON over that watched file when changing approved app/category rules.

> Durable project memory for TinyRustLM plain PHP site package 1.5.4. This file is the body memory target for `.uai/long-term-memory.uai`; the `.uai` file stays pointer-first and routes agents here for full context.

## Current truth boundary

TinyRustLM is presented as a browser-local Rust/WebAssembly small language model runtime project, not as a cloud assistant, hosted chatbot, WordPress theme, generic Rust site, or GGUF runtime claim. TinyRustLM.MiRust.com is now the developer portal for the runtime, including the legacy runtime documentation archive under `/docs/runtime-portal/`. The public site explains the current architecture and its proof surfaces: custom `.slm` artifacts, f32/q8_0/q4_0 quantization, deterministic validation, ADP1/ASP1/ALR1 adapter sidecars, selector registries, module-plan receipts, local-only browser diagnostics, live public smoke proof using real DNS with only app/runtime requests before user action, Hugging Face metadata search with shared simple/advanced source-row actions, local-only `.safetensors` source-file hints, paired `minimodel.huggingface_conversion_request.v0` plus self-contained script downloads that embed/recreate the request sidecar, one-command `convert-huggingface-request` local conversion receipt flow, generated local `.minimodel-serve-peer-pieces.ps1` helpers that re-inspect companion state with MiniModel `inspect-peer-companion-state` before `serve-peer-companion` when companion state exists and support path-prefixed peer base URLs, generated `peer-source-announcements.v0.json`, feed-bound `models.with-announcement-feed.v0.json`, strict browser validation of checksum-bound feed envelopes, duplicate model/peer rows, and peer-offer route/checksum/chunk-count/Merkle identity, metadata-only `write-peer-companion-state` handoff JSON and metadata-only `write-peer-contact-card` URL handoff JSON with executed conversion-kit smoke coverage, `converted-once-p2p-publish.README.txt`, P2P-on-by-default source actions, local peer contact card loading that sets Known peer URL only after validating no-project-server and Rust-reverify flags, `P2P Import` for MiniModel matches whose catalog entries carry admitted manifests plus complete `.minimodel-peer-offer` proof and have either a catalog-listed `peer_sources` row or a list-level Known peer URL, `Set Peer URL` fallback for proof-ready rows without a known source, one-command `prepare-peer-share` sender execution, `add-peer-source` late direct peer-source publication, `write-peer-source-announcement` portable peer availability metadata, `write-peer-source-announcement-feed` availability feeds, `write-catalog-snapshot-with-announcement-feed` feed-bound snapshots, maintainer-side `apply-peer-source-announcements` drift checks, batch `write-catalog-snapshot-with-announcements` publication, metadata-only `write-catalog-snapshot` reuse, local `models.v0.json` loading before Hugging Face search, self-locating `check-peer-status`/`inspect-peer-status-check`/preflight/`import-peer-request` receiver execution that validates peer-status metadata, saved status-check JSON, and advertised companion state when present, resolves `MINIMODEL_WORKSPACE`, keeps request/manifest/status/preflight/output files beside the script, and writes final peer-transfer receipt evidence, `Start Conversion` fallback, known-peer MiniModel `serve-peer-companion` / `serve-peer-pieces` / companion-state-aware `fetch-peer-pieces` transfer handoffs, local MiniModel share metadata plus `.minimodel-share-kit.ps1` and `.minimodel-serve-peer-pieces.ps1` exports after verified `.slm` import, and a later optional user-run MiniModel Peer Companion for local peer identity, local piece stores, consent prompts, cache quotas, serve/fetch controls, receipts, and TinyRustLM handoff without project-hosted model bytes.

## Site implementation memory

- Current package version: `1.5.4`.
- Site type: plain PHP 8, no WordPress, no database, no Composer, no npm.
- Frontend: custom CSS and small vanilla JavaScript only.
- Public routes: `/`, `/architecture/`, `/runtime/`, `/slm-format/`, `/quantization/`, `/browser-runtime/`, `/adapters/`, `/model-breeding/`, `/testing/`, `/developer-portal/`, `/roadmap/`, `/glossary/`, `/docs/`, and `/contact/`.
- Machine routes: `/llms.txt`, `/llms-full.txt`, `/robots.txt`, `/sitemap.xml`, plus Markdown negotiation via `?format=md` or `Accept: text/markdown` on PHP-rendered pages.
- Durable docs: `/docs/`, `/docs/report-index.md`, `/docs/long-term-memory.md`, `/docs/reports/*`, and `/docs/runtime-portal/*`.

## Runtime documentation consolidation memory

The former standalone runtime documentation lane is retired as a separate documentation authority. Its public implementation corpus was preserved under `/docs/runtime-portal/` with a checksum-bearing manifest at `/docs/runtime-portal/MANIFEST.md` and a current archive index at `/docs/runtime-portal/index.md`. The preserved archive includes the former runtime page registry, implementation docs, reports, source-memory notes, web-research notes, dogfood notes, package metadata, llms exports, sitemap, version marker, and health marker.

Use `/developer-portal/` as the current human-readable route for TinyRustLM developer evidence. Use `https://TinyRustLM.com/` as the current public app route. SLMComposer.com is no longer the canonical public app identity.

## Technical memory

TinyRustLM should be described through concrete engineering surfaces:

1. **Runtime** � Rust owns `.slm` parsing, tokenizer behavior, tensor validation, quantization math, KV cache state, sampling, generation, diagnostics, error codes, adapter validation, and adapter application.
2. **Browser shell** � JavaScript owns local file fetches, manifest checks, byte transfer into WASM memory, controls, transcript rendering, and diagnostics display. It must not parse tensor payloads or make model-quality claims.
3. **Artifact format** � `.slm` is the custom local model artifact, with strict header, tensor directory, tokenizer metadata, quantization fields, dimension checks, checksums, and bounded runtime state.
4. **Memory envelope** � public copy should keep the 33,554,432-byte selector model budget visible because it explains vocabulary pressure, q8/q4 tradeoffs, scratch buffers, adapter stack limits, and browser viability.
5. **Adapters** � ADP1, ASP1, and ALR1 are validated sidecars. They are not replacement models and are not applied until Rust validates shape, identity, checksums, tokenizer agreement, tensor layout, and finite payload values.
6. **Model breeding** � model breeding is offline and receipt-bound. Operators can produce candidates, sparse/low-rank sidecars, and evidence records, but public assistant-quality claims require additional runtime-smoke and evaluation sidecars.

## Public copy boundaries

- Do not claim trained assistant quality unless an evaluation sidecar with passed cases exists.
- Claim GGUF support only as the current local Rust conversion path to `.slm` with specific smoke evidence; do not claim broad direct browser GGUF runtime import.
- Do not describe the project as WordPress; this package is plain PHP.
- Do not introduce Bootstrap, jQuery, Tailwind, React, Vue, Composer, npm, CDN dependencies, analytics, telemetry, remote inference APIs, or external model downloads by default.
- Keep TinyRustLM centered on local agency, deterministic proof, inspectable artifacts, and constrained browser execution.

## Report memory index

| Durable report | Source file | Type | SHA-256 |
|---|---:|---|---|
| [Engineering Tiny Language Models for Deterministic WebAssembly and Rust Runtimes](/docs/reports/tiny-language-models-for-wasm.md) | `Tiny Language Models for WASM.md` | report | `B823A12562F6DB288C6B16A38A6A9A8C6DD2AF8C02F783BBF34E3C54836FF6FB` |
| [Architecting Minimalist Neural Inference in WebAssembly](/docs/reports/rust-wasm-neural-model-patterns.md) | `Rust WASM Neural Model Patterns.md` | report | `53E988FBCDD51A06A6155A8293CA85113543F20D9F78AF52EE50997B23E5F618` |
| [Architecture and Engineering of TinyRustLM](/docs/reports/understanding-tinyrustlm-creation-and-purpose.md) | `Understanding TinyRustLM_ Creation and Purpose.md` | report | `69A94B184F4876B293EF268F22DF5DB63F1DFF5413AFEF03F7A9C6BAB397440D` |
| [Tiny Language Models for Rust/WASM](/docs/reports/tiny-language-models-for-rust-wasm.md) | `Tiny Language Models for Rust_WASM.md` | report | `37D6B47ED4284F65C591921F653F3AA4E17672593AE84C09C84E4222FC808AE9` |
| [GGUF MiRust All Source Review Bundle](/docs/reports/gguf-mirust-all-source-review-bundle.txt) | `GGUF_MiRust_All_Source_Review_Bundle(1).txt` | source-review-bundle | `2B2D72AC23F1D63919C0B744E9586C8AE73C45B26891E8F698DAD1417E8DE931` |
| [Memory Systems Domains Research](/docs/reports/memory-systems-domains-research.md) | `Memory Systems Domains Research(2).md` | report | `B400312F9FEB5F5D5D2BF0C77B221B925B7AC091BC618E1B6964D38885D8C9B9` |
| [Future-Proof Native HTML5 Techniques](/docs/reports/future-proof-native-html5-techniques.md) | `Future-Proof Native HTML5 Techniques(3).md` | report | `A152A89B4575DDB990DDB5300DAE0AC44BC424ABDED40C9ADB7CA87045461879` |
| [Future-Proof JavaScript Without Dependencies](/docs/reports/vanilla-js-future-proof-techniques.md) | `Vanilla JS Future-Proof Techniques(3).md` | report | `5BCC36711C08D1072C857B01E025D7FFF946615349BDEEB340E70FA8677F92B3` |
| [Innovative Vanilla Web Design](/docs/reports/innovative-vanilla-web-design.md) | `Innovative Vanilla Web Design(3).md` | report | `FE68269F39258FA1E3BFECB7F78C153F4CA24C0F08432D3F193F91087B12122C` |
| [Agent-Native Vanilla Web Architecture](/docs/reports/mememtech-vanilla-web-architecture.md) | `Mememtech Vanilla Web Architecture(3).md` | report | `4E3ACAA0D568C201C56E8F74E0016004743D04E553B9AEC8E83152E0F8B4E47A` |
| [Analyzing Website Virality](/docs/reports/analyzing-website-virality.md) | `Analyzing Website Virality(3).md` | report | `5CDB3C8C9FA714AF0C44B48EC58B3C885846D5C8D7B1E5DDE869442B83DA95EF` |

## Next recursive direction

Continue by improving the docs surface and public evidence flow without widening claims. Good next work: add a public support matrix, add code snippets that mirror current source behavior, add downloadable checksums for source evidence, add a `/docs/proof/` page, and keep `.uai/long-term-memory.uai` synchronized whenever reports or source boundaries change.
