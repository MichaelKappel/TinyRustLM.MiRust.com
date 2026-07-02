<?php
return [
    '/' => [
        'title' => 'TinyRustLM: Browser-Local Tiny Language Models in Rust and WASM',
        'summary' => 'TinyRustLM is a project site for a custom Rust/WASM SLM runtime that keeps model execution local, small, auditable, and dependency-free.',
        'badge' => 'Project Website',
        'sections' => [
            [
                'heading' => 'What TinyRustLM is',
                'body' => 'TinyRustLM is a browser-local small language model runtime written for Rust and WebAssembly. The project is not a generic AI website and not a hosted chatbot. It is an implementation-centered site for explaining how a custom runtime loads compact .slm model artifacts, validates their shape and checksums, executes generation inside the browser sandbox, and exposes diagnostics without remote inference.',
                'points' => ['Custom Rust/WASM runtime', 'No remote inference API', 'No JavaScript framework', 'No ML framework runtime', 'Local .slm artifacts and manifests', 'Deterministic smoke-test posture'],
            ],
            [
                'heading' => 'The core constraint',
                'body' => 'The design centers on a strict browser selector model byte budget of 33,554,432 bytes. This pressure forces the site and the runtime to explain why model shape, vocabulary size, quantization, scratch buffers, and adapter payloads are first-class product concerns rather than hidden implementation details.',
                'points' => ['33.5 MB selector model envelope', 'q8_0 and q4_0 data paths', 'Bounded prompt and output buffers', 'Reusable runtime scratch', 'Explicit failure states'],
            ],
            [
                'heading' => 'Why it matters',
                'body' => 'TinyRustLM treats tiny models as local compute units: small enough to fetch, parse, validate, and run in constrained browser memory, but structured enough to test tokenization, quantization, adapter application, provenance, and deterministic generation. The project is most useful as a transparent engineering baseline for local AI experiments, not as a claim that microscopic models equal cloud-scale assistants.',
                'points' => ['Local privacy by default', 'Supply-chain surface reduction', 'Inspectable artifacts', 'Fast failure and recovery', 'Model provenance before model claims'],
            ],
        ],
        'cards' => [
            ['title' => 'Zero dependency', 'text' => 'No Bootstrap, jQuery, React, Vue, Tailwind, tokenizer crate, ML framework, wasm-bindgen requirement, remote inference API, CDN asset, or npm runtime.'],
            ['title' => 'Custom .slm payloads', 'text' => 'A compact binary format with strict header, tensor directory, tokenizer metadata, quantization fields, and checksum validation.'],
            ['title' => 'Browser-first verification', 'text' => 'Loopback server, static app contract harness, WASM ABI smoke tests, browser smoke modes, and deterministic output checks.'],
            ['title' => 'Adapters and assembly', 'text' => 'ADP1 raw deltas, ASP1 sparse deltas, ALR1 low-rank deltas, selector registries, module-plan receipts, and apply-before-generate gates.'],
        ],
    ],
    '/architecture/' => [
        'title' => 'TinyRustLM Architecture',
        'summary' => 'The architecture divides the system into a static browser UI, Rust/WASM runtime, .slm model format, offline packer, local server, browser harness, and model-breeding evidence path.',
        'badge' => 'System Map',
        'sections' => [
            ['heading' => 'Runtime boundary', 'body' => 'Rust owns model parsing, tensor validation, tokenizer behavior, quantization math, KV cache state, sampling, generation, diagnostics, error codes, adapter validation, and adapter application. JavaScript owns the page shell, local fetches, byte transfer into WASM memory, controls, diagnostics rendering, and transcript display.', 'points' => ['Rust owns inference', 'JavaScript does not parse .slm tensors', 'Local fetches only', 'Diagnostics are exposed intentionally']],
            ['heading' => 'Static browser app', 'body' => 'The app is deliberately static: HTML, custom CSS, and handwritten JavaScript. Its job is to select local artifacts, verify manifests and receipts, copy verified bytes into WASM, and render state through text-safe DOM operations.', 'points' => ['No client framework', 'No CDN dependency', 'No remote model call', 'DOM text nodes for generated content']],
            ['heading' => 'Offline toolchain', 'body' => 'The packer and validation tools convert source weights into .slm artifacts, write manifests, create adapter packages, generate receipts, produce selector registries, stage browser bundles, and gate claims through runtime-smoke or evaluation sidecars.', 'points' => ['slm_pack utility', 'Provenance manifests', 'Candidate manifests', 'Runtime-smoke sidecars', 'Eval sidecars']],
            ['heading' => 'Claim discipline', 'body' => 'The architecture separates execution proof from assistant-quality proof. Running a deterministic fixture proves runtime behavior; it does not prove that a trained assistant model is broadly useful. Public copy should keep that difference visible.', 'points' => ['Execution claim requires runtime evidence', 'Assistant-quality claim requires eval evidence', 'Operator receipts must remain replayable']],
        ],
    ],
    '/runtime/' => [
        'title' => 'Rust/WASM Runtime',
        'summary' => 'The runtime is the verified execution surface: memory transfer, model loading, tokenizer dispatch, quantized tensor access, generation, diagnostics, and explicit error states.',
        'badge' => 'Runtime',
        'sections' => [
            ['heading' => 'No-crate implementation posture', 'body' => 'The active runtime direction is a no-third-party-crate Rust/WASM target. The strongest supply-chain control is the smallest dependency graph possible. Unsafe code is confined to the unavoidable WASM memory boundary and must be paired with validation.', 'points' => ['No ML framework', 'No tokenizer dependency', 'No general-purpose web framework', 'Isolated unsafe boundary']],
            ['heading' => 'Generation loop', 'body' => 'Generation uses preallocated runtime structures: model-owned scratch arenas, reusable logits, fixed-buffer sampling, bounded decoding, and clean request state. This keeps the hot path stable and makes failure states testable.', 'points' => ['ForwardScratch', 'Reusable logits', 'Fixed top-k candidate cap', '64 KiB output cap']],
            ['heading' => 'Diagnostics', 'body' => 'The runtime exposes information the UI can display: model load state, quantization mode, prompt token count, generated token count, KV length, scratch usage, adapter apply count, and assembly checksums. These are part of correctness, not decorative telemetry.', 'points' => ['Local-only diagnostics', 'No external analytics', 'Escaped JSON output', 'Reset and free-model state handling']],
        ],
    ],
    '/slm-format/' => [
        'title' => 'The .slm Model Format',
        'summary' => '.slm is the project-specific binary model artifact designed for strict browser loading, bounded validation, and compact local execution.',
        'badge' => 'Artifact ABI',
        'sections' => [
            ['heading' => 'Why not generic model files', 'body' => 'Generic model formats are flexible, but that flexibility usually requires broader parsers, larger metadata surfaces, and more runtime interpretation. TinyRustLM uses a narrower artifact contract so the browser runtime can validate and load only what it knows how to execute.', 'points' => ['Header validation', 'Tensor directory validation', 'Tokenizer checksum', 'Layout checksum', 'Finite payload checks']],
            ['heading' => 'Structural invariants', 'body' => 'The format records explicit model dimensions and tensor entries. Header fields must be non-zero, tensor entries must point inside the file, declared shapes must match payload counts, and checksums must bind the artifact before generation is allowed.', 'points' => ['108-byte header target', '64-byte tensor entries', 'Non-zero checksum', 'No NaN or Infinity payloads']],
            ['heading' => 'Tokenizer inclusion', 'body' => 'The runtime supports byte-level fallback and compiled BPE metadata. Tokenizer data belongs inside the model artifact or its verified sidecar path so generation does not depend on Python-only tokenizer files at runtime.', 'points' => ['Byte fallback', 'BPE metadata', 'Bounded decode', 'Tokenizer drift checks']],
        ],
    ],
    '/quantization/' => [
        'title' => 'Quantization and Memory Budget',
        'summary' => 'TinyRustLM explains quantization as product architecture: q8_0 and q4_0 determine which tiny models can fit into browser memory without hiding compute costs.',
        'badge' => 'Memory Math',
        'sections' => [
            ['heading' => 'f32, q8_0, and q4_0', 'body' => 'The runtime data paths are intentionally limited. f32 is useful for tests and baselines, q8_0 is the balanced path for quality and compactness, and q4_0 exists for maximum model capacity under tight browser memory limits.', 'points' => ['f32: 4.0 bytes per parameter', 'q8_0: roughly 1.0625 bytes per parameter', 'q4_0: roughly 0.5625 bytes per parameter']],
            ['heading' => '4-bit cost in WASM', 'body' => 'q4_0 saves bytes but costs instructions. Standard WASM does not provide native 4-bit tensor arithmetic, so the runtime must unpack nibbles with masks and shifts before accumulation. That makes q4_0 a memory win but not a free speed win.', 'points' => ['Nibble unpacking', 'Scale per block', 'SIMD v128 acceleration where deterministic', 'Dequantize on demand']],
            ['heading' => 'Practical model candidates', 'body' => 'The source analysis identifies candidates such as llama2.c-stories15M, Aurelius 10M, Pythia-14M, Pythia-31M, tiny-gpt2, and larger q4-only stress candidates. The site does not claim all are production-ready; it explains why each is useful for validation or browser experiments.', 'points' => ['Llama path validation', 'GPT-NeoX path validation', 'Small vocabulary experiments', 'q8/q4 stress testing']],
        ],
    ],
    '/browser-runtime/' => [
        'title' => 'Browser Runtime and Local App Surface',
        'summary' => 'The browser app is a local control surface for model selection, verified bytes, WASM transfer, generation, transcript state, and diagnostics.',
        'badge' => 'Browser Surface',
        'sections' => [
            ['heading' => 'Root app route', 'body' => 'TinyRustLM.com is the simple public app route. The app loads at the domain root, not under /app/, and keeps the first-run path focused on choosing a local .slm file through the browser file picker.', 'points' => ['https://TinyRustLM.com/', 'No /app/ subpath for the root site', 'User-selected .slm files', 'No served project model bytes']],
            ['heading' => 'Local-origin policy', 'body' => 'TinyRustLM runs as a browser-local static app. The browser fetches the app shell and Rust/WASM runtime, then users provide local .slm files, manifests, and receipts. Public project servers do not run user model bytes and do not serve runnable .slm model artifacts.', 'points' => ['Local WASM runtime', 'Local model import', 'Local manifests and receipts', 'No remote inference', 'No project-hosted .slm route']],
            ['heading' => 'TinyRustLM chat-first surface', 'body' => 'The app starts in Chat mode with simple starter profiles and three source choices: Your Local Files, Hugging Face, and P2P Exchange. Hugging Face rows are source metadata only. The simple Hugging Face list defaults P2P on, shows P2P Import only when MiniModel metadata includes peer-offer proof plus a catalog-listed peer source or saved Known peer URL, shows Set Peer URL for proof-ready rows without a known source, shows Start Conversion otherwise, and shows one warning when P2P is disabled. Start Conversion saves the local Rust conversion-script handoff; it does not download model bytes, and after conversion it calls MiniModel prepare-peer-share to write the manifest, peer-offer proof, local peer pieces, and catalog entry in one share directory. After a verified local .slm import, TinyRustLM can save a local minimodel.local_slm_share_metadata.v0 bundle with artifact and chunk hashes for later peer availability.', 'points' => ['Starter profiles for novice entry', 'Local file picker remains the runnable path', 'Hugging Face search stays metadata until .slm admission', 'P2P Import requires MiniModel peer proof and a peer source', 'Set Peer URL is the proof-ready fallback', 'Start Conversion is the fallback action', 'Local conversion script is not a download proxy', 'prepare-peer-share creates the local P2P share package', 'Share metadata export stays local', 'MiniModel P2P stays manifest and receipt gated', 'Advanced telemetry is still available']],
            ['heading' => 'Selector registry', 'body' => 'A selector registry declares which admitted model routes are eligible in the browser. The registry must carry model byte counts, selector budgets, manifests, adapter-family fields, module-plan receipt routes, and default strategy metadata before entries become selectable.', 'points' => ['selector_model_byte_budget=33554432', 'Text sidecar budgets', 'q4 default in combined roots', 'Route drift rejection']],
            ['heading' => 'Transcript and reset', 'body' => 'The visible transcript is browser UI state. Runtime Reset clears model generation context. Clear removes transcript display. Keeping those separate prevents UI cleanup from pretending to be a runtime reset, and vice versa.', 'points' => ['Clear transcript', 'Reset runtime context', 'Free loaded model', 'Step-token continuation']],
        ],
    ],
    '/adapters/' => [
        'title' => 'Adapter Sidecars: ADP1, ASP1, and ALR1',
        'summary' => 'TinyRustLM treats adapters as typed local sidecars that must be verified, semantically preflighted by Rust, and applied before generation.',
        'badge' => 'Skill Packages',
        'sections' => [
            ['heading' => 'Adapter families', 'body' => 'The project defines three adapter lanes: ADP1 raw f32 task deltas, ASP1 sparse f32 task deltas, and ALR1 low-rank task deltas. Each exists to update model behavior without shipping an entire replacement .slm artifact.', 'points' => ['ADP1 raw delta', 'ASP1 sparse delta', 'ALR1 low-rank delta', 'Manifest-bound artifacts']],
            ['heading' => 'Rust validation before apply', 'body' => 'The browser may fetch and checksum adapter bytes, but Rust remains the authority for semantic validation. validate_adapter_delta checks tensor identity, tokenizer identity, layout checksum, shape compatibility, finite values, sparse bounds, and low-rank dimensions before apply_adapter_delta mutates model state.', 'points' => ['validate before apply', 'Reject incompatible packages', 'Clear KV cache after success', 'Record adapter diagnostics']],
            ['heading' => 'Auto-assembly', 'body' => 'Generated roots can declare a receipt-preferred adapter stack. The browser verifies module plans, adapter-family receipts, adapter manifests, artifact byte counts, and stack budgets before Rust validation and application. Generation is authorized only after the declared stack reaches the required state.', 'points' => ['1 MiB adapter auto-apply budget', 'Module-plan phases', 'Family receipt verification', 'Stack preflight']],
        ],
    ],
    '/model-breeding/' => [
        'title' => 'Offline Model Breeding and Candidate Lineage',
        'summary' => 'Model breeding is an offline evidence pipeline: compatible parents, reproducible operators, receipts, manifests, runtime-smoke gates, eval sidecars, and selector admission.',
        'badge' => 'Offline Operators',
        'sections' => [
            ['heading' => 'Not magic, not live mutation', 'body' => 'The site presents model breeding as a governed offline artifact pipeline. Operators produce candidates, sidecars, or receipts. The browser only consumes staged and admitted artifacts after validation.', 'points' => ['Parent compatibility gate', 'Lineage templates', 'Operator receipts', 'Candidate manifests']],
            ['heading' => 'Operator suite', 'body' => 'The source describes blend, task-delta, sparse task-delta, pruning, DARE-style dropout/rescaled task-delta, federated/local-update, deterministic crossover, mutation, sign-aware merge, and seed-weighted parent-pool soup lanes. These are evidence-producing tools, not public quality claims by themselves.', 'points' => ['Blend', 'Sparse deltas', 'Prune', 'DARE', 'Crossover', 'Soup']],
            ['heading' => 'Promotion path', 'body' => 'A candidate must carry provenance and pass runtime-smoke; assistant-quality claims require evaluation sidecars with exact case evidence. Selector registries are the final browser route surface, not the start of the proof chain.', 'points' => ['Runtime-smoke', 'Evaluation evidence', 'Promotion ledger', 'Selector admission']],
        ],
    ],
    '/testing/' => [
        'title' => 'Testing and Verification',
        'summary' => 'TinyRustLM is tested through Rust unit tests, no-crate browser harness checks, WASM ABI smoke tests, browser smoke modes, route drift tests, and performance soak cycles.',
        'badge' => 'Proof Surface',
        'sections' => [
            ['heading' => 'Rust and static contract checks', 'body' => 'The source tree includes Rust tests for runtime and packer behavior, plus a mini browser harness that checks expected static IDs, local-only markers, route presence, manifest sidecars, and WASM export contracts before deeper automation.', 'points' => ['cargo test --workspace', 'tinyrustlm-browser-harness', 'Static app contract checks', 'WASM export set checks']],
            ['heading' => 'Browser smoke modes', 'body' => 'Headless browser tests prove normal and failure behavior: malformed model rejection, missing model handling, context overflow, step-token flow, adapter-sidecar application, selector registry routing, module-plan drift rejection, runtime-manifest drift, combined selector assembly, and performance soak.', 'points' => ['adapter-sidecar-registry-file', 'combined-selector-assembly', 'runtime-manifest-drift', 'step-token', 'performance soak']],
            ['heading' => 'Determinism', 'body' => 'Deterministic validation matters because tiny runtime changes can create divergent token sequences. The project avoids relaxed nondeterministic assumptions where proof requires replayability and keeps stochastic behavior bounded by fixed buffers and explicit seed paths.', 'points' => ['No relaxed SIMD for proof paths', 'Seeded sampling', 'Fixed candidate cap', 'Drift tests stop before fetch or apply']],
        ],
    ],
    '/roadmap/' => [
        'title' => 'Roadmap and Boundaries',
        'summary' => 'The roadmap focuses on proof-first expansion: stabilize the .slm runtime, improve tokenizer coverage, stage candidate models, deepen adapters, and expand browser-local composition only after validation.',
        'badge' => 'Next Work',
        'sections' => [
            ['heading' => 'Near-term', 'body' => 'Keep the site honest about current implementation: one local runtime path, strict .slm validation, q8/q4 models, deterministic fixtures, adapter stack proof, selector registry routing, local share metadata export, and clear diagnostics.', 'points' => ['Improve public docs', 'Keep llms files aligned', 'Publish support matrix', 'Add evidence-oriented examples']],
            ['heading' => 'Middle-term', 'body' => 'Expand model candidates and tokenizer handling where the runtime can prove compatibility. Add more concrete demonstrations of Pythia, Llama-style, low-vocabulary, tied-output, and BPE paths only when conversion and smoke evidence exist.', 'points' => ['Tokenizer matrix', 'Candidate model table', 'Browser demo evidence', 'Evaluation sidecars']],
            ['heading' => 'Future lanes', 'body' => 'Future work can explore multi-model routing, richer adapter ecology, OPFS persistence, Web Workers, WebGPU comparison, fixed-point deterministic math, and skill-package routing. Each lane needs a manifest, validator, test, and public-claim boundary.', 'points' => ['Multi-model routing', 'OPFS cache', 'Worker isolation', 'WebGPU comparison', 'Fixed-point fallback']],
        ],
    ],
    '/glossary/' => [
        'title' => 'TinyRustLM Glossary',
        'summary' => 'Plain definitions for the runtime, artifact, adapter, selector, and verification terms used across the project.',
        'badge' => 'Reference',
        'sections' => [
            ['heading' => '.slm', 'body' => 'TinyRustLM model artifact format. It carries the compact model payload, tensor metadata, tokenizer metadata, quantization mode, dimensions, and checksums needed by the runtime.', 'points' => []],
            ['heading' => 'q8_0', 'body' => 'An 8-bit symmetric block quantization path that stores 32 weights with a shared scale. It is the practical balance path for many tiny models.', 'points' => []],
            ['heading' => 'q4_0', 'body' => 'A 4-bit block quantization path that packs two weights per byte. It reduces memory but increases unpacking work in WASM.', 'points' => []],
            ['heading' => 'ADP1 / ASP1 / ALR1', 'body' => 'Adapter package families: raw f32 task delta, sparse f32 task delta, and low-rank task delta. They are sidecars, not replacement models.', 'points' => []],
            ['heading' => 'Selector registry', 'body' => 'A local routing file that declares which model artifacts, manifests, receipts, module plans, and adapter families are eligible for browser selection.', 'points' => []],
            ['heading' => 'Runtime-smoke', 'body' => 'Evidence that an artifact can load and execute in the runtime under a scoped test. It does not automatically mean broad assistant quality.', 'points' => []],
        ],
    ],

    '/developer-portal/' => [
        'title' => 'TinyRustLM Developer Portal',
        'summary' => 'Consolidated developer portal for the TinyRustLM Rust/WASM runtime, absorbed legacy implementation evidence, proof routes, operations notes, and current app boundary.',
        'badge' => 'Developer Portal',
        'actions' => [
            ['label' => 'Open the app', 'href' => 'https://TinyRustLM.com/'],
            ['label' => 'Open archive index', 'href' => '/docs/runtime-portal/index.md'],
            ['label' => 'Open preserved manifest', 'href' => '/docs/runtime-portal/MANIFEST.md'],
            ['label' => 'Open implementation docs', 'href' => '/docs/runtime-portal/runtime-docs/implementation/index.md'],
        ],
        'sections' => [
            [
                'heading' => 'What changed',
                'body' => 'The former standalone runtime documentation lane has been absorbed into this TinyRustLM developer portal. Durable implementation content is preserved here so the project has one implementation-facing home instead of overlapping sites.',
                'points' => ['TinyRustLM.MiRust.com is now the developer portal', 'TinyRustLM.com remains the root browser-local app', 'Legacy runtime content is preserved in /docs/runtime-portal/', 'SLMComposer.com is no longer the canonical public app identity'],
                'links' => [
                    ['label' => 'Archive index', 'href' => '/docs/runtime-portal/index.md'],
                    ['label' => 'Preservation manifest', 'href' => '/docs/runtime-portal/MANIFEST.md'],
                    ['label' => 'Runtime page registry archive', 'href' => '/docs/runtime-portal/runtime-pages.json'],
                ],
            ],
            [
                'heading' => 'Current implementation map',
                'body' => 'The active product shape is simple: users open TinyRustLM.com, import a local .slm file through the browser picker, and run it locally through Rust/WASM. A verified local import can also save checksum-bound MiniModel share metadata, and MiniModel prepare-peer-share can turn a converted local .slm into a manifest, peer-offer proof, local peer pieces, and catalog entry for later peer availability without uploading model bytes. This portal explains the runtime architecture, artifact format, adapter packages, selector manifests, proof gates, and roadmap boundaries.',
                'points' => ['Browser-local Rust/WASM runtime', 'User-selected local .slm files', 'Local share metadata export after verification', 'MiniModel prepare-peer-share after conversion', 'No hosted user model execution', 'No project-served runnable .slm model bytes', 'Hugging Face remains metadata plus local conversion handoff until a verified .slm is imported', 'P2P remains manifest and receipt gated until broader discovery is implemented'],
                'links' => [
                    ['label' => 'Runtime architecture archive', 'href' => '/docs/runtime-portal/runtime-docs/implementation/architecture.md'],
                    ['label' => 'Browser runtime archive', 'href' => '/docs/runtime-portal/runtime-docs/implementation/browser-runtime.md'],
                    ['label' => 'SLM format archive', 'href' => '/docs/runtime-portal/runtime-docs/implementation/slm-format.md'],
                ],
            ],
            [
                'heading' => 'Developer archive',
                'body' => 'The old standalone runtime pages, implementation docs, reports, source-memory notes, web-research notes, dogfood notes, package metadata, llms exports, sitemap, version marker, and health marker are preserved as static reference material. The manifest records byte counts and SHA-256 checksums for the preserved files.',
                'points' => ['184 preserved Runtime files', 'Checksum-bearing manifest', 'Implementation docs and reports retained', 'Operational notes retained as historical reference', 'No private FTP credentials or secrets copied'],
                'links' => [
                    ['label' => 'Implementation index', 'href' => '/docs/runtime-portal/runtime-docs/implementation/index.md'],
                    ['label' => 'Reports archive', 'href' => '/docs/runtime-portal/runtime-docs/reports/'],
                    ['label' => 'Package manifest archive', 'href' => '/docs/runtime-portal/package/PACKAGE-MANIFEST.md'],
                ],
            ],
            [
                'heading' => 'Proof and operations',
                'body' => 'Runtime operational checks are now portal history rather than a separate live-site identity. Use them to understand how the old plain-PHP package was verified, but use TinyRustLM.MiRust.com and TinyRustLM.com for current public documentation and app verification.',
                'points' => ['Developer claims stay evidence-bound', 'Runtime health notes are preserved, not current separate-site authority', 'Current deploy verification targets TinyRustLM.MiRust.com and TinyRustLM.com', 'Pointer memory stays checksum-bearing and links to durable docs'],
                'links' => [
                    ['label' => 'Testing archive', 'href' => '/docs/runtime-portal/runtime-docs/implementation/testing.md'],
                    ['label' => 'Launch operations archive', 'href' => '/docs/runtime-portal/package/DEPLOYMENT.md'],
                    ['label' => 'Current report index', 'href' => '/docs/report-index.md'],
                ],
            ],
        ],
        'cards' => [
            ['title' => 'Current app', 'text' => 'TinyRustLM.com is the simple root-domain browser-local Rust/WASM app.', 'href' => 'https://TinyRustLM.com/', 'link_label' => 'Open app'],
            ['title' => 'Legacy runtime archive', 'text' => 'Current index and checksum manifest for the runtime documentation corpus consolidated into this portal.', 'href' => '/docs/runtime-portal/index.md', 'link_label' => 'Open archive'],
            ['title' => 'Implementation docs', 'text' => 'Preserved architecture, browser runtime, .slm, tokenizer, quantization, testing, and workspace references.', 'href' => '/docs/runtime-portal/runtime-docs/implementation/index.md', 'link_label' => 'Open docs'],
            ['title' => 'Current memory', 'text' => 'TinyRustLM UAI memory and long-term pointers remain separate from the preserved Runtime archive.', 'href' => '/docs/', 'link_label' => 'Open docs home'],
        ],
    ],

    '/docs/' => [
        'title' => 'TinyRustLM Docs and UAI Memory',
        'summary' => 'Durable report archive, long-term memory, and .uai file-memory routes for the TinyRustLM plain PHP project site.',
        'badge' => 'Docs + Memory',
        'actions' => [
            ['label' => 'Open long-term memory', 'href' => '/docs/long-term-memory.md'],
            ['label' => 'Open report index', 'href' => '/docs/report-index.md'],
            ['label' => 'Open developer portal', 'href' => '/developer-portal/'],
            ['label' => 'Open .uai index', 'href' => '/.uai/index.uai'],
        ],
        'sections' => [
            [
                'heading' => 'Docs folder purpose',
                'body' => 'The docs folder preserves the full report bodies and long-term project memory behind the public TinyRustLM site. The .uai files stay compact and deep-link into these durable Markdown targets instead of duplicating all report text inside hot memory.',
                'points' => ['Report bodies in /docs/reports/', 'Long-term body memory in /docs/long-term-memory.md', 'Report manifest in /docs/report-index.md', 'Package manifest in /docs/package-manifest.md'],
                'links' => [
                    ['label' => 'Report index', 'href' => '/docs/report-index.md'],
                    ['label' => 'Long-term memory', 'href' => '/docs/long-term-memory.md'],
                ],
            ],
            [
                'heading' => 'Runtime developer portal consolidation',
                'body' => 'Legacy runtime implementation material has been consolidated into TinyRustLM.MiRust.com. The preserved runtime corpus now lives under /docs/runtime-portal/ with a checksum manifest, while /developer-portal/ is the current human-readable entry point.',
                'points' => ['Developer portal route: /developer-portal/', 'Preserved Runtime manifest: /docs/runtime-portal/MANIFEST.md', 'Runtime page registry archive: /docs/runtime-portal/runtime-pages.json', 'Implementation docs archive: /docs/runtime-portal/runtime-docs/implementation/'],
                'links' => [
                    ['label' => 'Developer portal', 'href' => '/developer-portal/'],
                    ['label' => 'Runtime preservation manifest', 'href' => '/docs/runtime-portal/MANIFEST.md'],
                ],
            ],
            [
                'heading' => 'UAI file-memory route',
                'body' => 'The .uai folder follows a project handoff shape: startup packet, system profile, receiver brief, index, context, constraints, progress, operations, test plan, coding standards, architecture, next recursive prompt, decisions, memory, short-term memory, long-term pointer ledger, file handoff, and intake ledger.',
                'points' => ['Start at /.uai/index.uai', 'Use /.uai/long-term-memory.uai as pointer ledger', 'Use /.uai/file-handoff.uai before processing new drops', 'Record future report dispositions in /.uai/intake-outcome-ledger.uai'],
                'links' => [
                    ['label' => '.uai index', 'href' => '/.uai/index.uai'],
                    ['label' => '.uai long-term ledger', 'href' => '/.uai/long-term-memory.uai'],
                ],
            ],
            [
                'heading' => 'Preserved report set',
                'body' => 'The package preserves the attached TinyRustLM, Rust/WASM, tiny language model, memory systems, native web, vanilla JavaScript, agent-readable web, and virality reports as source evidence under /docs/reports/.',
                'points' => ['11 preserved report/source files', 'Stable filenames', 'SHA-256 checksums', 'Deep links from .uai long-term memory'],
                'links' => [
                    ['label' => 'Open report manifest', 'href' => '/docs/report-index.md'],
                    ['label' => 'Open package manifest', 'href' => '/docs/package-manifest.md'],
                ],
            ],
        ],
        'cards' => [
            ['title' => 'Long-term memory', 'text' => 'Durable current truth boundary, implementation memory, report routes, and next recursive direction.', 'href' => '/docs/long-term-memory.md', 'link_label' => 'Open memory'],
            ['title' => 'Report index', 'text' => 'Manifest of preserved reports with source filenames, roles, byte counts, and checksums.', 'href' => '/docs/report-index.md', 'link_label' => 'Open index'],
            ['title' => 'Legacy runtime archive', 'text' => 'Checksum-bearing preservation index and manifest for the former standalone runtime developer corpus.', 'href' => '/docs/runtime-portal/index.md', 'link_label' => 'Open archive'],
            ['title' => '.uai pointer ledger', 'text' => 'Compact long-term pointer records that deep-link to durable docs and reports.', 'href' => '/.uai/long-term-memory.uai', 'link_label' => 'Open ledger'],
            ['title' => 'File handoff', 'text' => 'Rules for future active Content and Improvement bucket intake.', 'href' => '/.uai/file-handoff.uai', 'link_label' => 'Open handoff'],
        ],
    ],

    '/contact/' => [
        'title' => 'Contact Mike Kappel About TinyRustLM',
        'summary' => 'Direct contact page for TinyRustLM project questions, architecture review, Rust/WASM local-model discussion, and software engineering follow-up with Mike Kappel.',
        'badge' => 'Contact',
        'actions' => [
            ['label' => 'Email Mike', 'href' => 'mailto:mike@ns12.com'],
            ['label' => 'Call Mike', 'href' => 'tel:+16303627576'],
            ['label' => 'Open MJK.tel', 'href' => 'https://mjk.tel/'],
        ],
        'sections' => [
            [
                'heading' => 'Primary contact route',
                'body' => 'Use this page for TinyRustLM project questions, browser-local AI runtime review, Rust/WASM architecture discussion, plain PHP site feedback, and collaboration routing. The public contact details mirror Mike Kappel\'s published portfolio and contact hub information.',
                'points' => ['Email: mike@ns12.com', 'Phone: (630) 362-7576', 'Signal: Mike.7576', 'Location: Cicero, IL'],
                'links' => [
                    ['label' => 'Email Mike', 'href' => 'mailto:mike@ns12.com'],
                    ['label' => 'Call Mike', 'href' => 'tel:+16303627576'],
                ],
            ],
            [
                'heading' => 'Professional context',
                'body' => 'Mike Kappel is presented publicly as a Senior Software Engineer and Software Architect focused on enterprise modernization, .NET and SQL Server systems, TypeScript/Angular front ends, and human-reviewed AI-assisted engineering. TinyRustLM should route technical conversations through that professional engineering context rather than framing the site as a generic AI product contact page.',
                'points' => ['Senior Software Engineer / Software Architect', 'AI / .NET / SQL / TypeScript', 'Legacy modernization and architecture review', 'Human-reviewed AI-assisted engineering'],
                'links' => [
                    ['label' => 'Open MikeKappel.com', 'href' => 'https://mikekappel.com/'],
                    ['label' => 'Open portfolio contact page', 'href' => 'https://mikekappel.com/contacts/'],
                ],
            ],
            [
                'heading' => 'Public profiles and contact hub',
                'body' => 'MJK.tel is the compact contact hub for phone, Signal, personal domains, and public profiles. Keep this TinyRustLM page focused on project contact while linking out to the broader contact hub for alternate routes and social profiles.',
                'points' => ['Contact hub: MJK.tel', 'LinkedIn profile', 'GitHub profile', 'NuGet package profile', 'Photography and public media archive'],
                'links' => [
                    ['label' => 'MJK.tel contact hub', 'href' => 'https://mjk.tel/'],
                    ['label' => 'LinkedIn', 'href' => 'https://www.linkedin.com/in/michaelkappel/'],
                    ['label' => 'GitHub', 'href' => 'https://github.com/MichaelKappel'],
                    ['label' => 'NuGet', 'href' => 'https://www.nuget.org/profiles/Michael.Kappel'],
                ],
            ],
        ],
        'cards' => [
            ['title' => 'Email', 'text' => 'Fastest written contact route for TinyRustLM project discussion and architecture review.', 'href' => 'mailto:mike@ns12.com', 'link_label' => 'mike@ns12.com'],
            ['title' => 'Phone', 'text' => 'Primary public phone contact from the portfolio and contact hub.', 'href' => 'tel:+16303627576', 'link_label' => '(630) 362-7576'],
            ['title' => 'Contact hub', 'text' => 'Compact public hub for phone, Signal, personal domains, and social profiles.', 'href' => 'https://mjk.tel/', 'link_label' => 'Open MJK.tel'],
            ['title' => 'Code profile', 'text' => 'Public GitHub profile for source and project context.', 'href' => 'https://github.com/MichaelKappel', 'link_label' => 'Open GitHub'],
        ],
    ],
];
