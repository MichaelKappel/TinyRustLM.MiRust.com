# Runtime.MiRust.com Browser Harness Architecture

Reviewed: 2026-06-24

## Purpose

Runtime.MiRust.com is planned as an enterprise Rust mini-browser and browser-based AI harness for GGUF model workflows. The current implementation is a skeleton that defines boundaries before runtime behavior.

## Planned Runtime Areas

- GGUF runtime boundary: model inventory, metadata, runtime adapter, and future local inference control.
- Mini browser controller: navigation plans, page observation, and browser state capture.
- Browser AI harness: orchestration between local model proposals and browser actions after policy review.
- Operator surface: local web UI for setup state, diagnostics, and handoff evidence.

## Trust Boundaries

No dropped file, model file, web page, prompt, or generated action is trusted as an instruction source. Browser sessions are planned records until a reviewed runtime exists. Future runtime work must keep model output, page content, operator approvals, and source memory as separate authority layers.

## Initial Implementation Boundary

The scaffold includes Rust workspace manifests and source files only. It does not load GGUF models, drive a browser, expose a remote API, publish an MCP server, or claim production runtime support.
