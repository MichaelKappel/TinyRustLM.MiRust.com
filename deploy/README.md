# TinyRustLM.MiRust.com Deployment

The production deployment closure is generated from canonical Git blob bytes,
not from platform-dependent worktree line endings.

## Build The Release Closure

```powershell
& 'C:\Program Files\nodejs\node.exe' tools/build-public-package-manifest.js <C1-content-commit>
# Commit only docs/package-manifest.md as package-only C2.
& 'C:\Program Files\nodejs\node.exe' tools/build-site-deployment-manifest.js <C2-package-commit>
```

The package generator binds the exact C1 public closure. The deployment
generator requires that package-only C2 relationship, writes the
source-controlled manifest at
`deploy/site-deployment-manifest.v1.json` and materializes ignored staging
bytes under `deploy/staging/<version>/`. C1 must contain every non-package-
manifest site change; C2 must change only `docs/package-manifest.md`. Neither
generated candidate is publication evidence.

Every release and deployment entrypoint invokes the canonical ecosystem
source-authority verifier before reading a release snapshot, creating staging,
loading credentials, or touching transport. A missing, malformed, or failing
verdict stops the entrypoint.

## Validate

```powershell
& .\tools\deploy-site.ps1 -NodeExecutablePath 'C:\Program Files\nodejs\node.exe'
```

Validation requires a clean Git worktree, exact staged file identities, a
bounded manifest, and ancestry from the declared package-only C2 commit. The
Node path must be absolute; the entrypoint verifies its exact checked-in byte
length and SHA-256 identity before invoking the local preflight, which in turn
verifies the exact canonical source-authority verifier bytes before execution.

## Publishing Is Disabled

`tools/deploy-site.ps1` is validation-only. Its legacy `-Publish` switch fails
before manifest loading, credential-profile access, receipt creation, or any
remote request. The legacy publisher did not bind FileZilla `RemoteDir` and
could delete the retired source copies outside the hardened transaction.

There is currently no authorized full-site publisher in this tree. Do not
remove the fail-closed gate, replay the legacy path, infer deployment from a
valid staging closure, or claim release 1.8.3 as published.

## Source-Copy Retirement

The separate `tools/retire-public-source-copies.ps1` transaction is the only
implemented mutation path for the exact retirement set. Final C3 metadata must
derive that set from the immutable last-verified publication minus the current
C2 public closure; the source bundle, ten repository-retained report bodies,
raw workspace copy, and three local governance UAI records are required members
rather than a hand-maintained final list. Production use is also blocked until
`deploy/ftps-transport-authority.v1.json` contains an
independently attested SHA-256 commitment to the normalized protocol, logon
type, TLS mode, host, port, and decoded `RemoteDir` tuple. The authority carries
no host, username, password, or raw remote path. Do not derive or approve the
commitment from the selected FileZilla profile alone; establish the tuple from
an independent operator-controlled source, then review and commit the authority
and its pinned script identity together.

Once that prerequisite is deliberately satisfied, the transaction first
completes every read-only Git, authority, profile-tuple, HTTPS/FTPS talisman,
public `.uai/index.uai`, private control namespace, retired-route, target-byte,
and lock-absence check. Only then does it create the local evidence root and a
create-only start journal. The first remote mutation is the private lock.

An authorized run must use an explicit nonce and canonical create-only receipt
path. It produces adjacent `started`, `terminal`, and final JSON evidence under
`deploy/source-retirement-receipts/`. Review all three, require terminal status
`retired-routes-verified`, and commit them as one immutable evidence group.
That evidence is necessary but does not publish the complete site; any future
publisher must require its exact committed identity before operating.
