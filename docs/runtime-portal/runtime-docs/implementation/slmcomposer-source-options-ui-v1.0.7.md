# SLM Composer Source Options UI v1.0.7

Updated UTC: 2026-07-01T21:20:00Z

This note records the SLMComposer.com UI change driven by the 2026-07-01 UI improvement report. The source change belongs in the active Rust/WASM workspace at `E:\Source\Rust\SLMComposer.com`; Runtime.MiRust.com documents the runtime and public claim boundary.

## What Changed

SLM Composer now defaults to a beginner `Chat` mode instead of exposing the full expert dashboard on first load.

The first screen is organized around:

- starter profiles: `Fast & Lightweight`, `Everyday Chat`, and `Precise & Repeatable`
- model source choices: `Your Local Files`, `Hugging Face`, and `P2P Exchange`
- semantic response controls under `Response Style`
- the prompt box and `Generate`

Technical controls remain available under `Advanced Tools`, including exact model names, max token count, decoding parameters, local import details, MiniModel catalog URL, Hugging Face metadata search, adapter controls, diagnostics tabs, module-plan proof, provenance proof, token console, benchmark data, and run history.

## Source Boundaries

The three source choices do not change the security model:

- Local files are the runnable path. Users choose `.slm` files through the browser file picker.
- Hugging Face is a metadata and external discovery path. Project servers do not proxy `/resolve/` model bytes and do not use project-owned Hugging Face tokens.
- P2P Exchange is a future MiniModel.org path for consent-based peer transfer, manifest verification, chunk/Merkle verification, and local import receipts.

All source lanes must converge on a local `.slm` file before SLM Composer runs generation. Rust/WASM remains the final `.slm` validation authority.

## Deployment Gate

Deploying this UI requires updating the public app files under SLMComposer.com `/app/` and keeping related documentation sites aligned:

- Runtime.MiRust.com documents the runtime and implementation boundary.
- TinyRustLM.MiRust.com documents the tiny-model runtime and browser-local behavior.
- MiniModel.org documents the metadata-only catalog, verifier, Hugging Face source lane, and future P2P exchange.

The live site should not be called updated until `https://slmcomposer.com/app/` visibly shows `Chat`, `Advanced Tools`, starter profiles, and the three source choices on first load.
