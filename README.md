# TinyRustLM.MiRust.com

TinyRustLM.MiRust.com is the prelaunch developer portal for TinyRustLM.com.
It documents the current browser-local Rust/WebAssembly product, its evidence
boundaries, and the sole clean-slate SLM2 path. It does not host inference,
model weights, prompts, or private memory payloads.

## Current Product Boundary

TinyRustLM is one not-yet-released product. SLM2, Tokenizer2, Template2,
Sampling2, Prompt2, and ACG2 are technical identities, not product
generations. Current production code and documentation must not retain legacy
readers, aliases, compatibility branches, hidden fallback, response repair,
hidden retry, or best-of-N behavior.

TinyRustLM.com has exactly one authoritative source checkout. Source work stops
unless its canonical path, branch, origin, local HEAD, tracking ref,
`FETCH_HEAD`, direct remote ref, and clean status agree. Duplicate trees are
frozen, audited, semantically consolidated only for valid current work, and
retired; historical executable source belongs only in Git history.

A complete installed model composition has exactly these semantic members:

- `model.slm2`
- `tokenizer.tokenizer2`
- `template.template2`
- `sampling.sampling2`
- `prompt.prompt2`
- `composition.acg2`

The default public package transaction is exactly:

- `TinyRustLM.Abstractions`
- `TinyRustLM.Core`
- `TinyRustLM.P2P`

`TinyRustLM.MemoryEndpoints` is the separately optional connector for the two
authorized MemoryEndpoints.com uses. It is excluded from the default package
transaction so each consumer explicitly controls credentials and network
authority. Conversion authoring and other private implementation surfaces are
not public packages. Package creation or a local test pass is not public
readback and is not publication.

## Acquisition And Privacy

Model acquisition is P2P-first. Exact qualified composition bytes may move
directly between consenting peers. When no exact qualified peer composition is
available, an installed local companion may perform an explicit, pinned local
conversion. Project sites do not proxy model bytes and receive no prompts.

Catalog metadata, peer availability, composition qualification, browser
execution, and model quality are separately evidenced claims. Configuration,
fixtures, local probes, or reachable pages do not prove any of them.

## MemoryEndpoints.com

MemoryEndpoints.com has exactly two distinct authorized uses in this
ecosystem:

1. Ecosystem agents use MemoryEndpoints.com directly for agent-to-agent
   long-term memory, meetings, handoffs, and coordination across all maintained
   sites.
2. Separately, the TinyRustLM.com Connect plugin lets a user sign in to
   MemoryEndpoints.com and explicitly select it as TinyRustLM.com Connect
   long-term memory.

The two lanes keep identities, credentials, consent, scopes, provenance,
idempotency, and receipts separate. Neither lane silently authorizes the
other. Source code, configuration, or service reachability does not prove a
live meeting, synchronization, restore, deletion, or user-plugin lifecycle.

During prelaunch, important memory may also be retained in current `.uai`,
wiki, source-controlled public-safe notes, and approved private stores for
resilience. Every maintained copy must remain current, secret-safe,
provenance-labeled, and noncontradictory.

## Evidence Status

The preserved Qwen3 composition attempt `/10` is an immutable terminal
failure. Its candidate bytes cannot be repaired, retried, adopted, promoted,
or published. A source correction is not retrospective execution evidence.

Campaign counters remain `0/20` qualified models, `0/50` clean browser rounds,
`0/25` live MemoryEndpoints rounds, `0/40` externally proven P2P lanes, and
`0/20` catalog announcements until exact matching receipts exist.

## Publication

- Prepared source package: `1.8.3` (`2026-08-31`).
- Prepared status: awaiting a real content commit, commit-bound manifest,
  deployment, and HTTPS readback; this working tree is not publication evidence.
- Last verified publication: `1.8.2` (`2026-08-29`), preserved by its immutable
  deployment receipt.
- Update: declared public-artifact changes invalidate deployed-current
  status until a strictly newer release from one clean canonical commit passes
  exact HTTPS readback, retired-route closure, and release-record agreement.

Publication requires a clean committed revision, complete affected-site gates,
deployment from that revision, and exact public readback of the HTTPS bytes. A
reachable development page is not release evidence.

## Current Routes

- Product: <https://TinyRustLM.com/>
- Developer portal: <https://TinyRustLM.MiRust.com/developer-portal/>
- Long-term-memory policy: `/docs/long-term-memory.md`

Retired documentation may remain available only as clearly marked historical
evidence. It is not current implementation guidance or compatibility
authority.
