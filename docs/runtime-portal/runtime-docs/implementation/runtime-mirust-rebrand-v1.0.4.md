# Runtime.MiRust.com Rebrand Implementation Note v1.0.4

Updated UTC: 2026-06-30T00:00:00Z

This package establishes Runtime.MiRust.com as the public site name across the theme slug, root docs, and `.uai` memory routing.

## Applied changes

- Public domain references now use `Runtime.MiRust.com`.
- Superseded note: the v1.0.4 WordPress theme route was replaced by the v1.0.5 plain PHP root site.
- PHP constants, functions, seeded meta keys, handles, menu names, and comments now use the Runtime.MiRust naming.
- Superseded note: root deploy packages now extract directly to the public web root and run through `/index.php`.
- `.uai` files and docs routing now deep-link to the Runtime.MiRust.com public docs surface.

## Boundary

The brand changed. Technical references to GGUF as a model/file-format concept remain valid where the site discusses source boundaries, future import constraints, or runtime architecture.
