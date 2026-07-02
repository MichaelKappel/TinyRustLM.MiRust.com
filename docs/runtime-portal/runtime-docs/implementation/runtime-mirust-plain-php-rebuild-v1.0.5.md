# Plain PHP Rebuild

> Runtime.MiRust.com now ships as a plain PHP root site. The WordPress layer has been removed from the deployable package.

## What changed

- Removed the WordPress theme package, theme folder, template files, functions file, and activation seeding logic.
- Added a plain PHP front controller at `/index.php`.
- Added a JSON-backed content registry at `/data/pages.json`.
- Added semantic PHP templates in `/inc/site.php`.
- Kept the source-backed page content, top-menu structure, contact footer, docs, `.uai` memory, `llms.txt`, `llms-full.txt`, sitemap, robots, and security file.
- Added Markdown content negotiation for page routes and direct `.md` page alternates.

## Extraction target

Extract the root package directly at the public web root for `Runtime.MiRust.com`. The ZIP intentionally has no wrapper folder.

## Runtime requirements

- PHP 8.1 or newer recommended.
- Apache with `mod_rewrite` for clean routes, or equivalent Nginx routing to `/index.php`.
- No Composer install step.
- No database.
- No WordPress.
- No Bootstrap, Tailwind, jQuery, Popper, React, Vue, Angular, or page builder.

## Current package boundary

This rebuild changes the public website delivery layer only. It does not rebuild the Rust/WASM runtime or regenerate model artifacts.
