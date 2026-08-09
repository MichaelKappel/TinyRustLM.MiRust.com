# TinyRustLM.MiRust.com Deployment

The production deployment closure is generated from canonical Git blob bytes,
not from platform-dependent worktree line endings.

## Build The Release Closure

```powershell
node tools/build-site-deployment-manifest.js <content-commit>
```

The generator writes the source-controlled manifest at
`deploy/site-deployment-manifest.v1.json` and materializes ignored staging
bytes under `deploy/staging/<version>/`. The content commit must contain every
public site change for the release. Tooling-only commits may follow it.

## Validate

```powershell
& .\tools\deploy-site.ps1
```

Validation requires a clean Git worktree, exact staged file identities, a
bounded manifest, and ancestry from the declared content commit.

## Publish

```powershell
& .\tools\deploy-site.ps1 -Publish
```

If an external process terminates the publisher while a file is still staged,
resume only with the exact 12-character nonce observed in that authenticated
staging filename:

```powershell
& .\tools\deploy-site.ps1 -Publish -ResumeNonce <12-lowercase-hex>
```

The publisher hashes the complete remote prefix and the same-length canonical
local prefix before seeking. A corrupt, empty, or oversized stage is deleted
and rebuilt; an exact prefix is appended from its authenticated byte offset.

Publishing loads only the exact external FileZilla profile named by the
manifest. Each file is uploaded to a unique staging name, verified over FTPS,
renamed into place with rollback protection, and verified again. Critical
static files receive byte-exact HTTPS readback; dynamic routes receive content
smokes. The script then writes a new append-only receipt under
`deploy/receipts/`. Commit that receipt after reviewing it. Never overwrite a
prior receipt or claim publication from validation alone.
