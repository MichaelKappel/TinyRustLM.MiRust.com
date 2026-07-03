# TinyRustLM Long-Term Memory

> Durable project memory for TinyRustLM plain PHP site package 1.5.4. This file is the body memory target for `.uai/long-term-memory.uai`; the `.uai` file stays pointer-first and routes agents here for full context.

## Current truth boundary

TinyRustLM is presented as a browser-local Rust/WebAssembly small language model runtime project, not as a cloud assistant, hosted chatbot, WordPress theme, generic Rust site, or GGUF runtime claim. TinyRustLM.MiRust.com is now the developer portal for the runtime, including the legacy runtime documentation archive under `/docs/runtime-portal/`. The public site explains the current architecture and its proof surfaces: custom `.slm` artifacts, f32/q8_0/q4_0 quantization, deterministic validation, ADP1/ASP1/ALR1 adapter sidecars, selector registries, module-plan receipts, local-only browser diagnostics, Hugging Face metadata search with shared simple/advanced source-row actions, local-only `.safetensors` source-file hints, paired `minimodel.huggingface_conversion_request.v0` plus self-contained script downloads that embed/recreate the request sidecar, one-command `convert-huggingface-request` local conversion receipt flow, generated local `.minimodel-serve-peer-pieces.ps1` helpers for explicit sender serving consent, generated `peer-source-announcements.v0.json`, feed-bound `models.with-announcement-feed.v0.json`, `converted-once-p2p-publish.README.txt`, P2P-on-by-default source actions, `P2P Import` for MiniModel matches whose catalog entries carry admitted manifests plus `.minimodel-peer-offer` proof and have either a catalog-listed `peer_sources` row or a list-level Known peer URL, `Set Peer URL` fallback for proof-ready rows without a known source, one-command `prepare-peer-share` sender execution, `add-peer-source` late direct peer-source publication, `write-peer-source-announcement` portable peer availability metadata, `write-peer-source-announcement-feed` availability feeds, `write-catalog-snapshot-with-announcement-feed` feed-bound snapshots, maintainer-side `apply-peer-source-announcements` drift checks, batch `write-catalog-snapshot-with-announcements` publication, metadata-only `write-catalog-snapshot` reuse, local `models.v0.json` loading before Hugging Face search, self-locating one-command `import-peer-request` receiver execution that resolves `MINIMODEL_WORKSPACE` and keeps request/manifest/output files beside the script, `Start Conversion` fallback, known-peer MiniModel `serve-peer-pieces` / `fetch-peer-pieces` transfer handoffs, local MiniModel share metadata plus `.minimodel-share-kit.ps1` and `.minimodel-serve-peer-pieces.ps1` exports after verified `.slm` import, and a later optional user-run MiniModel Peer Companion for local peer identity, local piece stores, consent prompts, cache quotas, serve/fetch controls, receipts, and TinyRustLM handoff without project-hosted model bytes.

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

1. **Runtime** — Rust owns `.slm` parsing, tokenizer behavior, tensor validation, quantization math, KV cache state, sampling, generation, diagnostics, error codes, adapter validation, and adapter application.
2. **Browser shell** — JavaScript owns local file fetches, manifest checks, byte transfer into WASM memory, controls, transcript rendering, and diagnostics display. It must not parse tensor payloads or make model-quality claims.
3. **Artifact format** — `.slm` is the custom local model artifact, with strict header, tensor directory, tokenizer metadata, quantization fields, dimension checks, checksums, and bounded runtime state.
4. **Memory envelope** — public copy should keep the 33,554,432-byte selector model budget visible because it explains vocabulary pressure, q8/q4 tradeoffs, scratch buffers, adapter stack limits, and browser viability.
5. **Adapters** — ADP1, ASP1, and ALR1 are validated sidecars. They are not replacement models and are not applied until Rust validates shape, identity, checksums, tokenizer agreement, tensor layout, and finite payload values.
6. **Model breeding** — model breeding is offline and receipt-bound. Operators can produce candidates, sparse/low-rank sidecars, and evidence records, but public assistant-quality claims require additional runtime-smoke and evaluation sidecars.

## Public copy boundaries

- Do not claim trained assistant quality unless an evaluation sidecar with passed cases exists.
- Do not claim GGUF import support as a TinyRustLM feature unless a specific conversion path and smoke evidence are added.
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
