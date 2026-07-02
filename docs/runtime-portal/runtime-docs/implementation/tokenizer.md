# Tokenizer

## Purpose

The tokenizer layer proves prompt transfer and generation plumbing without external tokenizer libraries. Phase one uses a fixed byte tokenizer. Phase two adds a small custom BPE tokenizer section that is parsed from `.slm` bytes and selected during model load.

## Constraints

No tokenizers crate, SentencePiece, Hugging Face tokenizer JSON, or external vocabulary files are used. Tokenizer metadata must live inside the `.slm` tokenizer section and be validated before runtime use.

## Data Structures

`Tokenizer` is the runtime enum selected from the loaded model section. `ByteTokenizer` maps bytes `0..255` directly to token ids. `BOS = 256`, `EOS = 257`, `PAD = 258`, and `UNK = 259`.

`CustomBpeTokenizer` stores a token table and a ranked merge table. Encoding begins with byte fallback tokens, repeatedly applies the lowest-rank available adjacent merge, then wraps the result with BOS and EOS. Decoding uses byte fallback for ids `0..255` and token-table bytes for merged ids.

## Binary Formats

The phase-one tokenizer section uses `BTOK` magic, version `1`, declared vocab size `260`, and the four special token ids.

The phase-two tokenizer section uses `BPE1` magic, version `1`, vocab size, four special token ids, token count, merge count, a variable token table, and fixed merge entries. Each token table entry stores `token_id`, byte length, and raw token bytes. Each merge entry stores `left`, `right`, `output`, and `rank`.

## Failure Cases

Decode rejects unknown ids outside the selected tokenizer vocabulary. Encode rejects impossible oversized prompts. BPE section parsing rejects short sections, unsupported versions, vocab/header drift, duplicate token ids, empty token bytes, out-of-vocabulary merge ids, merge outputs missing from the token table, and trailing bytes.

## Validation Rules

Encoding adds BOS and EOS. Decoding ignores BOS, EOS, and PAD, emits `?` for UNK, and validates the resulting bytes as UTF-8.

The native `.slm` admission validator accepts both `BTOK` and `BPE1`. For BPE, the tokenizer vocab must match the model header, every token id must be unique and inside the vocabulary, and every merge output must reference a token table entry.

The trained-source validator also accepts `tokenizer=bpe-v1` for BPE source shapes. Source manifests must declare BPE token and merge counts, token ids, token bytes as hex, merge ids, and ranks; conversion serializes that metadata into the `.slm` `BPE1` section before native admission validation runs.

## Current Runtime Proof

The checked-in `tiny-test-model-bpe.slm` fixture uses the `BPE1` section with a two-step merge table: `t` + `h` becomes token `260`, then token `260` + `e` becomes token `261`. Runtime generation for prompt `the` records tokenizer output `256,261`, proving the loaded `.slm` selected the custom BPE path and merged the body token before generation. The trained-source tests also generate and convert a `tiny-fixture-bpe` source bundle into a q8_0 `.slm`, proving source tokenizer metadata survives conversion into the binary artifact.

## Future Expansion Path

Current BPE support is end-to-end for a deterministic tiny fixture and for a converted source fixture. Future trained models can provide larger token and merge tables in the same `BPE1` layout, then add tests for real tokenizer corpora, normalization policy, and compatibility with trained model quality gates.
