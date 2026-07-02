# TinyRustLM

TinyRustLM is the zero-dependency client-side SLM runtime for Runtime.MiRust.com.

The app target is a static browser UI plus a Rust-compiled WASM runtime that loads a local `.slm` model file, validates it, tokenizes prompts, and runs local inference without remote APIs or third-party runtime libraries.

## Current Milestone

Implemented source slice:

- Static browser shell in `app/`.
- Handwritten JavaScript WASM/model loader.
- Rust runtime crate with no dependencies.
- Raw WASM exports for allocation, model load, adapter validation, adapter apply, prompt transfer, generation boundary, diagnostics, context reset, and model free.
- Byte tokenizer, `.slm` parser, tensor views, math ops, q8/q4 helpers, RoPE, KV cache, sampler, and diagnostics source.
- No-crate `slm_pack` source for generating a tiny fixture `.slm`.
- Generated `runtime/tinyrustlm.wasm`.
- Generated `models/tiny-test-model.slm`.
- Generated `models/tiny-test-model-q8.slm` and `models/tiny-test-model-q4.slm`.
- Generated `models/tiny-test-model-bpe.slm` custom BPE fixture.
- Generated `models/tiny-test-model-tied.slm` tied-output fixture.
- Generated `models/tinylm16-f32.slm`.
- Generated `models/tinylm16-q8.slm`.
- Generated `models/tinylm16-q4.slm`.
- Generated `models/tiny-test-model-self.adp1`, `models/tiny-test-model-q8-self.adp1`, and `models/tiny-test-model-q4-self.adp1` plus manifests for the checked browser adapter sidecar routes.
- Checksum-bearing `.slm` artifacts; the runtime rejects zero or mismatched checksums before tensor decoding.
- Provenance `.slm.manifest` sidecars for every local model artifact, with deterministic-smoke status and explicit trained-quality non-claim.
- Browser model provenance panel that fetches the selected local `.slm.manifest` after Rust accepts the model and renders source kind, admission status, quality claim, trained-quality claim, checksum, and required next gate.
- Browser decoding controls for temperature, top-k, top-p, and deterministic seed, defaulting to greedy decoding for repeatable smoke tests.
- Packer-side `runtime-smoke`, `eval-template`, and `quality-gate` commands that separate runtime execution proof from future assistant-quality admission.
- Packer-side `compatibility` command that emits line-based parent-set reports for offline model-breeding and assembly work.
- Packer-side `lineage-template` and `validate-lineage` commands that bind planned candidates to a passing parent compatibility report before an operator writes an artifact.
- Packer-side `blend-candidate` / `validate-blend-candidate`, `delta-candidate` / `validate-delta-candidate`, `sparse-delta-candidate` / `validate-sparse-delta-candidate`, and `dare-candidate` / `validate-dare-candidate` commands that run direct-parameter weighted-average, task-delta, sparse task-delta, and DARE-style dropout/rescaled task-delta operators while binding recomputable receipts, including sparse mask and dropout mask metadata, to produced `.slm` artifacts.
- Packer-side `adapter-delta` / `validate-adapter-delta`, `sparse-adapter-delta` / `validate-sparse-adapter-delta`, and `low-rank-adapter-delta` / `validate-low-rank-adapter-delta` commands that write lineage-bound raw ADP1, sparse ASP1, or low-rank ALR1 f32 task-delta adapter packages plus recomputable manifests.
- Packer-side `adapter-source-template` and `validate-adapter-source` commands that write and validate reviewed trained low-rank adapter source bundles, plus `convert-adapter-source` and `validate-converted-adapter-source` commands that package those reviewed f32 factors into runtime ALR1 artifacts.
- Packer-side `fuse-adapter-delta` and `validate-fuse-adapter-delta` commands that validate raw adapter packages and manifests, fuse them into normal `.slm` candidates, and bind recomputable adapter-fuse receipts.
- Runtime-side f32/q8_0/q4_0 `ADP1`, `ASP1`, and `ALR1` adapter apply for already-loaded compatible models, with package identity validation, compact q8/q4 re-quantization, and generation/KV state reset after successful apply.
- Browser Adapter Sidecar panel for the checked tiny f32/q8_0/q4_0 self-ADP1 routes, checking the local ADP1 artifact checksum before copying bytes into WASM and calling `apply_adapter_delta` without JavaScript parsing the package.
- Packer-side `candidate-manifest` and `validate-candidate` commands that bind a validated candidate lineage to a validated `.slm` artifact before eval or promotion.
- Packer-side `promotion-template` and `validate-promotion` commands that bind a candidate artifact manifest to pending runtime-smoke and eval proof before browser selector admission.
- Packer-side `admission-record` and `validate-admission` commands that bind promotion, runtime-smoke sidecar, and passed eval sidecar evidence before a future browser selector can admit a candidate.
- Packer-side `promotion-ledger` and `validate-promotion-ledger` commands that chain admitted candidate records into a deterministic promotion history before selector or population review.
- Packer-side `population-review` and `validate-population-review` commands that rank promotion-ledger candidates into deterministic frontier and parent-pool routes with explicit quality/frugality/quantization objective-vector metadata.
- Packer-side `parent-pool-recipe` and `validate-parent-pool-recipe` commands that turn a population review into a shared-contract parent set with normalized seed weights for sign-aware work.
- Packer-side `sign-merge-candidate` and `validate-sign-merge-candidate` commands that consume a validated parent-pool recipe, ledger, review, admissions, and parent `.slm` files, then write a normal `.slm` candidate plus a recomputable sign-vote receipt.
- Packer-side `multi-parent-candidate-manifest` and `validate-multi-parent-candidate` commands that bind validated sign-merge output to its receipt checksum, parent-pool recipe checksum, candidate `.slm` fields, and pending promotion route.
- Packer-side `multi-parent-promotion-template` and `validate-multi-parent-promotion` commands that bind a validated multi-parent candidate manifest to pending runtime-smoke and eval proof before admission.
- Packer-side `multi-parent-admission-record` and `validate-multi-parent-admission` commands that bind a validated multi-parent promotion template to runtime-smoke and passed eval evidence before selector-registry routing.
- Packer-side `selector-registry` and `validate-selector-registry` commands that bind two-parent selector admissions or multi-parent admission records to browser-safe `../models/*.slm` selector routes, with deterministic selector genome id, genome lineage checksum, species id, species-fit checksum, novelty id, novelty checksum, population id, population-review checksum, mate-selection id/status/parent-count/checksum, phenotype-evidence id/status/checksum, provenance-manifest checksum, heritable-artifact id/status/checksum, scoped fitness-vector checksum, optional f32/q8_0/q4_0 adapter sidecar fields, indexed adapter-family fields, adapter-family receipt handles, and adapter auto-apply stack fields for generated bundles.
- Packer-side `browser-multi-parent-bundle` command that writes a runnable TinyRustLM root with app shell, WASM runtime, generated f32/q8_0/q4_0 sign-merge `.slm` routes, manifests, selector registry carrying genome/species/novelty/population/mate-selection/phenotype/artifact/fitness evidence, module-plan receipt with `browser-constrained-v1` profile, `single-threaded-wasm-local-v1` execution profile, `local-no-store-v1` fetch policy, `same-origin-loopback-local-v1` origin policy, resource envelope, tokenizer checksum, fixed sampler candidate cap, `tinyrustlm-generate-v1` WASM export set, exact context token limit, exact adapter-stack byte budget, runtime scratch envelope, 4096-byte prompt envelope, 64 KiB output cap, KV-cache envelope, total budget/limit fields, and `module_plan_fetch_count_limit=32`, local self ADP1, family ADP1, sparse ASP1, and source-backed low-rank ALR1 sidecars, adapter manifests, adapter-family receipt, assembly receipt, and evidence chain.
- Packer-side `browser-converted-trained-bundle` command that writes a runnable TinyRustLM root from a reviewed trained-source directory with a converted-trained f32, q8_0, q4_0, or combined all-quant `.slm` selector set, provenance manifests, evidence sidecars, selector admissions, and `models/selector.registry`.
- Browser model selector optional intake from `models/selector.registry`, with smoke-model fallback when no admitted registry is present.
- Browser smoke mode for a served multi-parent selector registry entry, proving `multi-parent-sign-merge-q8` routes through local `../models/*.slm` model and manifest paths, plus generated file-backed f32/q8_0/q4_0 bundle routes.
- Browser smoke mode for generated served multi-parent bundles, proving `multi-parent-sign-merge-f32`, `multi-parent-sign-merge-q8`, and `multi-parent-sign-merge-q4` load through real `models/selector.registry`, `.module-plan.receipt`, `.slm`, `.slm.manifest`, assembly receipt, evidence, adapter receipt, adapter manifest file routes, and registry-backed provenance genome/species/novelty/population/mate-selection/phenotype/artifact/fitness rows.
- Browser smoke mode for file-backed converted-trained bundles, proving `converted-trained-q4`, `converted-trained-q8`, and `converted-trained-f32` load through one real q4-defaulted `models/selector.registry` root with `.slm` and `.slm.manifest` routes while rendering converted-trained provenance fields.
- Browser smoke mode for generated registry-carried adapter families, proving self ADP1, family ADP1, sparse ASP1, and source-backed low-rank ALR1 sidecars are offered from `models/selector.registry`, the served adapter-family receipt and all served adapter manifests are fetched and checksum-verified before the family choices are enabled, the receipt-declared family ADP1 plus sparse ASP1 plus source-backed ALR1 stack is validated and applied before generation, and Rust applies each package for f32/q8_0/q4_0 generated roots.
- Packer-side raw-f32 trained-source layout validation and `convert-trained` command for converting checked source weights into f32/q8_0/q4_0 `.slm` artifacts, including explicit BPE tokenizer source manifests and tied-output source manifests that omit `output.weight`; trained adapter source validation and source-backed ALR1 conversion now add low-rank f32 factor-bundle intake for compact skill deltas.
- Tiny trained-source fixture under `tests/fixtures/trained-source-tiny/` and scoped eval cases under `tests/fixtures/assistant-quality-eval-cases.txt`.
- Native no-crate `tinyrustlm-eval` runner for executing scoped eval cases against a local `.slm` and writing an eval sidecar.
- No-crate Rust local static server in `tools/local_server/`, plus the older no-dependency Node server script retained for narrow tooling fallback.
- No-crate Rust mini browser harness in `tools/browser_harness/` for static app crawl, required UI contract, local-only asset policy, WASM boundary markers, model/manifest presence, and optional loopback route checks.
- One-layer tiny f32 transformer forward path.
- Greedy local generation over f32, q8_0, and q4_0 tiny fixtures.
- Greedy local generation over the TinyLM-16M-shaped f32 model.
- Greedy local generation over the TinyLM-16M-shaped q8_0 model using direct q8_0 matvec dispatch.
- Greedy local generation over the TinyLM-16M-shaped q4_0 model using direct q4_0 matvec dispatch.
- q8_0 and q4_0 tensors stay in native compact storage without full decoded f32 shadow copies; embedding rows and norm vectors dequantize into scratch on demand.
- Model load pre-resolves top-level and per-layer tensor indices, and the checked-in tied-output fixture proves projection flags route output logits through token embeddings when `output.weight` is omitted.
- Runtime generation allocates reusable scratch buffers and logits with the loaded model, then reuses them across prompt generation and single-token stepping; stochastic sampling uses a fixed candidate buffer instead of a vocab-sized per-token vector.
- Generated result decoding is capped at 64 KiB; byte and BPE decode paths return `OutputBufferExceeded` before replacing `last_result`, and full `generate` failures clear stale token/cache diagnostics.
- Runtime diagnostics with tokenizer output, logits summary, selected token, top-k candidates, KV cache length, quantization mode, active sampling configuration, adapter apply count, last adapter checksum, and assembly-state checksum.
- Handwritten diagnostics JSON escaping for quotes, backslashes, control characters, line separators, and paragraph separators before browser parsing.
- Browser model selector for TinyLM-16M q8_0, TinyLM-16M q4_0, TinyLM-16M f32, f32/q8_0/q4_0 tiny fixtures, the tiny BPE fixture, and the tiny tied-output fixture.
- Browser conversation transcript that appends local User and TinyRustLM turns, keeps text insertion DOM-safe, persists across runtime Reset, and clears through the Clear control.
- Browser Step Token control that calls `generate_next_token` after generation context exists, appends one decoded token to the response and latest TinyRustLM transcript turn, and records the action in the token console.
- Browser product shell footer exposing TinyRustLM, Runtime.MiRust.com, browser-local Rust/WASM identity, and local `.slm` model scope.
- Browser smoke tool for headless Chrome or Edge UI verification.
- Browser UI audit mode for desktop/mobile structure, local-only notice, footer identity, model controls, panel coverage, diagnostics/developer mirror, benchmark fields, layout overflow, and local-only requests.
- Browser smoke and UI audit assertions for transcript state, including empty ready state, disabled Clear button before generation, generated User/TinyRustLM entries, Clear-click transcript removal, and response preservation after clearing history.
- Browser UI audit coverage for the model provenance panel, including deterministic-smoke source, runtime-smoke admission, runtime-execution-only quality claim, trained-quality non-claim, checksum, and required next gate.
- WASM ABI smoke tool for invalid UTF-8, null pointer, invalid length, recovery-after-error, step-token, adapter apply, and model-free verification.
- Visual Studio 2022 solution wrapper in `../TinyRustLM.sln`.

The runtime now proves local generation for f32, q8_0, and q4_0 tiny fixtures, a custom BPE tiny fixture with merged token diagnostics, a tied-output tiny fixture without `output.weight`, and real-shaped TinyLM-16M f32, q8_0, and q4_0 models. Quantized runtime storage no longer carries full decoded f32 shadows for q8_0 or q4_0 tensors, and the generation loop uses model-load-time tensor indices instead of per-token layer-name formatting. The runtime can also apply compatible raw `ADP1`, sparse `ASP1`, or low-rank `ALR1` f32-delta packages to already-loaded f32, q8_0, and q4_0 models after validating package checksum, tensor identity, tokenizer checksum, tensor-layout checksum, finite deltas/factors, and fused values; q8_0/q4_0 apply re-quantizes the compact tensor rows or blocks and successful apply clears generation and KV state. Diagnostics now record runtime assembly state: model load seeds a nonzero `assembly_state_checksum`, each accepted adapter increments `adapter_apply_count`, records `last_adapter_checksum`, and folds the package into the assembly checksum, and model free clears the fields. The browser exposes the ADP1/ASP1/ALR1 lane through checked local tiny f32, q8_0, and q4_0 sidecars, `models/tiny-test-model-self.adp1`, `models/tiny-test-model-q8-self.adp1`, and `models/tiny-test-model-q4-self.adp1`, and through generated selector registries that carry compatible f32/q8_0/q4_0 `.adp1`, `.asp1`, or `.alr1` routes whose apply status matches the admitted entry quantization, plus local `.adapter-family.receipt` handles for compatible family sets; JavaScript checks selected artifact checksums before WASM transfer without parsing adapter payloads. The packer can validate and convert raw source-weight bundles into f32, q8_0, and q4_0 artifacts, including BPE source bundles whose token and merge tables become a real `BPE1` `.slm` tokenizer section, and tied source bundles where `tied_output=true` agrees with a tied shape name and conversion sets the v1 tied-output flag. `browser-converted-trained-bundle` now stages one converted source artifact plus provenance, compatibility, lineage, candidate, promotion, runtime, eval, admission, and selector-registry sidecars into a runnable root that the `converted-trained-registry-file` smoke loads from real local files. The packer can also write parent compatibility reports for offline assembly operators, binding each parent to shape, tokenizer checksum, output-head contract, quantization, tensor layout checksum, and `.slm` checksum. Candidate lineage templates then bind a planned candidate to that passing report before any operator writes a `.slm` or adapter artifact. The direct-parameter operator lane now includes `blend-candidate`, which blends compatible tensor values by parts-per-million parent weights, `delta-candidate`, which writes `base + weight * (target - base)` task-vector candidates with signed parts-per-million weights, `sparse-delta-candidate`, which selects the largest absolute target-minus-base deltas, applies the signed task-vector weight to selected entries, leaves other entries at the base value, and records density, nonzero-delta retention, and an implicit top-k mask checksum, and `dare-candidate`, which deterministically drops nonzero task deltas with a seeded SplitMix64 mask, rescales the kept deltas by inverse keep rate, and records mask/raw-delta/rescaled-delta checksums. These commands write normal `.slm` files and receipts that their validators recompute before later gates. The adapter lane now includes `adapter-delta`, which writes an `ADP1` raw f32 task-delta package plus a manifest bound to the same compatibility and lineage checksums, `sparse-adapter-delta`, which writes an `ASP1` sparse f32 task-delta package plus density, retention, and mask checksum manifest fields, `low-rank-adapter-delta`, which writes an `ALR1` low-rank matrix-delta package plus component-limit, factor-density, and residual-L1 manifest fields, `adapter_family` receipt generation inside the browser bundle to bind compatible f32/q8_0/q4_0 ADP1/ASP1/ALR1 sidecar manifests into one selector-carried menu, and `fuse-adapter-delta`, which validates a raw adapter package, adds its deltas to the base parent, writes a normal `.slm` candidate, and records a recomputable fuse receipt. Candidate artifact manifests bind a validated lineage to a validated `.slm` output and prove it still matches the direct-parameter parent contract before eval or promotion. Multi-parent candidate manifests bind validated sign-merge output to its receipt checksum, parent-pool recipe checksum, candidate `.slm` fields, and pending promotion route. Two-parent promotion templates bind candidate manifest checksums, and multi-parent promotion templates bind sign-merge candidate manifest checksums plus receipt checksums; both keep runtime-smoke, eval, browser selector, and public-claim status pending until later evidence exists. Multi-parent admission records then bind the validated sign-merge promotion template to runtime-smoke, provenance, and passed eval evidence. Runtime-smoke sidecars bind local execution proof to provenance manifests, selector admission records bind promotion, runtime-smoke, and passed eval evidence into one browser-selector artifact, promotion ledgers chain admitted records into a deterministic history, population reviews score that history into frontier and parent-pool routes, parent-pool recipes require the reviewed parents to share one direct-parameter contract and assign fitness-normalized seed weights, sign-merge receipts create offline multi-parent candidates from those recipes using seed-weighted sign consensus, and selector registries bind either admission record family to local served model routes with genome/species/novelty/population/mate-selection/phenotype/artifact/fitness provenance. `browser-multi-parent-bundle` now generates runnable f32/q8_0/q4_0 sign-merge TinyRustLM roots with app shell, WASM runtime, evidence files, selector registry, `.slm`, `.slm.manifest`, assembly receipt, self ADP1, family ADP1, sparse ASP1, and low-rank ALR1 sidecars, adapter manifest files, and an adapter-family receipt that the browser smoke loads without interception; the browser smoke also keeps an intercepted q8_0 registry-adapter route to prove fixture selector metadata reaches the same apply path. Generated all-root smokes assert Rust diagnostics report `adapter_apply_count=3` plus nonzero adapter and assembly checksums before generation, while the checked manual sidecar smoke asserts count 1 after apply. The browser selector can consume that registry when present and otherwise keeps the deterministic smoke list for regression coverage. The native eval runner can produce scoped fixture evidence for each converted mode. The project still needs real trained weights and broader review before it can claim product assistant quality.

Generated bundle ALR1 stack members now come from reviewed adapter source templates converted through `convert-adapter-source`, so the browser route exercises source-backed ALR1 manifests while still leaving adapter payload validation to Rust.

Before generated model bytes are fetched, JavaScript fetches the served `.module-plan.receipt`, recomputes its text checksum, and matches its `browser-constrained-v1` profile, `single-threaded-wasm-local-v1` execution profile, `module_plan_fetch_policy=local-no-store-v1`, `module_plan_origin_policy=same-origin-loopback-local-v1`, `module_plan_fetch_count_limit=32`, resource class, tokenizer checksum, `module_plan_sampler_candidate_cap=1024`, `module_plan_wasm_export_set=tinyrustlm-generate-v1`, admitted context token limit, admitted model byte budget, adapter-family byte budget, `module_plan_runtime_scratch_byte_budget=65536`, `module_plan_prompt_byte_limit=4096`, `module_plan_output_byte_limit=65536`, `module_plan_kv_cache_byte_budget`, `module_plan_kv_cache_page_count`, `module_plan_total_byte_budget`, `module_plan_total_byte_budget_limit=43454464`, model, manifest, assembly receipt, adapter-family receipt, and adapter-stack member routes against the selector entry. The browser also computes the planned generated-root fetch count from the module plan, evidence routes, and adapter stack manifests before fetching generated model bytes. The Module Plan panel renders that verified execution profile, fetch policy, origin policy, fetch limit, tokenizer, sampler cap, WASM ABI, context, scratch budget, prompt limit, output limit, KV budget, KV pages, total budget, and total limit beside the model and adapter budgets, while `module-plan-execution-profile-drift`, `module-plan-fetch-policy-drift`, `module-plan-origin-policy-drift`, `module-plan-fetch-count-drift`, `module-plan-tokenizer-drift`, `module-plan-sampler-cap-drift`, `module-plan-wasm-export-set-drift`, `module-plan-context-token-drift`, `module-plan-runtime-scratch-drift`, `module-plan-prompt-limit-drift`, `module-plan-output-limit-drift`, `module-plan-kv-cache-drift`, `module-plan-total-budget-drift`, and `module-plan-total-limit-drift` prove checksum-consistent execution-profile, fetch-policy, origin-policy, fetch-count, tokenizer, sampler-cap, WASM export-set, context-token, scratch-budget, prompt-limit, output-limit, KV-cache, total-budget, or total-limit drift stops before generated `.slm` or adapter routes. Before generated registry family options are enabled, JavaScript fetches the served `.adapter-family.receipt` and each served `.adp1.manifest`, `.asp1.manifest`, or `.alr1.manifest`, recomputes their text checksums, and matches each member against the selector's route, format-derived manifest kind, checksum, manifest byte-count, and shared base-quantization identity metadata. The receipt also declares the ordered auto-apply stack; JavaScript verifies stack indexes, paths, manifest paths, and aggregate byte budget before fetching and transferring the family ADP1 plus sparse ASP1 plus source-backed low-rank ALR1 packages. It still does not parse adapter bytes; Rust validates ADP1/ASP1/ALR1 browser routes and applies ADP1/ASP1/ALR1 packages after transfer, with `adapter-stack-rust-validate-drift` proving checksum-consistent bytes stop at Rust semantic validation before any `apply_adapter_delta` call.

## Build Commands

Native tests:

```powershell
cargo test --workspace
```

Strict Rust public API documentation checks:

```powershell
cargo rustdoc -p tinyrustlm-runtime --lib -- -D missing_docs
cargo rustdoc -p tinyrustlm-slm-pack --bin tinyrustlm-slm-pack -- -D missing_docs
cargo rustdoc -p tinyrustlm-local-server --bin tinyrustlm-local-server -- -D missing_docs
cargo rustdoc -p tinyrustlm-browser-harness --bin tinyrustlm-browser-harness -- -D missing_docs
```

WASM build:

```powershell
rustup target add wasm32-unknown-unknown
cargo build -p tinyrustlm-runtime --release --target wasm32-unknown-unknown
Copy-Item .\target\wasm32-unknown-unknown\release\tinyrustlm_runtime.wasm .\tinyrustlm\runtime\tinyrustlm.wasm
cargo run -p tinyrustlm-slm-pack -- runtime-wasm-manifest .\tinyrustlm\runtime\tinyrustlm.wasm .\tinyrustlm\runtime\tinyrustlm.wasm.manifest
```

Model packing:

```powershell
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model.slm tiny-fixture
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q8.slm tiny-fixture-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-q4.slm tiny-fixture-q4
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-bpe.slm tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tiny-test-model-tied.slm tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-f32.slm tinylm16-f32
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-q8.slm tinylm16-q8
cargo run -p tinyrustlm-slm-pack -- .\tinyrustlm\models\tinylm16-q4.slm tinylm16-q4
```

Model validation and provenance:

```powershell
cargo run -p tinyrustlm-slm-pack -- validate .\tinyrustlm\models\tinylm16-q8.slm
cargo run -p tinyrustlm-slm-pack -- compatibility .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-self.compat
cargo run -p tinyrustlm-slm-pack -- lineage-template .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage tinylm16-q8-self-candidate identity-parent-set browser-local-16m-budget
cargo run -p tinyrustlm-slm-pack -- validate-lineage .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage
cargo run -p tinyrustlm-slm-pack -- blend-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.operator
cargo run -p tinyrustlm-slm-pack -- validate-blend-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.operator
cargo run -p tinyrustlm-slm-pack -- delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-delta.slm .\target\model-breeding\tinylm16-q8-delta.operator 1000000
cargo run -p tinyrustlm-slm-pack -- validate-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-delta.slm .\target\model-breeding\tinylm16-q8-delta.operator
cargo run -p tinyrustlm-slm-pack -- sparse-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-sparse-delta.slm .\target\model-breeding\tinylm16-q8-sparse-delta.operator 1000000 250000
cargo run -p tinyrustlm-slm-pack -- validate-sparse-delta-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-sparse-delta.slm .\target\model-breeding\tinylm16-q8-sparse-delta.operator
cargo run -p tinyrustlm-slm-pack -- dare-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-dare.slm .\target\model-breeding\tinylm16-q8-dare.operator 1000000 500000 29
cargo run -p tinyrustlm-slm-pack -- validate-dare-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8-dare.slm .\target\model-breeding\tinylm16-q8-dare.operator
cargo run -p tinyrustlm-slm-pack -- adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest
cargo run -p tinyrustlm-slm-pack -- validate-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest
cargo run -p tinyrustlm-slm-pack -- sparse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1 .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1.manifest 1000000 250000
cargo run -p tinyrustlm-slm-pack -- validate-sparse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1 .\target\model-breeding\tinylm16-q8.adapter.sparse.asp1.manifest
cargo run -p tinyrustlm-slm-pack -- low-rank-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1 .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1.manifest 1
cargo run -p tinyrustlm-slm-pack -- validate-low-rank-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1 .\target\model-breeding\tinylm16-q8.adapter.lowrank.alr1.manifest
cargo run -p tinyrustlm-slm-pack -- fuse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest .\target\model-breeding\tinylm16-q8-adapter-fused.slm .\target\model-breeding\tinylm16-q8-adapter-fuse.operator
cargo run -p tinyrustlm-slm-pack -- validate-fuse-adapter-delta .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm .\target\model-breeding\tinylm16-q8.adapter.delta .\target\model-breeding\tinylm16-q8.adapter.delta.manifest .\target\model-breeding\tinylm16-q8-adapter-fused.slm .\target\model-breeding\tinylm16-q8-adapter-fuse.operator
cargo run -p tinyrustlm-slm-pack -- sign-merge-candidate .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator --parents .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- validate-sign-merge-candidate .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator --parents .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- multi-parent-candidate-manifest .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator .\target\model-breeding\parent-pool-sign-merge.candidate --parents .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- validate-multi-parent-candidate .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator .\target\model-breeding\parent-pool-sign-merge.candidate --parents .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- multi-parent-promotion-template .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator .\target\model-breeding\parent-pool-sign-merge.candidate .\target\model-breeding\parent-pool-sign-merge.promotion --parents .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- validate-multi-parent-promotion .\target\model-breeding\population.ledger .\target\model-breeding\population.review .\target\model-breeding\parent-pool.recipe .\target\model-breeding\parent-pool-sign-merge.slm .\target\model-breeding\parent-pool-sign-merge.operator .\target\model-breeding\parent-pool-sign-merge.candidate .\target\model-breeding\parent-pool-sign-merge.promotion --parents .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm --admissions .\target\model-breeding\frontier.admission .\target\model-breeding\pool.admission
cargo run -p tinyrustlm-slm-pack -- candidate-manifest .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate
cargo run -p tinyrustlm-slm-pack -- validate-candidate .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate
cargo run -p tinyrustlm-slm-pack -- promotion-template .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate .\target\model-breeding\tinylm16-q8-self.promotion local-smoke-runner browser-local-runtime-smoke-and-eval
cargo run -p tinyrustlm-slm-pack -- validate-promotion .\target\model-breeding\tinylm16-q8-self.compat .\target\model-breeding\tinylm16-q8-self.lineage .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-self.candidate .\target\model-breeding\tinylm16-q8-self.promotion
cargo run -p tinyrustlm-slm-pack -- manifest .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest deterministic-smoke
cargo run -p tinyrustlm-slm-pack -- validate-manifest .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\target\model-breeding\tinylm16-q8-blend.slm .\target\model-breeding\tinylm16-q8-blend.slm.manifest .\target\model-breeding\tinylm16-q8-blend.runtime
cargo run -p tinyrustlm-slm-pack -- eval-template .\tinyrustlm\models\tinylm16-q8.slm .\tinyrustlm\models\tinylm16-q8.slm.manifest .\tinyrustlm\models\tinylm16-q8.slm.eval assistant-quality
```

The validator is a native no-crate admission gate for generated or future converted `.slm` files. It checks header bounds, checksum, byte-tokenizer metadata, required tensor names and shapes, dtype-specific payload lengths, quantization scale ranges, finite f32 payload values, and reports the model shape, tensor count, parameter count, quantization mode, and checksum.

The compatibility command is the first parent-set gate for modular model assembly. It validates both `.slm` files, then writes a line-based report with parent checksums, shape, tokenizer checksum, tensor layout checksum, quantization, and output-head contract. A direct-parameter parent set passes only when those contracts match exactly; otherwise the report routes the pair through source conversion or distillation before any future candidate artifact is promoted.

The lineage-template command is the second assembly bead. It accepts only a passing compatibility report, writes a planned candidate manifest with parent checksums, operator id, resource budget, compatibility report checksum, and pending candidate artifact fields, then `validate-lineage` proves the lineage file still matches its parent report.

The direct-parameter operator command is the third assembly bead. `blend-candidate` accepts a passing compatibility report, a validated lineage, two parent `.slm` files whose checksums match the report, and a parent-0 weight in parts per million. `delta-candidate` accepts the same gate inputs, treats parent 0 as the base and parent 1 as the target, then writes `base + weight * (target - base)` using signed parts-per-million task-vector weights. `sparse-delta-candidate` uses the same base/target contract, selects the largest absolute target-minus-base deltas by keep rate, applies the signed task-vector weight only to selected entries, and records total, nonzero, selected, pruned, unchanged, density, nonzero-delta retention, and implicit top-k mask checksum fields. `dare-candidate` uses the same base/target contract, selects nonzero deltas with a deterministic seeded dropout mask, rescales kept deltas by inverse keep rate, and records total, nonzero, selected, dropped, unchanged, density, nonzero retention, dropout seed, mask checksum, raw delta checksum, and rescaled delta checksum fields. Each operator writes a normal `.slm` candidate plus a receipt that records compatibility checksum, lineage checksum, parent checksums, operator weights, candidate checksum, and the next candidate-manifest gate. `validate-blend-candidate`, `validate-delta-candidate`, `validate-sparse-delta-candidate`, and `validate-dare-candidate` recompute candidate bytes and receipts before an artifact can move forward.

The adapter-delta commands are the parallel adapter assembly bead. `adapter-delta` accepts the same passing compatibility report, validated lineage, and base/target parents, then writes an `ADP1` binary package containing raw f32 tensor deltas in parent tensor order plus a line-based manifest with parent checksums, lineage checksum, tensor layout checksum, tokenizer checksum, adapter checksum, and next gate. `sparse-adapter-delta` writes an `ASP1` sparse f32 task-delta package with sorted `(value_index, delta)` pairs plus density, retention, and sparse mask checksum fields. `low-rank-adapter-delta` writes an `ALR1` low-rank matrix-delta package with deterministic cross-residual factors plus component-limit, factor-density, active-matrix, and residual-L1 manifest fields. `validate-adapter-delta`, `validate-sparse-adapter-delta`, and `validate-low-rank-adapter-delta` recompute the packages and manifests from the parents. `fuse-adapter-delta` validates a raw adapter package, fuses it into a normal `.slm` candidate with the base parent's dtype/layout, and writes an adapter-fuse receipt that `validate-fuse-adapter-delta` recomputes before candidate-manifest.

Trained adapter source intake is the source-side companion for that lane. `adapter-source-template` writes a reviewable `adapter-source.manifest` plus raw little-endian f32 low-rank factor files under `factors/`; `validate-adapter-source` verifies the model shape, tied-output contract, target tensor names and hashes, factor ranks, safe relative factor paths, byte counts, checksums, finite bounded factor values, factor parameter counts, and reconstructed delta L1 fields. This gives future trained LoRA-style modules a durable source format before any package is converted into runtime `ALR1` bytes or attached to browser assembly evidence.

The sign-merge command is the reviewed-population assembly bead. It accepts a validated parent-pool recipe plus the matching promotion ledger, population review, admission records, and parent `.slm` files. Parent 0 is the frontier base; the other parents cast seed-weighted positive and negative delta votes for each parameter. `sign-merge-candidate` keeps the base value on ties, otherwise applies the winning sign's weighted average delta, writes a normal `.slm`, and records recipe, relatedness metric/scope/pair count/checksum, ledger, review, admission, parent, sign-count, candidate checksum, and multi-parent candidate-manifest fields. `validate-sign-merge-candidate` recomputes candidate bytes and receipt before `multi-parent-candidate-manifest` binds the result to its receipt checksum, recipe checksum, relatedness summary, candidate `.slm` fields, and pending promotion route. `multi-parent-promotion-template` then binds that validated candidate manifest to pending runtime-smoke and eval status for the sign-merge path.

The candidate-manifest command is the fourth assembly bead. It accepts only a validated lineage and a `.slm` artifact that passes native admission and matches the direct-parameter parent contract, then writes candidate checksum, shape, tokenizer checksum, tensor layout checksum, admission status, pending eval status, and the next promotion gate. `validate-candidate` proves the manifest still matches compatibility, lineage, and the candidate artifact.

The promotion-template command is the fifth assembly bead. It accepts only a validated candidate artifact manifest, records the candidate manifest checksum, keeps runtime-smoke and eval statuses pending, and keeps browser selector plus public-claim admission closed until later promotion evidence exists. `validate-promotion` proves the promotion sidecar still matches compatibility, lineage, candidate, and candidate manifest inputs.

The runtime-smoke command is the sixth assembly bead. It writes a line-based sidecar bound to the provenance manifest checksum, `.slm` checksum, source kind, model shape, and runtime-smoke decision. `admission-record` is the seventh bead: it accepts only a valid promotion template, a valid runtime-smoke sidecar, and a passed converted-trained eval sidecar, then records selector admission with public claims still bound to the declared eval scope. `promotion-ledger` is the eighth bead: it accepts admitted records, rejects duplicates, and writes a hash-chained promotion history for selector or population review. `population-review` is the ninth bead: it validates that ledger against the same admission records, ranks candidates by quality, artifact frugality, and quantization fit, writes a `fitness_objective_vector_*` contract plus per-entry objective checksums, marks the frontier candidate, and routes remaining candidates to the parent pool. `parent-pool-recipe` is the tenth bead: it validates the population review, requires a shared direct-parameter contract across selected parents, records fitness-normalized seed weights, and writes relatedness metric/scope/pair count/checksum plus per-parent relatedness group fields for sign-aware merge work. `sign-merge-candidate` is the eleventh bead: it validates that recipe and writes an offline multi-parent `.slm` candidate plus receipt that echoes the relatedness fields. `multi-parent-candidate-manifest` is the twelfth bead for that path: it validates the sign-merge receipt and writes the candidate manifest with the relatedness summary. `multi-parent-promotion-template` is the thirteenth bead for that path: it binds the candidate manifest checksum, receipt checksum, recipe checksum, parent count, and candidate `.slm` fields before runtime-smoke, eval, admission, ledger, and selector routing. `multi-parent-admission-record` is the fourteenth bead for that path: it binds the validated sign-merge promotion evidence to provenance, runtime-smoke, and passed eval sidecars. `selector-registry` remains the served-model route bead: it accepts selector admission records or multi-parent admission records whose candidate artifact path resolves under served `tinyrustlm/models/`, then writes a browser route such as `../models/admitted-q8.slm` plus genome/species/novelty/population/mate-selection/phenotype/artifact/fitness provenance.

Registry generation is intentionally a served-model step. A converted candidate that lives only under `target/` can be admitted for evidence, but it enters a selector registry only after the admitted `.slm` and `.slm.manifest` are staged under the local `tinyrustlm/models/` route used by the browser server.

The manifest sidecar is line-based, not JSON. It binds model byte count, `.slm` checksum, shape, tensor count, parameter count, quantization mode, source kind, admission status, and quality boundary. Current artifacts use `source_kind=deterministic-smoke`, `quality_claim=runtime-execution-smoke-only`, and `trained_quality_claim=not-claimed`. The browser app displays this sidecar in the Model Provenance panel after Rust accepts the selected `.slm` model, keeping the trained-quality boundary visible in the local UI.

The quality gate is also line-based and no-crate. `quality-gate ... runtime-smoke` admits deterministic smoke or converted-trained artifacts only for runtime execution evidence. `quality-gate ... assistant-quality <input.eval>` requires `source_kind=converted-trained`, a matching model checksum, a matching manifest checksum, passed task evaluation, declared quality scope, and `quality_decision=accepted-for-assistant-quality`. `eval-template` writes a bound pending template; pending templates intentionally fail `assistant-quality` until reviewed evidence replaces the placeholder fields.

Trained source conversion:

```powershell
cargo run -p tinyrustlm-slm-pack -- adapter-source-template .\target\trained-source-smoke\adapter-source-tiny tiny-fixture
cargo run -p tinyrustlm-slm-pack -- validate-adapter-source .\target\trained-source-smoke\adapter-source-tiny
cargo run -p tinyrustlm-slm-pack -- source-template .\tinyrustlm\tests\fixtures\trained-source-tiny tiny-fixture
cargo run -p tinyrustlm-slm-pack -- validate-source .\tinyrustlm\tests\fixtures\trained-source-tiny
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-f32.slm f32
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- convert-trained .\tinyrustlm\tests\fixtures\trained-source-tiny .\target\trained-source-smoke\tiny-converted-q4.slm q4_0
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-tied tiny-fixture-tied
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-tied
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-f32.slm f32
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-tied .\target\trained-source-smoke\tiny-tied-converted-q4.slm q4_0
cargo run -p tinyrustlm-slm-pack -- source-template .\target\trained-source-smoke\source-tiny-bpe tiny-fixture-bpe
cargo run -p tinyrustlm-slm-pack -- validate-source .\target\trained-source-smoke\source-tiny-bpe
cargo run -p tinyrustlm-slm-pack -- convert-trained .\target\trained-source-smoke\source-tiny-bpe .\target\trained-source-smoke\tiny-bpe-converted-q8.slm q8_0
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest runtime-smoke
cargo run -p tinyrustlm-slm-pack -- runtime-smoke .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\target\trained-source-smoke\tiny-converted-q8.runtime
cargo run -p tinyrustlm-runtime --bin tinyrustlm-eval -- .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\tinyrustlm\tests\fixtures\assistant-quality-eval-cases.txt .\target\trained-source-smoke\tiny-converted-q8.eval
cargo run -p tinyrustlm-slm-pack -- quality-gate .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm.manifest assistant-quality .\target\trained-source-smoke\tiny-converted-q8.eval
```

Converted-trained candidates can produce selector admission records after the model-breeding sidecars exist:

```powershell
cargo run -p tinyrustlm-slm-pack -- compatibility .\target\trained-source-smoke\tiny-converted-q8.slm .\target\trained-source-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.compat
cargo run -p tinyrustlm-slm-pack -- lineage-template .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage tiny-converted-q8-self direct-self-fit browser-local-constrained
cargo run -p tinyrustlm-slm-pack -- candidate-manifest .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage .\target\trained-source-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.candidate
cargo run -p tinyrustlm-slm-pack -- promotion-template .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage .\target\trained-source-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.candidate .\target\admission-smoke\tiny-converted-q8.promotion local-smoke-runner browser-local-runtime-smoke-and-eval
cargo run -p tinyrustlm-slm-pack -- admission-record .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage .\target\trained-source-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.candidate .\target\admission-smoke\tiny-converted-q8.promotion .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\target\trained-source-smoke\tiny-converted-q8.runtime .\target\trained-source-smoke\tiny-converted-q8.eval .\target\admission-smoke\tiny-converted-q8.admission browser-local-selector
cargo run -p tinyrustlm-slm-pack -- validate-admission .\target\admission-smoke\tiny-converted-q8.compat .\target\admission-smoke\tiny-converted-q8.lineage .\target\trained-source-smoke\tiny-converted-q8.slm .\target\admission-smoke\tiny-converted-q8.candidate .\target\admission-smoke\tiny-converted-q8.promotion .\target\trained-source-smoke\tiny-converted-q8.slm.manifest .\target\trained-source-smoke\tiny-converted-q8.runtime .\target\trained-source-smoke\tiny-converted-q8.eval .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- promotion-ledger .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- validate-promotion-ledger .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- population-review .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.population .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- validate-population-review .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.population .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- parent-pool-recipe .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.population .\target\admission-smoke\tiny-converted-q8.parents .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- validate-parent-pool-recipe .\target\admission-smoke\tiny-converted-q8.ledger .\target\admission-smoke\tiny-converted-q8.population .\target\admission-smoke\tiny-converted-q8.parents .\target\admission-smoke\tiny-converted-q8.admission
cargo run -p tinyrustlm-slm-pack -- selector-registry .\target\selector-smoke\selector.registry .\target\selector-smoke\admitted-q8.admission
cargo run -p tinyrustlm-slm-pack -- validate-selector-registry .\target\selector-smoke\selector.registry .\target\selector-smoke\admitted-q8.admission
```

The source layout is line metadata plus raw little-endian f32 tensor files under `tensors/`. Validation requires safe relative paths, exact byte counts, matching source checksums, expected tensor names and shapes, finite f32 values, bounded absolute weights, nonzero tensor payloads, agreement between `model_shape` and `tied_output`, and agreement between BPE shape names and `tokenizer=bpe-v1`. BPE source bundles declare token and merge records directly in `source.manifest`; conversion writes those records into the `.slm` tokenizer section. Tied source bundles omit `output.weight` and converted `.slm` artifacts carry the v1 tied-output flag. `convert-trained` writes a converted-trained manifest automatically. The standing unit and Visual Studio gates convert the fixture to f32, q8_0, and q4_0 so each advertised output mode is admitted directly; tied-output source conversion is smoke-gated across f32, q8_0, and q4_0, and BPE source conversion is smoke-gated for q8_0. `tinyrustlm-eval` runs exact fixture cases through the runtime and writes a scoped eval sidecar. The checked-in cases prove only `tiny-converted-source-fixture-only`, not product assistant quality.

Local static server using the no-crate Rust server:

```powershell
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

Rust mini browser contract harness:

```powershell
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm
cargo run -p tinyrustlm-browser-harness -- .\tinyrustlm --http http://127.0.0.1:8080/app/
```

The legacy Node server remains available for comparison or ad hoc tool checks:

```powershell
node .\tinyrustlm\tools\static-server.js .\tinyrustlm 8080
```

Browser smoke verification:

```powershell
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9225
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9226 tinylm16q4
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9227 tinylm16q8 loop
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9228 tinylm16q8 model-error
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9229 tinylm16q8 context-error
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9230 tinylm16q8 missing-model
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9231 tinylm16q8 endurance 3
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9232 tinylm16q8 performance 4
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9233 tinylm16q8 performance-soak 3 4
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9234 tinylm16q8 ui-audit
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9235 tinylm16q8 step-token
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9236 multi-parent-sign-merge-q8 multi-parent-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9266 tinylm16-blend-q8 blend-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9267 tinylm16q8 blend-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9268 tinylm16-delta-q8 delta-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9269 tinylm16q8 delta-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9270 tinylm16-sparse-delta-q8 sparse-delta-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9271 tinylm16q8 sparse-delta-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9272 tinylm16-dare-q8 dare-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9273 tinylm16q8 dare-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9260 tinylm16-prune-q8 prune-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9261 tinylm16q8 prune-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9262 tinylm16-crossover-q8 crossover-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9263 tinylm16q8 crossover-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9264 tinylm16-mutation-q8 mutation-operator-registry
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9265 tinylm16q8 mutation-operator-receipt-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9238 tinyf32 adapter-sidecar
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9240 tinyq8 adapter-sidecar
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9241 tinyq4 adapter-sidecar
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9242 tinyq8 adapter-sidecar-registry-q8
cargo run -p tinyrustlm-slm-pack -- browser-converted-trained-bundle .\target\browser-converted-trained-file\tinyrustlm .\tinyrustlm\tests\fixtures\trained-source-tiny all
cargo run -p tinyrustlm-local-server -- .\target\browser-converted-trained-file\tinyrustlm 8096
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8096/app/ 9290 converted-trained-q4 converted-trained-registry-file
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8096/app/ 9291 converted-trained-q8 converted-trained-registry-file
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8096/app/ 9292 converted-trained-f32 converted-trained-registry-file
cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-multi-parent\tinyrustlm
cargo run -p tinyrustlm-local-server -- .\target\browser-served-multi-parent\tinyrustlm 8090
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8090/app/ 9237 multi-parent-sign-merge-f32 multi-parent-registry-file
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8090/app/ 9239 multi-parent-sign-merge-f32 adapter-sidecar-registry-file
cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-multi-parent-q8\tinyrustlm q8_0
cargo run -p tinyrustlm-local-server -- .\target\browser-served-multi-parent-q8\tinyrustlm 8093
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8093/app/ 9243 multi-parent-sign-merge-q8 adapter-sidecar-registry-file
cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-multi-parent-q4\tinyrustlm q4_0
cargo run -p tinyrustlm-local-server -- .\target\browser-served-multi-parent-q4\tinyrustlm 8094
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8094/app/ 9244 multi-parent-sign-merge-q4 adapter-sidecar-registry-file
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8094/app/ 9245 multi-parent-sign-merge-q4 adapter-stack-rust-validate-drift
cargo run -p tinyrustlm-slm-pack -- browser-multi-parent-bundle .\target\browser-served-multi-parent-all\tinyrustlm all
cargo run -p tinyrustlm-local-server -- .\target\browser-served-multi-parent-all\tinyrustlm 8095
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9246 multi-parent-sign-merge-q4 combined-selector-cycle 2
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9247 multi-parent-sign-merge-q4 combined-selector-route-soak 3
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9248 multi-parent-sign-merge-q4 combined-selector-route-extended-soak
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9249 multi-parent-sign-merge-q4 combined-selector-route-stress-soak
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9250 multi-parent-sign-merge-q4 module-plan-profile-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9251 multi-parent-sign-merge-q4 module-plan-execution-profile-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9252 multi-parent-sign-merge-q4 module-plan-fetch-policy-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9253 multi-parent-sign-merge-q4 module-plan-origin-policy-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9254 multi-parent-sign-merge-q4 module-plan-runtime-scratch-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9255 multi-parent-sign-merge-q4 module-plan-kv-cache-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9256 multi-parent-sign-merge-q4 module-plan-context-token-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9257 multi-parent-sign-merge-q4 module-plan-tokenizer-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9258 multi-parent-sign-merge-q4 module-plan-sampler-cap-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9259 multi-parent-sign-merge-q4 module-plan-count-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9260 multi-parent-sign-merge-q4 module-plan-total-budget-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9261 multi-parent-sign-merge-q4 module-plan-total-limit-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9262 multi-parent-sign-merge-q4 module-plan-wasm-export-set-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9263 multi-parent-sign-merge-q4 module-plan-prompt-limit-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8095/app/ 9264 multi-parent-sign-merge-q4 module-plan-fetch-count-drift
node .\tinyrustlm\tools\browser-smoke.js http://127.0.0.1:8080/app/ 9265 tinylm16q8 prompt-limit
```

The combined selector cycle keeps one generated `all` root open, repeats q4_0/q8_0/f32 selection, releases the prior WASM model before each post-initial assembly, and proves each new entry validates and applies its ADP1/ASP1/ALR1 stack before generation.
The route-soak smoke also requires each generated module-plan, model, manifest, assembly, evidence, adapter-family, adapter manifest, and ADP1/ASP1/ALR1 stack route to be requested once per pass; the app fetches local assembly resources with no-store cache behavior for that proof.
The extended route-soak smoke raises that browser proof to five q4_0/q8_0/f32 cycles, so one page must complete fifteen generated assemblies with fresh route requests.
The stress route-soak smoke raises the same proof to eight q4_0/q8_0/f32 cycles, so one page must complete twenty-four generated assemblies with fresh route requests.
The profile-drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_profile` is not `browser-constrained-v1`.
The execution-profile drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_execution_profile` is not `single-threaded-wasm-local-v1`.
The fetch-policy drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_fetch_policy` is not `local-no-store-v1`.
The fetch-count drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_fetch_count_limit` diverges from the selector-owned browser route-count envelope.
The count-drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when receipt `module_count` diverges from selector `module_plan_module_count`.
The context-token drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_context_token_limit` diverges from the admitted model shape.
The tokenizer drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_tokenizer_checksum` diverges from the admitted model tokenizer checksum.
The sampler-cap drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_sampler_candidate_cap` diverges from the fixed-buffer sampler envelope.
The WASM export-set drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_wasm_export_set` is not `tinyrustlm-generate-v1`.
The prompt-limit drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_prompt_byte_limit` diverges from the 4096-byte prompt envelope; source-root `prompt-limit` proves oversized prompt bytes are stopped before WASM prompt transfer.
The KV-cache drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_kv_cache_page_count` diverges from the selector-owned cache envelope.
The total-limit drift smoke keeps the selector checksum aligned with a mutated module-plan receipt and proves the browser stops before generated model or adapter routes when `module_plan_total_byte_budget_limit` diverges from the selector-owned browser cap.

WASM ABI boundary smoke:

```powershell
node .\tinyrustlm\tools\wasm-abi-smoke.js
```

The ABI smoke also checks `set_sampling_config`, rejects invalid stochastic settings, restores greedy defaults, verifies diagnostics still report `temperature=0`, `top_k=1`, `top_p=1`, and `seed=1` after recovery generation, requires `generate_next_token` to return an explicit `ErrorCode` while exposing token text through `last_result`, validates a zero-delta f32 `ADP1` package through `validate_adapter_delta`, applies the same package through `apply_adapter_delta`, and requires `free_model` to clear loaded-model diagnostics before later generation returns `ModelNotLoaded`. Unit tests also cover sparse `ASP1` and low-rank `ALR1` adapter apply on loaded tensors across the current f32/q8_0/q4_0 boundary. Unit tests cover the 64 KiB generated-result cap for byte and BPE decode paths plus runtime `OutputBufferExceeded` diagnostics.

The browser runtime ships only static HTML, CSS, JS, WASM, local `.slm` files, and checked tiny f32/q8_0/q4_0 `ADP1` sidecars. The current browser milestone defaults to `tinylm16-q8.slm` and keeps TinyLM-16M q4_0, f32, tiny byte-tokenizer fixtures, the tiny BPE fixture, the tiny tied-output fixture, and tiny f32/q8_0/q4_0 adapter routes available for regression checks.

## Current Fixture Behavior

The tiny fixture is intentionally deterministic. Prompt `hi` generates local byte tokens that decode to:

```text
eeeeeeeeeeeee
```

Diagnostics show `argmax=101`, selected token `101`, and active quantization mode `f32`, `q8_0`, or `q4_0` depending on the selected fixture.

The TinyLM-16M f32, q8_0, and q4_0 fixtures are also deterministic. Prompt `hi` with `max_new_tokens=1` generates:

```text
e
```

## Current Local Server

Start a local static server with:

```text
cargo run -p tinyrustlm-local-server -- .\tinyrustlm 8080
```

The Visual Studio F5 wrapper verifies whether a running server is actually TinyRustLM before reusing it. If port 8080 is occupied by another local service, the wrapper starts the Rust static server on the next free loopback port and opens that URL.

## Visual Studio

Open `..\TinyRustLM.sln` in Visual Studio 2022. `Build Solution` invokes `tools/vs/Build-TinyRustLM.ps1`; `F5` invokes `tools/vs/Run-TinyRustLM.ps1`, reuses a verified TinyRustLM server or starts the local static server, and opens the app.

The Visual Studio test helper can run browser hardening checks:

```powershell
.\tools\vs\Test-TinyRustLM.ps1 -BrowserSmoke
.\tools\vs\Test-TinyRustLM.ps1 -PerformanceSoak -PerformanceSoakCycles 3 -PerformanceSoakTokens 4
```
