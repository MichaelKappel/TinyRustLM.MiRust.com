# Runtime.MiRust.com plain PHP root package v1.0.6

This ZIP is a root-extract plain PHP site for Runtime.MiRust.com. It is not a WordPress theme and it does not require WordPress, Composer, a database, Bootstrap, jQuery, or any third-party front-end framework.

## Extract target

Extract the ZIP directly into the configured document root for `runtime.mirust.com`.

Required root markers:

```text
index.php
.htaccess
healthz
version.json
assets/
inc/
data/
docs/
.uai/
llms.txt
llms-full.txt
sitemap.xml
robots.txt
tools/
```

## Verify

```bash
bash tools/verify-runtime-mirust.sh https://runtime.mirust.com
```

PowerShell:

```powershell
./tools/verify-runtime-mirust.ps1 -BaseUrl https://runtime.mirust.com
```

## cPanel default page fix

If the browser redirects to `/cgi-sys/defaultwebpage.cgi`, confirm the subdomain document root points to this package root. See `/site-origin-fix/` after deployment.

## Version

Generated UTC: 2026-06-30T14:33:29Z
Package version: 1.0.6
