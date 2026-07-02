---
title: Operator Schedule Carry-Forward Memory
source_site: Runtime.MiRust.com
public_route: /runtime-mirust/reports/operator-schedule-carry-forward-memory-2026-06-29/
status: reviewed_current
reviewed_utc: 2026-06-29T20:22:33Z
---

# Operator Schedule Carry-Forward Memory

## Summary

Parent-pool evolution schedules now flow beyond the recipe into sign-merge and soup operator receipts, multi-parent candidate manifests, multi-parent promotion templates, and multi-parent selector admission records. The handoff chain records the schedule checksum, schedule strategy/status/source, selected operator-family index, scheduled command, scheduled selection rule, and scheduled output gate.

## Source Change

- `tinyrustlm/tools/slm_pack/src/sign_merge.rs` copies the sign-merge schedule family from the parent-pool recipe into each sign-merge receipt.
- `tinyrustlm/tools/slm_pack/src/soup.rs` copies the soup schedule family from the parent-pool recipe into each soup receipt.
- `tinyrustlm/tools/slm_pack/src/multi_candidate.rs` validates the scheduled family against the recipe and carries the schedule fields into the candidate manifest.
- `tinyrustlm/tools/slm_pack/src/multi_promotion.rs` carries the schedule fields from the candidate manifest into the multi-parent promotion template.
- `tinyrustlm/tools/slm_pack/src/multi_admission.rs` carries the schedule fields into the selector admission record and validates scheduled family kind against the bound operator receipt.
- `tinyrustlm/tools/slm_pack/src/selector.rs` updates the multi-parent selector fixture schema so selector-registry validation consumes the new admission shape.

## Verification

- `cargo fmt --all -- --check`
- `cargo test -p tinyrustlm-slm-pack sign_merge -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack soup -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack multi_candidate -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack multi_promotion -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack multi_admission -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack writes_and_validates_selector_registry_from_multi_parent_admission_record -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack writes_and_validates_mixed_selector_registry_admission_versions -- --nocapture`
- `cargo test -p tinyrustlm-slm-pack`

The focused tests assert schedule checksum and scheduled-family command fields for sign-merge receipts, soup receipts, candidate manifests, promotion templates, admission records, and selector-registry admission fixtures. The full packer suite passed with 324 tests. No coverage tool is active in the zero-dependency workspace, so focused field assertions plus full packer coverage are recorded against the 75% target.

## Routing

Load this report before changing parent-pool evolution schedules, sign-merge receipts, soup receipts, multi-parent candidate manifests, multi-parent promotion templates, multi-parent admission records, scheduled operator-family handoff, selector registry admission fixtures, or browser bundle evidence chains that consume parent-pool operator receipts.
