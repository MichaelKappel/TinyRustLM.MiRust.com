<?php
return [
    '/' => [
        'title' => 'TinyRustLM Developer Documentation',
        'summary' => 'Current prelaunch documentation for the browser-local TinyRustLM Rust/WebAssembly product and its sole SLM2 path.',
        'badge' => 'Developer Portal',
        'actions' => [
            ['label' => 'Open TinyRustLM.com', 'href' => 'https://TinyRustLM.com/'],
            ['label' => 'Open developer portal', 'href' => '/developer-portal/'],
        ],
        'sections' => [
            [
                'heading' => 'One clean-slate product',
                'body' => 'TinyRustLM is one not-yet-released browser-local product. SLM2, Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 are technical identities, not product generations. Current paths do not retain legacy readers, compatibility aliases, fallback inference, response repair, hidden retries, or best-of-N behavior.',
                'points' => ['One current SLM2 contract', 'Rust owns model semantics', 'Browser owns the user experience', 'Evidence gates remain independent'],
            ],
            [
                'heading' => 'P2P-first and local',
                'body' => 'Exact qualified composition bytes may move directly between consenting peers. If no exact qualified peer composition is available, an installed local companion may perform an explicit pinned local conversion. TinyRustLM and MiniModel project sites receive no prompts and do not proxy model bytes.',
                'points' => ['Direct consenting peer transfer', 'Explicit local conversion', 'No hosted inference', 'No project-site model-byte proxy'],
            ],
            [
                'heading' => 'Two MemoryEndpoints.com uses',
                'body' => 'Ecosystem agents use MemoryEndpoints.com directly for agent-to-agent long-term memory, meetings, handoffs, and coordination. Separately, the TinyRustLM.com Connect plugin lets a user sign in and explicitly select MemoryEndpoints.com as TinyRustLM.com Connect long-term memory. The lanes keep identities, credentials, consent, scopes, provenance, and receipts separate.',
                'points' => ['Direct agent coordination', 'Separate TinyRustLM.com Connect user plugin', 'Explicit consent and scopes', 'No live claim without receipts'],
                'links' => [
                    ['label' => 'Memory policy', 'href' => '/docs/long-term-memory.md'],
                ],
            ],
        ],
        'cards' => [
            ['title' => 'Current composition', 'text' => 'Six exact SLM2 members bind model, tokenizer, template, sampling, prompt, and composition identity.'],
            ['title' => 'Evidence first', 'text' => 'Structure, numerical parity, quality, browser execution, P2P availability, memory continuity, and release are separate gates.'],
            ['title' => 'Prelaunch redundancy', 'text' => 'Current .uai, wiki, public-safe notes, and approved private stores may duplicate memory only while synchronized and secret-safe.'],
        ],
    ],
    '/architecture/' => [
        'title' => 'TinyRustLM Architecture',
        'summary' => 'The current authority boundaries for Rust, WebAssembly, browser UI, companion operations, and evidence.',
        'badge' => 'Architecture',
        'sections' => [
            [
                'heading' => 'Rust authority',
                'body' => 'Rust owns hostile-safe parsing, model and tensor semantics, Tokenizer2, Template2, Prompt2, Sampling2, inference mathematics, conversion, independent inspection boundaries, and direct-piece admission. The same semantic authority is compiled for native and WebAssembly execution.',
                'points' => ['Checked bounded parsing', 'Independent artifact inspection', 'Typed errors', 'No permissive repair'],
            ],
            [
                'heading' => 'Browser authority',
                'body' => 'The browser presents the conversation workspace and transports bounded typed commands and events. A dedicated worker owns model and KV state. Cancellation stops actual work; a terminated or poisoned worker is replaced and reopens immutable verified bytes before another generation.',
                'points' => ['Dedicated worker ownership', 'Exactly-once rendering identity', 'Real cancellation', 'Fresh-worker verification'],
            ],
            [
                'heading' => 'Companion boundary',
                'body' => 'An installed local companion may perform explicit acquisition, conversion, verification, and storage operations through a narrow authenticated origin-bound API. It does not accept arbitrary commands, paths, or unrestricted URLs from a page.',
                'points' => ['Origin-bound session', 'Least privilege', 'Explicit user presence', 'No text-file handoff as acquisition'],
            ],
        ],
    ],
    '/runtime/' => [
        'title' => 'TinyRustLM Runtime',
        'summary' => 'Current numerical-authority and execution boundaries for one SLM2 model composition.',
        'badge' => 'Runtime',
        'sections' => [
            [
                'heading' => 'Reference chain',
                'body' => 'The proof chain is pinned source framework to converted scalar-native reference, optimized native kernels, and browser WebAssembly kernels. Every arrow requires explicit differential evidence; final text alone is not a numerical oracle.',
                'points' => ['Pinned source oracle', 'Scalar-native authority', 'Optimized native differential path', 'Browser-WASM differential path'],
            ],
            [
                'heading' => 'Failure behavior',
                'body' => 'Malformed artifacts, unsupported quantization, allocation failure, context overflow, invalid tokens, nonfinite values, cancellation, timeout, and internal invariant failures terminate with typed errors. They do not become truncated successful answers or trigger hidden fallback.',
                'points' => ['Fail closed', 'No silent fallback', 'No response repair', 'No hidden retry'],
            ],
        ],
    ],
    '/slm-format/' => [
        'title' => 'SLM2 Composition Format',
        'summary' => 'The sole current six-member composition identity and hostile-safe verification boundary.',
        'badge' => 'Format',
        'sections' => [
            [
                'heading' => 'Exact member set',
                'body' => 'A complete composition contains model.slm2, tokenizer.tokenizer2, template.template2, sampling.sampling2, prompt.prompt2, and composition.acg2. Paths are not identities; the composition binds exact logical names, sizes, content digests, schema identities, source locks, and profile identities.',
                'points' => ['Exact six-member closure', 'No extra or missing members', 'Content-addressed identity', 'Source and profile binding'],
            ],
            [
                'heading' => 'Independent acceptance',
                'body' => 'The verifier recomputes file type, length, digest, inventory, path containment, tensor closure, tokenizer binding, and cross-member consistency. Producer receipts are claims, not substitutes for recomputation.',
                'points' => ['Bounded readers', 'Checked offsets and counts', 'No path traversal or aliasing', 'No producer-trust shortcut'],
            ],
        ],
    ],
    '/quantization/' => [
        'title' => 'Quantization Contract',
        'summary' => 'How converted numeric representation remains explicit, bounded, and testable.',
        'badge' => 'Numerics',
        'sections' => [
            [
                'heading' => 'Representation before speed',
                'body' => 'Quantized tensors bind signed range, scale placement, grouping, packing order, tail behavior, accumulator width, and deterministic dequantization. Unsupported features are rejected rather than approximated silently.',
                'points' => ['Explicit group profile', 'Finite scales only', 'Checked tails and packing', 'Deterministic reconstruction'],
            ],
            [
                'heading' => 'Noninferiority gate',
                'body' => 'Converted scalar, optimized native, and browser-WASM execution use the same prompts, token IDs, positions, seeds, sampling profile, and stop policy. Quantization and kernel differences are localized before behavioral qualification.',
                'points' => ['Layerwise comparison', 'Preregistered thresholds', 'No tolerance tuning after failure', 'No lucky-seed selection'],
            ],
        ],
    ],
    '/browser-runtime/' => [
        'title' => 'Browser Runtime',
        'summary' => 'Real-browser worker ownership, memory, privacy, cancellation, and recovery requirements.',
        'badge' => 'Browser',
        'sections' => [
            [
                'heading' => 'Real browser proof',
                'body' => 'Chromium execution is the first required browser proof. Node or a standalone WebAssembly harness is not browser evidence. Exact browser build, module hash, composition identity, network summary, resource bounds, and profile lifecycle remain part of the receipt.',
                'points' => ['Chromium first proof', 'Bounded peak-memory model', 'No whole-file copy assumptions', 'Exact browser identity'],
            ],
            [
                'heading' => 'Privacy and isolation',
                'body' => 'Cross-origin isolation, CSP, service-worker behavior, and a network allowlist are release contracts. The site receives no prompts or model bytes. Unexpected telemetry, beacons, third parties, or credential-bearing URLs fail the privacy gate.',
                'points' => ['COOP and COEP', 'CSP and explicit allowlist', 'No prompt upload', 'No implicit telemetry'],
            ],
        ],
    ],
    '/adapters/' => [
        'title' => 'Adapter Research Boundary',
        'summary' => 'Adapter work remains outside the first-model release path unless separately specified and proven.',
        'badge' => 'Research Only',
        'sections' => [
            [
                'heading' => 'Not a current release claim',
                'body' => 'The first release path is one exact qualified SLM2 composition. Adapter formats, selection, composition, and training require separate source, numerical, quality, security, and browser evidence before they can become current product behavior.',
                'points' => ['No implicit adapter support', 'No compatibility path', 'Separate qualification required', 'Unsupported features reject'],
            ],
        ],
    ],
    '/model-breeding/' => [
        'title' => 'Model Experiment Boundary',
        'summary' => 'Training and model-combination ideas are research, not first-release capability.',
        'badge' => 'Research Only',
        'sections' => [
            [
                'heading' => 'No evaluation leakage',
                'body' => 'Failed evaluation prompts, holdouts, expected answer concepts, and private outputs do not become training data. A rejected model may lead to a new source or contamination-controlled experiment with a new sealed holdout, never a lowered gate.',
                'points' => ['Sealed holdouts', 'No training on failures', 'No evaluator rewriting to favor a model', 'Honest reject is allowed'],
            ],
        ],
    ],
    '/testing/' => [
        'title' => 'Testing And Evidence',
        'summary' => 'Typed, immutable evidence for contracts, numerics, browser behavior, privacy, and release.',
        'badge' => 'Verification',
        'sections' => [
            [
                'heading' => 'Contract and hostile-input tests',
                'body' => 'Rust, .NET, and JavaScript consume shared canonical vectors but keep independent semantic validators. Differential, property, mutation, fuzz, path-security, and crash tests fail on disagreement; no majority vote selects a permissive result.',
                'points' => ['Canonical vectors', 'Independent validators', 'Typed verdict parity', 'Preserved counterexamples'],
            ],
            [
                'heading' => 'Evidence boundaries',
                'body' => 'Source, fixtures, reports, packages, local probes, and reachable pages are bounded facts. They do not prove real model quality, public P2P, live MemoryEndpoints use, browser release, deployment, or campaign progress without exact matching receipts.',
                'points' => ['Immutable failures', 'No inflated claims', 'Public-safe summaries', 'Private raw evidence remains private'],
            ],
        ],
    ],
    '/roadmap/' => [
        'title' => 'First-Model Roadmap',
        'summary' => 'The ordered proof path from corrected contracts to one real browser-local model.',
        'badge' => 'Roadmap',
        'sections' => [
            [
                'heading' => 'Ordered gates',
                'body' => 'Complete the sole receipt contract, register and execute a wholly new conversion, independently inspect the six-member composition, prove scalar and optimized native parity, prove browser-WASM parity, qualify model behavior, prove acquisition, complete a clean-profile conversation round, then release and verify public HTTPS bytes.',
                'points' => ['Contract', 'New conversion', 'Composition inspection', 'Native and browser parity', 'Quality', 'Acquisition', 'Clean browser', 'Release readback'],
            ],
            [
                'heading' => 'Current counters',
                'body' => 'Campaign counters remain 0/20 qualified models, 0/50 clean browser rounds, 0/25 live MemoryEndpoints rounds, 0/40 externally proven P2P lanes, and 0/20 live catalog announcements until exact evidence exists.',
                'points' => ['No fixture credit', 'No source-only credit', 'No local-lane public credit', 'No configured-service credit'],
            ],
        ],
    ],
    '/glossary/' => [
        'title' => 'TinyRustLM Glossary',
        'summary' => 'Current technical identities and evidence terms.',
        'badge' => 'Reference',
        'sections' => [
            [
                'heading' => 'Technical identities',
                'body' => 'SLM2 identifies the model format. Tokenizer2, Template2, Sampling2, Prompt2, and ACG2 identify composition members and contracts. These names do not denote product generations.',
                'points' => ['SLM2: model format', 'ACG2: composition identity', 'Connect: explicit user integration surface', 'Qualified: evidence-bound claim'],
            ],
            [
                'heading' => 'Evidence words',
                'body' => 'Implemented, locally tested, independently verified, deployed, published, live, qualified, and complete are different claims. Use the narrowest term supported by exact evidence.',
                'points' => ['Source is not execution', 'Execution is not quality', 'Reachability is not live use', 'Deployment requires readback'],
            ],
        ],
    ],
    '/developer-portal/' => [
        'title' => 'TinyRustLM Developer Portal',
        'summary' => 'Current architecture, contracts, evidence boundaries, and package surfaces for the prelaunch product.',
        'badge' => 'Developer Portal',
        'actions' => [
            ['label' => 'Open the app', 'href' => 'https://TinyRustLM.com/'],
            ['label' => 'Open memory authority', 'href' => '/docs/long-term-memory.md'],
        ],
        'sections' => [
            [
                'heading' => 'Current managed graph',
                'body' => 'The default public package transaction is exactly TinyRustLM.Abstractions, TinyRustLM.Core, and TinyRustLM.P2P. TinyRustLM.MemoryEndpoints is the separately optional connector for the two authorized MemoryEndpoints.com uses and is excluded from that default transaction. Conversion authoring remains private. Package creation is not public publication.',
                'points' => ['Narrow default public API', 'Checked native boundary', 'Direct-piece P2P contract', 'Optional two-use memory connector'],
            ],
            [
                'heading' => 'MemoryEndpoints authority',
                'body' => 'Agents use MemoryEndpoints.com directly for ecosystem coordination. Separately, users may explicitly select it through the TinyRustLM.com Connect plugin. Credentials, consent, scopes, provenance, idempotency, and receipts stay separate, and service reachability is not live proof.',
                'points' => ['Two distinct uses', 'No credential sharing', 'No silent uploads', 'Receipt-backed claims'],
            ],
            [
                'heading' => 'Publication status',
                'body' => 'Last published: 1.8.0. Release date: 2026-08-28. Update: current SLM2, acquisition, privacy, evidence, package, and MemoryEndpoints contracts replace superseded active prose.',
                'points' => ['Clean committed source required', 'Complete site gate required', 'Deployment from exact revision required', 'Public HTTPS readback required'],
            ],
        ],
    ],
    '/docs/' => [
        'title' => 'Documentation Index',
        'summary' => 'Current product, protocol, security, memory, and evidence references.',
        'badge' => 'Documentation',
        'sections' => [
            [
                'heading' => 'Current references',
                'body' => 'Use the live architecture, runtime, SLM2, browser, testing, roadmap, glossary, developer portal, and long-term-memory policy routes. Historical runtime material is retained only as clearly labeled evidence and does not authorize obsolete behavior.',
                'points' => ['Architecture', 'Runtime', 'SLM2', 'Browser', 'Testing', 'Roadmap', 'Glossary', 'Memory policy'],
                'links' => [
                    ['label' => 'Architecture', 'href' => '/architecture/'],
                    ['label' => 'SLM2 format', 'href' => '/slm-format/'],
                    ['label' => 'Memory policy', 'href' => '/docs/long-term-memory.md'],
                ],
            ],
        ],
    ],
    '/updates/' => [
        'title' => 'Publication Updates',
        'summary' => 'Truthful source, deployment, and readback status for the current documentation.',
        'badge' => 'Updates',
        'sections' => [
            [
                'heading' => 'Current source update',
                'body' => 'Last published: 1.8.0. Release date: 2026-08-28. Update: stale active runtime/package prose was replaced with current clean-slate SLM2, direct-P2P, privacy, evidence, and two-lane MemoryEndpoints authority.',
                'points' => ['Documentation release only', 'No package publication claim', 'No model release claim', 'No campaign credit'],
            ],
            [
                'heading' => 'Release gate',
                'body' => 'Publication requires a clean committed revision, complete affected-site tests, deployment from that exact revision, and verified public HTTPS bytes and headers. A reachable development page does not satisfy this gate.',
                'points' => ['Commit equality', 'Complete tests', 'Atomic deployment', 'Exact HTTPS readback'],
            ],
        ],
    ],
    '/contact/' => [
        'title' => 'TinyRustLM Contact',
        'summary' => 'Public project contact routes for architecture and documentation discussion.',
        'badge' => 'Contact',
        'actions' => [
            ['label' => 'Email Mike', 'href' => 'mailto:mike@ns12.com'],
            ['label' => 'Open MJK.tel', 'href' => 'https://mjk.tel/'],
        ],
        'sections' => [
            [
                'heading' => 'Project contact',
                'body' => 'Use the public contact routes for TinyRustLM architecture, browser-local runtime, documentation, security-boundary, and collaboration questions. Do not send credentials, invitation URLs, private prompts, model bytes, or raw private evidence.',
                'points' => ['Email: mike@ns12.com', 'Public contact hub: MJK.tel', 'No secret material', 'No private model or prompt transfer'],
            ],
        ],
    ],
];
