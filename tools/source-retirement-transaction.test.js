#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(repositoryRoot, "tools", "retire-public-source-copies.ps1");
const goneBody = Buffer.from("This public source copy has been permanently retired.\n", "utf8");
const publicArtifacts = [
  ".uai/.htaccess",
  ".uai/index.uai",
  ".well-known/uaix-talisman.txt",
  "docs/retired-source-copy-gone.txt",
  "docs/reports/.htaccess",
  "docs/runtime-portal/.htaccess",
  "docs/runtime-portal/runtime-docs/.htaccess",
  ".htaccess",
];
const retiredPaths = [
  "docs/reports/gguf-mirust-all-source-review-bundle.txt",
  "docs/reports/analyzing-website-virality.md",
  "docs/reports/future-proof-native-html5-techniques.md",
  "docs/reports/innovative-vanilla-web-design.md",
  "docs/reports/mememtech-vanilla-web-architecture.md",
  "docs/reports/memory-systems-domains-research.md",
  "docs/reports/rust-wasm-neural-model-patterns.md",
  "docs/reports/tiny-language-models-for-rust-wasm.md",
  "docs/reports/tiny-language-models-for-wasm.md",
  "docs/reports/understanding-tinyrustlm-creation-and-purpose.md",
  "docs/reports/vanilla-js-future-proof-techniques.md",
  "docs/runtime-portal/runtime-docs/workspace.uai",
  ".uai/taboo.uai",
  ".uai/talisman.uai",
  ".uai/totem.uai",
];
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const fixtureProfile = Object.freeze({
  host: "ftps.fixture.invalid",
  port: 21,
  protocol: "0",
  user: "fixture-retirement-user",
  password: "FIXTURE-RETIREMENT-SECRET-MUST-NOT-LEAK",
  remoteSegments: ["public_html", "tinyrustlm"],
});

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function jsonBytes(value) {
  return Buffer.from(`${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function fileIdentity(relativePath, bytes, status = "published") {
  return { path: relativePath, status, bytes: bytes.length, sha256: sha256(bytes) };
}

function fileZillaRemoteDir(segments) {
  return ["1", "0", ...segments.flatMap((segment) => [Buffer.byteLength(segment, "utf8").toString(), segment])].join(" ");
}

function transportTupleSha256(profile, remoteSegments = profile.remoteSegments) {
  return sha256(Buffer.from(`${[
    "tinyrustlm.mirust.ftps_transport_tuple.v1",
    "profile=TinyRustLM.MiRust.com",
    `protocol=${profile.protocol}`,
    "logon_type=1",
    "tls=explicit-required",
    `host=${profile.host}`,
    `port=${profile.port}`,
    `remote_dir=${remoteSegments.join("/")}`,
  ].join("\n")}\n`, "utf8"));
}

function resolveUnder(root, relativePath) {
  return path.join(root, ...relativePath.split("/"));
}

function write(root, relativePath, bytes) {
  const destination = resolveUnder(root, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, bytes);
}

function makeFixture() {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-source-retirement-"));
  const target = path.join(owner, "target");
  const siteRoot = path.join(target, ...fixtureProfile.remoteSegments);
  const authorityRoot = path.join(owner, "authority");
  const httpsRoot = path.join(owner, "https");
  const receipts = path.join(owner, "receipts");
  fs.mkdirSync(target);
  write(target, ".source-retirement-fixture-root", "tinyrustlm-source-retirement-fixture-v1\n");
  const talisman = Buffer.from("fixture public talisman bound to the immutable deployment receipt\n", "utf8");
  const publicIndex = Buffer.from("fixture public index bound to the immutable deployment receipt\n", "utf8");
  const uaiAccessPolicy = fs.readFileSync(path.join(repositoryRoot, ".uai", ".htaccess"));
  const retiredBytes = retiredPaths.map(
    (relativePath, index) => Buffer.from(`LEAKED-${index}-${path.posix.basename(relativePath)}\n`, "utf8"),
  );
  write(siteRoot, ".uai/.htaccess", uaiAccessPolicy);
  write(siteRoot, ".uai/index.uai", publicIndex);
  write(siteRoot, ".well-known/uaix-talisman.txt", talisman);
  write(siteRoot, ".htaccess", "legacy root configuration\n");
  for (let index = 0; index < retiredPaths.length; index += 1) {
    write(siteRoot, retiredPaths[index], retiredBytes[index]);
  }
  write(siteRoot, "docs/unrelated.txt", "unrelated and unchanged\n");
  write(target, "outside-bound-root.txt", "outside and unchanged\n");
  write(httpsRoot, ".well-known/uaix-talisman.txt", talisman);
  write(httpsRoot, ".uai/index.uai", publicIndex);

  const deploymentReceipt = {
    schema: "tinyrustlm.mirust.site_deployment_receipt.v1",
    site: "TinyRustLM.MiRust.com",
    origin: "https://tinyrustlm.mirust.com",
    version: "fixture-verified",
    source_commit: "1".repeat(40),
    source_tree: "2".repeat(40),
    status: "published-and-readback-verified",
    files: [
      fileIdentity(".uai/.htaccess", uaiAccessPolicy),
      fileIdentity(".uai/index.uai", publicIndex),
      fileIdentity(".well-known/uaix-talisman.txt", talisman),
      ...retiredPaths.map(
        (relativePath, index) => fileIdentity(relativePath, retiredBytes[index], "already-current"),
      ),
    ],
  };
  const deploymentReceiptRelative = "deploy/receipts/site-deployment-fixture.json";
  const deploymentReceiptBytes = jsonBytes(deploymentReceipt);
  const deploymentReceiptSha256 = sha256(deploymentReceiptBytes);
  const transportTupleSha256Value = transportTupleSha256(fixtureProfile);
  const transportAuthorityBytes = jsonBytes({
    schema: "tinyrustlm.mirust.ftps_transport_authority.v1",
    site: "TinyRustLM.MiRust.com",
    origin: "https://tinyrustlm.mirust.com",
    profile_name: "TinyRustLM.MiRust.com",
    tuple_format: "tinyrustlm.mirust.ftps_transport_tuple.v1",
    status: "active-bound",
    tuple_sha256: transportTupleSha256Value,
    contains_secrets: false,
  });
  const transportAuthoritySha256 = sha256(transportAuthorityBytes);
  const transportBindingSha256 = sha256(Buffer.from(`${[
    "tinyrustlm.mirust.retirement.transport.v2",
    `transport_authority_sha256=${transportAuthoritySha256}`,
    `transport_tuple_sha256=${transportTupleSha256Value}`,
    `deployment_receipt_sha256=${deploymentReceiptSha256}`,
    `talisman_sha256=${sha256(talisman)}`,
    `public_index_sha256=${sha256(publicIndex)}`,
  ].join("\n")}\n`, "utf8"));
  write(authorityRoot, deploymentReceiptRelative, deploymentReceiptBytes);
  write(authorityRoot, "deploy/ftps-transport-authority.v1.json", transportAuthorityBytes);
  write(authorityRoot, "deploy/site-deployment-manifest.v1.json", jsonBytes({
    schema: "tinyrustlm.mirust.site_deployment_manifest.v1",
    site: "TinyRustLM.MiRust.com",
    origin: "https://tinyrustlm.mirust.com",
    transport_profile: "TinyRustLM.MiRust.com",
    last_verified_publication: {
      version: deploymentReceipt.version,
      source_commit: deploymentReceipt.source_commit,
      source_tree: deploymentReceipt.source_tree,
      receipt: deploymentReceiptRelative,
      receipt_sha256: deploymentReceiptSha256,
    },
  }));

  const profile = path.join(owner, "sitemanager.xml");
  fs.writeFileSync(profile, [
    "<?xml version=\"1.0\" encoding=\"UTF-8\"?>",
    "<FileZilla3><Servers><Server>",
    `<Host>${fixtureProfile.host}</Host>`,
    `<Port>${fixtureProfile.port}</Port>`,
    `<Protocol>${fixtureProfile.protocol}</Protocol>`,
    "<Type>0</Type>",
    `<User>${fixtureProfile.user}</User>`,
    `<Pass encoding=\"base64\">${Buffer.from(fixtureProfile.password).toString("base64")}</Pass>`,
    "<Logontype>1</Logontype>",
    `<RemoteDir>${fileZillaRemoteDir(fixtureProfile.remoteSegments)}</RemoteDir>`,
    "<Name>TinyRustLM.MiRust.com</Name>",
    "</Server></Servers></FileZilla3>\n",
  ].join(""), "utf8");

  return {
    authorityRoot,
    deploymentReceipt: resolveUnder(authorityRoot, deploymentReceiptRelative),
    httpsRoot,
    nonce: "0123456789ab",
    owner,
    profile,
    receipt: path.join(receipts, "receipt.json"),
    receipts,
    siteRoot,
    target,
    transportAuthority: resolveUnder(authorityRoot, "deploy/ftps-transport-authority.v1.json"),
    transportAuthoritySha256,
    transportBindingSha256,
    transportTupleSha256: transportTupleSha256Value,
  };
}

function invokeFixture(fixture, fault = "none") {
  return spawnSync(powershell, [
    "-NoLogo",
    "-NoProfile",
    "-NonInteractive",
    "-ExecutionPolicy",
    "Bypass",
    "-File",
    scriptPath,
    "-FixtureRoot",
    fixture.target,
    "-ReceiptPath",
    fixture.receipt,
    "-Nonce",
    fixture.nonce,
    "-FileZillaProfilePath",
    fixture.profile,
    "-FixtureFault",
    fault,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
}

function journalPath(fixture, kind) {
  return fixture.receipt.replace(/\.json$/u, `.${kind}.json`);
}

function readJsonFile(filePath) {
  const bytes = fs.readFileSync(filePath);
  assert.ok(bytes.length > 0 && bytes.length <= 16384);
  return { bytes, value: JSON.parse(bytes.toString("utf8")) };
}

function readReceipt(fixture) {
  return readJsonFile(fixture.receipt);
}

function assertNoEvidence(fixture) {
  assert.equal(fs.existsSync(fixture.receipts), false, "read-only rejection created an evidence root");
  assert.equal(fs.existsSync(fixture.receipt), false);
  assert.equal(fs.existsSync(journalPath(fixture, "started")), false);
  assert.equal(fs.existsSync(journalPath(fixture, "terminal")), false);
}

function assertInstalledArtifacts(target) {
  for (const relativePath of publicArtifacts) {
    assert.deepEqual(
      fs.readFileSync(resolveUnder(target, relativePath)),
      fs.readFileSync(resolveUnder(repositoryRoot, relativePath)),
      relativePath,
    );
  }
}

function cleanup(fixture) {
  fs.rmSync(fixture.owner, { recursive: true, force: true });
}

test("Apache retirement payload is exact, narrow, and independent from PHP", () => {
  assert.equal(goneBody.length, 54);
  assert.deepEqual(fs.readFileSync(path.join(repositoryRoot, "docs", "retired-source-copy-gone.txt")), goneBody);

  const root = fs.readFileSync(path.join(repositoryRoot, ".htaccess"), "utf8");
  const uaiRule = "RewriteRule ^\\.uai/(?!index\\.uai$|long-term-memory\\.uai$).+ - [G,NC]";
  const archiveRule = "RewriteRule ^docs/runtime-portal/(?!index\\.md$).+ - [G,NC]";
  const bypass = "RewriteCond %{REQUEST_FILENAME} -f [OR]";
  assert.ok(root.indexOf(uaiRule) >= 0 && root.indexOf(uaiRule) < root.indexOf(bypass));
  const reportRule = root.indexOf("RewriteRule ^docs/reports/(?:");
  assert.ok(reportRule >= 0 && reportRule < root.indexOf(bypass));
  for (const relativePath of retiredPaths.filter((item) => item.startsWith("docs/reports/"))) {
    assert.ok(root.includes(path.posix.basename(relativePath).replace(".", "\\.")), relativePath);
  }
  assert.ok(root.indexOf(archiveRule) >= 0 && root.indexOf(archiveRule) < root.indexOf(bypass));
  assert.doesNotMatch(root, /all-source-review-bundle\\\.txt\$ index\.php/i);
  assert.doesNotMatch(root, /workspace\\\.uai\$ index\.php/i);
  assert.match(root, /^ErrorDocument 410 \/docs\/retired-source-copy-gone\.txt$/m);
  assert.match(root, /^Header always set Cache-Control "no-store"$/m);
  assert.match(root, /^Header always set X-Robots-Tag "noindex, nofollow"$/m);
  assert.match(root, /^Header always set X-Content-Type-Options "nosniff"$/m);
  assert.match(root, /^Header always set Content-Type "text\/plain; charset=utf-8"$/m);

  const reportGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "reports", ".htaccess"), "utf8");
  const archiveGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "runtime-portal", ".htaccess"), "utf8");
  const workspaceGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "runtime-portal", "runtime-docs", ".htaccess"), "utf8");
  const uaiGuard = fs.readFileSync(path.join(repositoryRoot, ".uai", ".htaccess"), "utf8");
  assert.match(reportGuard, /^RewriteRule \^\(\?:/m);
  for (const relativePath of retiredPaths.filter((item) => item.startsWith("docs/reports/"))) {
    assert.ok(reportGuard.includes(path.posix.basename(relativePath).replace(".", "\\.")), relativePath);
  }
  assert.match(archiveGuard, /^RewriteRule \^\(\?!index\\\.md\$\)\.\+ - \[G,NC\]$/m);
  assert.match(workspaceGuard, /^RewriteRule \^workspace\\\.uai\$ - \[G,NC\]$/m);
  assert.match(uaiGuard, /<FilesMatch "\^\(index\|long-term-memory\)\\\.uai\$">/);
  assert.match(uaiGuard, /<FilesMatch "\^\(\?!\(index\|long-term-memory\)\\\.uai\$\)\.\+">/);
});

test("production retirement is blocked until the checked-in secret-free transport tuple is independently attested", () => {
  const before = fs.existsSync(path.join(repositoryRoot, "deploy", "source-retirement-receipts"));
  const result = spawnSync(powershell, [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-File", scriptPath,
    "-NodeExecutablePath", process.execPath,
  ], {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    windowsHide: true,
  });
  assert.notEqual(result.status, 0);
  assert.match(`${result.stderr}\n${result.stdout}`, /blocked pending an independently attested secret-free tuple digest/i);
  assert.equal(fs.existsSync(path.join(repositoryRoot, "deploy", "source-retirement-receipts")), before);

  const authority = JSON.parse(fs.readFileSync(path.join(repositoryRoot, "deploy", "ftps-transport-authority.v1.json")));
  assert.equal(authority.status, "blocked-pending-independent-attestation");
  assert.equal(authority.tuple_sha256, null);
  assert.equal(authority.contains_secrets, false);
  for (const forbidden of ["host", "port", "user", "password", "remote_dir", "remote_root"]) {
    assert.equal(Object.hasOwn(authority, forbidden), false, forbidden);
  }

  const source = fs.readFileSync(scriptPath, "utf8");
  assert.doesNotMatch(source, /deploy-site\.ps1/i);
  assert.doesNotMatch(source, /&\s+node\b/iu);
  assert.match(source, /&\s+\$resolvedNode\s+\$preflightItem\.FullName/iu);
  assert.match(source, /Source-authority Node runtime does not match its immutable expected identity/u);
  assert.doesNotMatch(source, /present-after-ambiguous-create/u);
  assert.match(source, /creation-result-ambiguous-unowned/u);
  assert.match(source, /Send-TargetFileCreateOnly -RelativePath \$lockOwnerPath -Bytes \$script:lockOwnerBytes -RetainOnAmbiguity/u);
  assert.match(source, /Assert-ExactLockOwnership/u);
  assert.match(source, /site-deployment-manifest\.v1\.json/i);
  assert.match(source, /site_deployment_receipt\.v1/i);
  assert.match(source, /uaix-talisman\.txt/i);
  assert.match(source, /\.uai\/index\.uai/i);
  assert.match(source, /\.uai\/source-retirement\.lock\/preflight\.bin/i);
  assert.doesNotMatch(source, /Assert-PrivateNamespaceReadback -RequestPath "\/\.uai\/index\.uai"/u);
  assert.doesNotMatch(source, /\bgit\s+-C\s+\$repositoryRoot\s+fetch\b/u);
  assert.match(source, /\bgit\s+-C\s+\$repositoryRoot\s+ls-remote\b/u);
  assert.ok(source.indexOf("if (-not $Publish -and -not $script:fixtureMode)") < source.indexOf("Get-CredentialProfile -Path"));
});

test("fixture transaction installs bounded public controls, then removes every exact retired copy", () => {
  const fixture = makeFixture();
  try {
    const result = invokeFixture(fixture);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assertInstalledArtifacts(fixture.siteRoot);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), false);
    assert.equal(fs.readFileSync(resolveUnder(fixture.siteRoot, "docs/unrelated.txt"), "utf8"), "unrelated and unchanged\n");
    assert.equal(fs.readFileSync(resolveUnder(fixture.target, "outside-bound-root.txt"), "utf8"), "outside and unchanged\n");
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "index.php")), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "deploy/site-deployment-manifest.v1.json")), false);

    const receipt = readReceipt(fixture);
    assert.equal(receipt.value.schema, "tinyrustlm.mirust.source_retirement_receipt.v1");
    assert.equal(receipt.value.status, "retired-routes-verified");
    assert.equal(receipt.value.mode, "fixture");
    assert.equal(receipt.value.public_artifact_count, publicArtifacts.length);
    assert.deepEqual(receipt.value.public_artifacts.map((entry) => entry.path), publicArtifacts);
    assert.deepEqual(receipt.value.retired_files.map((entry) => entry.path), retiredPaths);
    assert.deepEqual(receipt.value.retired_files.map((entry) => entry.status), retiredPaths.map(() => "deleted"));
    assert.equal(receipt.value.readback_request_count, retiredPaths.length * 32);
    assert.equal(receipt.value.failure_code, null);
    assert.match(receipt.value.deployment_receipt_sha256, /^[0-9a-f]{64}$/u);
    assert.equal(receipt.value.transport_authority_sha256, fixture.transportAuthoritySha256);
    assert.equal(receipt.value.transport_binding_sha256, fixture.transportBindingSha256);
    assert.match(receipt.value.lock_owner_sha256, /^[0-9a-f]{64}$/u);
    assert.equal(receipt.bytes.includes(Buffer.from(fixture.target, "utf8")), false);
    assert.equal(receipt.bytes.includes(Buffer.from("LEAKED-", "utf8")), false);
    assert.equal(receipt.bytes.includes(Buffer.from(fixtureProfile.password, "utf8")), false);
    assert.equal(receipt.bytes.includes(Buffer.from(fixtureProfile.user, "utf8")), false);

    const started = readJsonFile(journalPath(fixture, "started"));
    const terminal = readJsonFile(journalPath(fixture, "terminal"));
    assert.equal(started.value.schema, "tinyrustlm.mirust.source_retirement_journal.v1");
    assert.equal(started.value.state, "started");
    assert.equal(terminal.value.schema, "tinyrustlm.mirust.source_retirement_journal.v1");
    assert.equal(terminal.value.state, "terminal");
    assert.equal(terminal.value.status, "retired-routes-verified");
    assert.equal(started.value.transport_authority_sha256, fixture.transportAuthoritySha256);
    assert.equal(terminal.value.transport_authority_sha256, fixture.transportAuthoritySha256);
    assert.equal(started.value.transport_binding_sha256, receipt.value.transport_binding_sha256);
    assert.equal(terminal.value.transport_binding_sha256, receipt.value.transport_binding_sha256);
    assert.match(started.value.lock_owner_token, /^[0-9a-f]{64}$/u);
    assert.equal(started.value.lock_owner_sha256, receipt.value.lock_owner_sha256);
    assert.equal(terminal.value.lock_owner_sha256, receipt.value.lock_owner_sha256);
    for (const evidence of [started.bytes, terminal.bytes, Buffer.from(result.stdout), Buffer.from(result.stderr)]) {
      assert.equal(evidence.includes(Buffer.from(fixtureProfile.password, "utf8")), false);
      assert.equal(evidence.includes(Buffer.from(fixtureProfile.user, "utf8")), false);
    }
  }
  finally { cleanup(fixture); }
});

test("all read-only checks finish before evidence-root creation or any public mutation", () => {
  const fixture = makeFixture();
  try {
    const legacyRoot = fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess"));
    const result = invokeFixture(fixture, "before-evidence");
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess")), legacyRoot);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "docs/retired-source-copy-gone.txt")), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assertNoEvidence(fixture);

    const source = fs.readFileSync(scriptPath, "utf8");
    const routeCheck = source.lastIndexOf("Assert-PreMutationRouteObservation");
    const identityCheck = source.lastIndexOf("Assert-RemoteSiteIdentity");
    const evidenceRoot = source.lastIndexOf("Initialize-EvidenceRoot -ResolvedReceiptPath");
    const journal = source.lastIndexOf("Reserve-DurableLocalJournal -StartedUtc");
    const firstMutation = source.lastIndexOf("New-TargetDirectoryCreateOnly -RelativePath $lockPath");
    assert.ok(routeCheck >= 0 && routeCheck < evidenceRoot);
    assert.ok(identityCheck >= 0 && identityCheck < evidenceRoot);
    assert.ok(evidenceRoot < journal && journal < firstMutation);
    const resolverStart = source.indexOf("function Resolve-ReceiptPath");
    const resolverEnd = source.indexOf("function Initialize-EvidenceRoot");
    assert.doesNotMatch(source.slice(resolverStart, resolverEnd), /CreateDirectory/u);
  }
  finally { cleanup(fixture); }
});

test("capability failure occurs before guard or source mutation and writes one bounded failure receipt", () => {
  const fixture = makeFixture();
  try {
    const legacyRoot = fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess"));
    const result = invokeFixture(fixture, "capability-rename");
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess")), legacyRoot);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "docs/retired-source-copy-gone.txt")), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    const receipt = readReceipt(fixture).value;
    assert.equal(receipt.status, "capability-rejected");
    assert.equal(receipt.installed_artifact_count, 0);
    assert.equal(receipt.retired_files.length, 0);
    assert.match(receipt.failure_code, /^System\./);
  }
  finally { cleanup(fixture); }
});

test("an unproven Apache readback rolls controls back before any source removal", () => {
  const fixture = makeFixture();
  try {
    const legacyRoot = fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess"));
    const result = invokeFixture(fixture, "guard-readback");
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess")), legacyRoot);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "docs/retired-source-copy-gone.txt")), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "docs/reports/.htaccess")), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, "docs/runtime-portal/runtime-docs/.htaccess")), false);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    const receipt = readReceipt(fixture).value;
    assert.equal(receipt.status, "guard-install-incomplete");
    assert.equal(receipt.installed_artifact_count, 1);
    assert.equal(receipt.retired_files.length, 0);
  }
  finally { cleanup(fixture); }
});

test("a stop after guard proof leaves sources guarded and does not begin removal", () => {
  const fixture = makeFixture();
  try {
    const result = invokeFixture(fixture, "before-removal");
    assert.notEqual(result.status, 0);
    assertInstalledArtifacts(fixture.siteRoot);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), true);
    const receipt = readReceipt(fixture).value;
    assert.equal(receipt.status, "guarded-removal-not-started");
    assert.equal(receipt.installed_artifact_count, publicArtifacts.length);
    assert.equal(receipt.retired_files.length, 0);
    assert.equal(receipt.readback_request_count, retiredPaths.length * 16);
  }
  finally { cleanup(fixture); }
});

test("a stop during deletion is monotonic and never restores the first leaked source", () => {
  const fixture = makeFixture();
  try {
    const result = invokeFixture(fixture, "after-first-removal");
    assert.notEqual(result.status, 0);
    assertInstalledArtifacts(fixture.siteRoot);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, retiredPaths[0])), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, retiredPaths[1])), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), true);
    const receipt = readReceipt(fixture).value;
    assert.equal(receipt.status, "guarded-removal-incomplete");
    assert.deepEqual(receipt.retired_files, [{ path: retiredPaths[0], status: "deleted" }]);
  }
  finally { cleanup(fixture); }
});

test("receipt identity is create-only and blocks a second transaction before mutation", () => {
  const fixture = makeFixture();
  try {
    const first = invokeFixture(fixture);
    assert.equal(first.status, 0, first.stderr || first.stdout);
    const originalReceipt = fs.readFileSync(fixture.receipt);
    write(fixture.siteRoot, retiredPaths[0], "RESTORED-FIXTURE-SENTINEL\n");
    const second = invokeFixture(fixture);
    assert.notEqual(second.status, 0);
    assert.equal(fs.readFileSync(resolveUnder(fixture.siteRoot, retiredPaths[0]), "utf8"), "RESTORED-FIXTURE-SENTINEL\n");
    assert.deepEqual(fs.readFileSync(fixture.receipt), originalReceipt);
  }
  finally { cleanup(fixture); }
});

test("immutable deployment receipt drift is rejected before any remote mutation", () => {
  const fixture = makeFixture();
  try {
    const legacyRoot = fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess"));
    fs.appendFileSync(fixture.deploymentReceipt, " \n");
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(resolveUnder(fixture.siteRoot, ".htaccess")), legacyRoot);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("immutable tuple authority rejects a byte-identical mirror behind the same profile name", () => {
  const fixture = makeFixture();
  try {
    const mirrorSegments = ["public_html", "byte-identical-mirror"];
    const mirrorRoot = path.join(fixture.target, ...mirrorSegments);
    fs.cpSync(fixture.siteRoot, mirrorRoot, { recursive: true });
    const profile = fs.readFileSync(fixture.profile, "utf8");
    fs.writeFileSync(
      fixture.profile,
      profile.replace(
        fileZillaRemoteDir(fixtureProfile.remoteSegments),
        fileZillaRemoteDir(mirrorSegments),
      ),
      "utf8",
    );
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(mirrorRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("immutable tuple authority rejects host, port, protocol, and logon drift before evidence", () => {
  const mutations = [
    ["host", /<Host>[^<]+<\/Host>/u, "<Host>other.fixture.invalid</Host>"],
    ["port", /<Port>21<\/Port>/u, "<Port>22</Port>"],
    ["protocol", /<Protocol>0<\/Protocol>/u, "<Protocol>1</Protocol>"],
    ["logon", /<Logontype>1<\/Logontype>/u, "<Logontype>2</Logontype>"],
  ];
  for (const [label, pattern, replacement] of mutations) {
    const fixture = makeFixture();
    try {
      const profile = fs.readFileSync(fixture.profile, "utf8");
      fs.writeFileSync(fixture.profile, profile.replace(pattern, replacement), "utf8");
      const result = invokeFixture(fixture);
      assert.notEqual(result.status, 0, label);
      for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true, label);
      assertNoEvidence(fixture);
    }
    finally { cleanup(fixture); }
  }
});

test("HTTPS and FTPS talisman bytes must equal the immutable deployment identity", () => {
  const fixture = makeFixture();
  try {
    write(fixture.httpsRoot, ".well-known/uaix-talisman.txt", "different HTTPS talisman\n");
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("FTPS public index identity must match the immutable deployment receipt", () => {
  const fixture = makeFixture();
  try {
    write(fixture.siteRoot, ".uai/index.uai", "wrong public index\n");
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("public HTTPS index must return the exact immutable FTPS bytes", () => {
  const fixture = makeFixture();
  try {
    write(fixture.httpsRoot, ".uai/index.uai", "wrong HTTPS public index\n");
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("immutable UAI access policy must retain public index and private control semantics", () => {
  const fixture = makeFixture();
  try {
    write(fixture.siteRoot, ".uai/.htaccess", "Require all granted\n");
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("each retired target must retain its exact deployment identity before mutation", () => {
  const fixture = makeFixture();
  try {
    write(fixture.siteRoot, retiredPaths[1], "different target bytes\n");
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, retiredPaths[0])), true);
    assert.equal(fs.readFileSync(resolveUnder(fixture.siteRoot, retiredPaths[1]), "utf8"), "different target bytes\n");
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("durable journal identity is create-only and reserved before lock acquisition", () => {
  const fixture = makeFixture();
  try {
    const occupied = Buffer.from("preexisting journal evidence\n", "utf8");
    fs.mkdirSync(fixture.receipts);
    fs.writeFileSync(journalPath(fixture, "started"), occupied);
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(journalPath(fixture, "started")), occupied);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
  }
  finally { cleanup(fixture); }
});

test("an ambiguous lock creation remains unowned and is never deleted", () => {
  const fixture = makeFixture();
  try {
    const result = invokeFixture(fixture, "lock-create-ambiguous");
    assert.notEqual(result.status, 0);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), true);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock/owner.json")), false);
    const terminal = readJsonFile(journalPath(fixture, "terminal")).value;
    assert.equal(terminal.status, "lock-ownership-unproven");
    assert.equal(terminal.lock_disposition, "creation-result-ambiguous-unowned");
  }
  finally { cleanup(fixture); }
});

test("a preexisting foreign lock and owner marker are left byte-exact", () => {
  const fixture = makeFixture();
  try {
    const lockRoot = resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock");
    const ownerPath = path.join(lockRoot, "owner.json");
    const foreignOwner = Buffer.from("foreign owner marker must remain exact\n", "utf8");
    fs.mkdirSync(lockRoot);
    fs.writeFileSync(ownerPath, foreignOwner);
    const result = invokeFixture(fixture);
    assert.notEqual(result.status, 0);
    assert.deepEqual(fs.readFileSync(ownerPath), foreignOwner);
    assert.equal(fs.existsSync(lockRoot), true);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    assertNoEvidence(fixture);
  }
  finally { cleanup(fixture); }
});

test("a substituted owner marker revokes ownership and prevents lock deletion", () => {
  const fixture = makeFixture();
  try {
    const result = invokeFixture(fixture, "lock-owner-substitution");
    assert.notEqual(result.status, 0);
    const lockRoot = resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock");
    const ownerPath = path.join(lockRoot, "owner.json");
    assert.equal(fs.existsSync(lockRoot), true);
    assert.equal(fs.readFileSync(ownerPath, "utf8"), "foreign-owner-marker\n");
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), true);
    const terminal = readJsonFile(journalPath(fixture, "terminal")).value;
    assert.equal(terminal.status, "lock-ownership-unproven");
    assert.equal(terminal.lock_disposition, "ownership-proof-absent-or-drifted");
  }
  finally { cleanup(fixture); }
});

test("final receipt failure retains durable terminal evidence after monotonic completion", () => {
  const fixture = makeFixture();
  try {
    const result = invokeFixture(fixture, "receipt-write");
    assert.notEqual(result.status, 0);
    assertInstalledArtifacts(fixture.siteRoot);
    for (const relativePath of retiredPaths) assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, relativePath)), false);
    assert.equal(fs.existsSync(resolveUnder(fixture.siteRoot, ".uai/source-retirement.lock")), false);
    assert.equal(fs.existsSync(fixture.receipt), false);
    const terminal = readJsonFile(journalPath(fixture, "terminal")).value;
    assert.equal(terminal.status, "retired-routes-verified");
    assert.equal(terminal.lock_disposition, "absent-after-owned-cleanup");
  }
  finally { cleanup(fixture); }
});

test("production FTP paths and absolute rename destinations stay under the decoded RemoteDir", () => {
  const source = fs.readFileSync(scriptPath, "utf8");
  assert.match(source, /function ConvertFrom-FileZillaRemoteDir/u);
  assert.match(source, /function Get-BoundRemotePath/u);
  assert.match(source, /RenameTo\s*=\s*Get-BoundRemoteRenamePath/u);
  assert.doesNotMatch(source, /RenameTo\s*=\s*"\/"\s*\+\s*\$TargetPath/u);
});
