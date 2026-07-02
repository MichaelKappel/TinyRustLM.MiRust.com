# SLM Composer Source Options UI v1.0.7

Updated UTC: 2026-07-02T16:40:00Z

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
- Hugging Face is a metadata and external discovery path. Results are not treated as runnable in TinyRustLM unless MiniModel metadata identifies an admitted `.slm` with peer-offer proof. Otherwise the UI saves a local `minimodel.huggingface_conversion_request.v0` handoff plus an optional `.tinyrustlm-convert.ps1` script for review, conversion, Rust validation, and future peer availability. The script runs `inspect-safetensors`, `plan-safetensors-source`, `convert-safetensors-trained`, `validate`, and `validate-manifest` against user-owned local files, then calls `minimodel prepare-peer-share` to write the MiniModel manifest, peer-offer proof, local peer pieces, and catalog entry in one directory; it does not download model bytes. Project servers do not proxy `/resolve/` model bytes and do not use project-owned Hugging Face tokens.
- P2P Exchange is MiniModel metadata, Rust `.minimodel-peer-offer` proof, direct known-peer `serve-peer-pieces` / `fetch-peer-pieces`, one-command `prepare-peer-share` sender execution, one-command `import-peer-request` receiver execution, and local reassembly for converted `.slm` records now; broader discovery/relay remains later, still gated by manifest verification, chunk/Merkle verification, and local import receipts.
- After a verified local `.slm` import, TinyRustLM can save `minimodel.local_slm_share_metadata.v0` with the artifact SHA256, fixed-size chunk SHA256 entries, chunk-list SHA256, and Merkle root. MiniModel `prepare-peer-share` can also produce `.minimodel-peer-offer` proof text plus local peer pieces from a converted `.slm`. Catalog/project servers still do not host the model bytes.

All source lanes must converge on a local `.slm` file before SLM Composer runs generation. Rust/WASM remains the final `.slm` validation authority.

The Search Metadata action must keep the source chooser open, update the visible result list, show `Rust conversion required` for unmatched Hub model cards, and avoid any Hugging Face `/resolve/` model-byte fetch. The simple Hugging Face list has one `Enable P2P when available` toggle, defaults P2P on, shows `P2P Import` only when MiniModel metadata includes peer-offer proof plus a validated catalog `peer_sources` row or saved Known peer URL, shows `Set Peer URL` for proof-ready rows without a known source, shows `Start Conversion` otherwise, and shows one list-level warning when P2P is disabled. A proof-ready result means a MiniModel catalog entry produced from an admitted `.slm` manifest and `.minimodel-peer-offer`, normally with `peer_hint_status=peer-offer-ready-known-peer-needed`, `peer_import_status=request-script-ready`, and optional `peer_source_count` / `peer_sources` metadata. P2P import rejects project/Hugging Face hosts, then saves a local `minimodel.peer_import_request.v0` JSON handoff plus a `.minimodel-peer-import.ps1` script bound to that consenting direct `http://` peer; the script runs `minimodel import-peer-request <request-json> <manifest> <output-dir>` so Rust validates the request against the manifest, fetches from the known peer URL, assembles/verifies the `.slm`, and writes the import receipt, while the same handoff names the peer-side `serve-peer-pieces` command so the sender has a real counterpart. The lower-level Save Rust Conversion Script and Save Conversion Request controls remain Advanced Tools details and must also keep the chooser open after local handoff files are downloaded.

The implementation keeps Hugging Face compatibility decisions centralized through a shared row view model and shared DOM/action builders. The `hf-search-ui` browser smoke asserts the exact simple primary actions (`Start Conversion` plus `P2P Import` while P2P is enabled, then two `Start Conversion` actions when P2P is disabled), verifies that the disabled-P2P warning remains one list-level control rather than a repeated per-row warning, proves generated conversion scripts include `prepare-peer-share`, and proves `P2P Import` writes the saved known peer URL into the peer-import request/script with one-command `import-peer-request` receiver execution and peer-side `serve-peer-pieces` guidance without requesting Hugging Face or project-hosted model bytes.

The Share Metadata action must stay disabled until a local `.slm` is verified. When enabled it writes JSON locally through the browser download flow; it does not upload, relay, or publish model bytes.

## Deployment Gate

Deploying this UI requires updating the public app files under TinyRustLM.com `/` and keeping related documentation sites aligned:

- Runtime.MiRust.com documents the runtime and implementation boundary.
- TinyRustLM.MiRust.com documents the tiny-model runtime and browser-local behavior.
- MiniModel.org documents the metadata-only catalog, verifier, Hugging Face source lane, and future P2P exchange.

The live site should not be called updated until `https://TinyRustLM.com/` visibly shows `Chat`, `Advanced Tools`, starter profiles, the three source choices, the Hugging Face `Enable P2P when available` toggle, and the corrected `P2P Import` / `Start Conversion` action model on first load.
