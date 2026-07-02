# Deployment notes for Runtime.MiRust.com v1.0.6

1. Back up the current document root.
2. Extract this ZIP directly at the document root for `runtime.mirust.com`.
3. Confirm `index.php`, `.htaccess`, `healthz`, and `version.json` exist at the root.
4. Run `bash tools/verify-runtime-mirust.sh https://runtime.mirust.com` or the PowerShell equivalent.
5. Open `/site-origin-fix/` if cPanel default page behavior returns.
6. After verification, archive or remove stale WordPress folders: `wp-admin/`, `wp-includes/`, `wp-content/`, and `wp-login.php`.
7. Purge browser/CDN cache if stale redirects persist.

The package includes `.htaccess` interception rules for common WordPress routes and `/cgi-sys/defaultwebpage.cgi`, but those rules only run after the host routes the request to this document root.
