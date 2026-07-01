# TinyRustLM Plain PHP Site v1.3.0

This package is a plain PHP project website for `https://TinyRustLM.mirust.com/`.
It is not a WordPress theme and does not require WordPress.

## Requirements

- PHP 8.0 or newer
- Apache with `.htaccess` rewrite support, or equivalent Nginx rewrites to `index.php`
- No Composer install required
- No npm install required
- No database required
- No Bootstrap, jQuery, Tailwind, React, Vue, CDN assets, or page builder

## Deploy

1. Upload all files in this folder to the TinyRustLM subdomain document root.
2. Ensure `index.php`, `data/`, `includes/`, `assets/`, `docs/`, `.uai/`, `agent-file-handoff/`, `.htaccess`, `llms.txt`, `llms-full.txt`, `robots.txt`, and `sitemap.xml` are at the web root.
3. Preserve dotfiles when uploading or unzipping. The `.uai/` folder and `.htaccess` are intentional.
4. Point clean routes to `index.php` and verify `/docs/`, `/contact/`, `/llms.txt`, and `/sitemap.xml`.

## v1.3.0 changes

- Added `/docs/` as a first-class docs and UAI-memory surface.
- Added `docs/long-term-memory.md` as durable long-term body memory.
- Added `docs/report-index.md` as the preserved report manifest.
- Copied all attached reports into `docs/reports/` with stable filenames and SHA-256 checksums.
- Added `.uai/` file-memory suite: index, system profile, startup packet, receiver brief, context, constraints, architecture, coding standards, operations, test plan, progress, decisions, memory, short-term memory, long-term pointer ledger, file handoff, intake ledger, and next recursive prompt.
- Added `agent-file-handoff/Content/` and `agent-file-handoff/Improvement/` placeholder intake buckets.
- Added top-menu `Docs + Memory` group with deep links to docs and .uai memory.
- Updated `llms.txt`, `llms-full.txt`, `robots.txt`, `sitemap.xml`, and footer machine-readable links.

## v1.2.0 carried forward

- `/contact/` remains a first-class route.
- Footer heading and link remains exactly: `Contact Mike Kappel`.
- Direct contact actions remain available for email, phone, contact hub, LinkedIn, GitHub, and NuGet.
- Top menu remains grouped and accessible without third-party JavaScript.

## Content model

- `data/site.php`: global metadata, grouped navigation, and contact metadata.
- `data/pages.php`: primary public page content.
- `docs/index.php`: documentation landing page.
- `docs/long-term-memory.md`: durable body memory.
- `docs/report-index.md`: report manifest and checksums.
- `docs/reports/*`: preserved full report bodies.
- `.uai/*.uai`: compact agent file-memory records.
- `includes/functions.php`: routing, navigation helpers, links, and Markdown negotiation.
- `includes/header.php` and `includes/footer.php`: shared layout.
- `assets/css/site.css`: custom CSS only.
- `assets/js/site.js`: mobile menu and disclosure-menu behavior only.

## Agent-readable files

- `/llms.txt`: compact agent index.
- `/llms-full.txt`: bundled text content for key pages and memory index.
- `/docs/`: report archive and memory read order.
- `/.uai/index.uai`: UAI memory read order.
- `/.uai/long-term-memory.uai`: semantic pointer ledger into `/docs`.
- Any PHP-rendered page can also return Markdown with `?format=md` or an `Accept: text/markdown` request.
