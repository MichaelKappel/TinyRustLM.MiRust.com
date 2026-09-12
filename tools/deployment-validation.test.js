#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync, spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  HTTPS_READBACK_PATHS,
  PACKAGE_MANIFEST_PATH,
  RELEASE_DATE,
  RELEASE_VERSION,
  RETAINED_PRIVATE_REPORT_PATHS,
  RETIREMENT_POLICY,
  buildRetiredRouteChecks,
  deriveRetiredPaths,
  readPublicCommitClosure,
} = require("./verify-site-deployment-input.js");

const { createVirtualBoundary } = require("./deployment-validation-fixture.js");

const repositoryRoot = path.resolve(__dirname, "..");
const fixturePublication = Object.freeze({
  version: "1.8.2",
  source_commit: "1".repeat(40),
  source_tree: "2".repeat(40),
  receipt: "deploy/receipts/site-deployment-fixture.json",
  receipt_git_commit: "3".repeat(40),
  receipt_git_blob: `sha1:${"4".repeat(40)}`,
  receipt_bytes: 1024,
  receipt_sha256: "5".repeat(64),
});
const fixtureHistoricalFiles = Object.freeze([
  Object.freeze({ path: "docs/retired-fixture.md" }),
]);

/** Describe the synthetic package transaction using the supplied virtual Git boundary. */
function packageIdentity(root, packageCommit, basisCommit, git) {
  const bytes = git(root, ["show", `${packageCommit}:${PACKAGE_MANIFEST_PATH}`], null);
  return {
    path: PACKAGE_MANIFEST_PATH,
    commit: packageCommit,
    tree: git(root, ["rev-parse", `${packageCommit}^{tree}`]).trim(),
    basis_commit: basisCommit,
    basis_tree: git(root, ["rev-parse", `${basisCommit}^{tree}`]).trim(),
    git_blob: `sha1:${git(root, ["rev-parse", `${packageCommit}:${PACKAGE_MANIFEST_PATH}`]).trim()}`,
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
}

/** Synthesize transaction and canonical-file responses in memory; no checkout or copy exists. */
function materializeFixture(options = {}) {
  const boundary = createVirtualBoundary();
  const { root, fs, git, api } = boundary;
  const { buildPackageManifestDocument, readPublicCommitClosure } = api;
  // Create virtual history only; this callback never invokes a real Git executable.
  const commitAll = (root, message) => {
    git(root, ["add", "--all"]);
    git(root, ["commit", "--quiet", "-m", message]);
    return git(root, ["rev-parse", "HEAD"]).trim();
  };
  try {

    const docs = path.join(root, "docs");
    fs.mkdirSync(docs);
    fs.writeFileSync(path.join(docs, "package-manifest.md"), "# Prepared package manifest\n");
    for (let index = 0; index < 200; index += 1) {
      fs.writeFileSync(path.join(docs, `artifact-${String(index).padStart(3, "0")}.md`), `artifact ${index}\n`);
    }
    const previousContentCommit = commitAll(root, "fixture previous content");

    fs.writeFileSync(path.join(docs, "artifact-000.md"), "artifact 0 at C1\n");
    const contentCommit = commitAll(root, "fixture C1 content");
    const basisCommit = options.staleBasis === true ? previousContentCommit : contentCommit;
    const built = buildPackageManifestDocument(root, basisCommit, {
      historicalPublication: fixturePublication,
      releaseDate: RELEASE_DATE,
      releaseVersion: RELEASE_VERSION,
    });
    let packageDocument = built.document;
    if (options.tamperTable === true) {
      packageDocument = packageDocument.replace(
        /(\| `docs\/artifact-000\.md` \| \d+ \| `)[0-9a-f]{64}(` \|)/,
        `$1${"f".repeat(64)}$2`,
      );
    }
    fs.writeFileSync(path.join(docs, "package-manifest.md"), packageDocument);
    if (options.unrelatedC2Change === true) {
      fs.writeFileSync(path.join(docs, "unrelated.md"), "not part of the package-only transaction\n");
    }
    const packageCommit = commitAll(root, "fixture C2 package manifest");
    const sourceTree = git(root, ["rev-parse", `${packageCommit}^{tree}`]).trim();
    const closure = readPublicCommitClosure(root, packageCommit);

    const files = closure.map(({ committed, ...file }) => ({
      ...file,
      https_readback_path: HTTPS_READBACK_PATHS.has(file.path) ? `/${file.path}` : null,
    }));
    const retiredFiles = deriveRetiredPaths(fixtureHistoricalFiles, closure, new Set());
    const manifest = {
      schema: "tinyrustlm.mirust.site_deployment_manifest.v1",
      site: "TinyRustLM.MiRust.com",
      origin: "https://tinyrustlm.mirust.com",
      version: RELEASE_VERSION,
      release_date: RELEASE_DATE,
      status: "commit-bound-candidate",
      publication_claim: "not-published-by-this-manifest",
      last_verified_publication: { ...fixturePublication },
      source_commit: packageCommit,
      source_tree: sourceTree,
      package_manifest: packageIdentity(root, packageCommit, basisCommit, git),
      transport_profile: "TinyRustLM.MiRust.com",
      retirement_policy: RETIREMENT_POLICY,
      files,
      route_smokes: [],
      retired_files: retiredFiles,
      retired_route_checks: buildRetiredRouteChecks(retiredFiles),
    };
    const manifestPath = path.join(root, "deploy", "site-deployment-manifest.v1.json");
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return {
      ...boundary,
      contentCommit,
      manifest,
      manifestPath,
      packageCommit,
      previousContentCommit,
      root,
    };
  }
  catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

/** Exercise the actual validator against explicitly virtual I/O. */
function validateFixture(fixture) {
  return fixture.api.validateDeploymentInput(fixture.manifestPath, {
    historicalPublication: fixturePublication,
    historicalFiles: fixtureHistoricalFiles,
    requiredRetiredPaths: new Set(),
    repositoryRoot: fixture.root,
  });
}

test("deployment validator CLI reaches usage validation from a non-root working directory", () => {
  const result = spawnSync(process.execPath, [
    path.join(repositoryRoot, "tools", "verify-site-deployment-input.js"),
  ], {
    cwd: path.join(repositoryRoot, "tools"),
    encoding: "utf8",
    maxBuffer: 2 * 1024 * 1024,
    timeout: 120000,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Usage: node tools\/verify-site-deployment-input\.js <canonical-manifest>/u,
  );
  assert.doesNotMatch(result.stderr, /ReferenceError|repositoryRoot is not defined/u);
  assert.doesNotMatch(result.stdout, /POLICY_VALID/u);
});

test("retained report retirements carry exact case and encoded readback variants", () => {
  const checks = buildRetiredRouteChecks(RETAINED_PRIVATE_REPORT_PATHS);
  assert.equal(checks.length, RETAINED_PRIVATE_REPORT_PATHS.length);
  for (const check of checks) {
    assert.equal(check.variants.length, 4, check.canonical_path);
    assert.equal(check.variants[0], check.canonical_path);
    assert.equal(check.variants[1], check.canonical_path.toUpperCase());
    assert.match(check.variants[2], /^\/docs\/reports\/%[0-9a-f]{2}.+%2E(?:md|txt)$/u);
    assert.match(check.variants[3], /^\/docs%2Freports%2F/u);
    for (const variant of check.variants) {
      assert.equal(decodeURIComponent(variant).toLowerCase(), check.canonical_path.toLowerCase());
    }
  }
});

test("shared deployment validator accepts an exact C1 to package-only C2 closure", () => {
  const fixture = materializeFixture();
  try {
    const result = validateFixture(fixture);
    assert.equal(result.fileCount, fixture.manifest.files.length);
    assert.equal(result.fileCount, 201);
    assert.equal(result.packageTransaction.basisCommit, fixture.contentCommit);
    assert.equal(result.packageTransaction.packageCommit, fixture.packageCommit);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("shared deployment validator rejects extras, source disguised as text, and prepared manifests", () => {
  const fixture = materializeFixture();
  try {
    fixture.fs.writeFileSync(path.join(fixture.root, "docs", "unexpected.md"), "unexpected\n");
    assert.throws(() => validateFixture(fixture), /public file count or path closure/i);
    fixture.faults.ignoredFile = "docs/unexpected.md";
    assert.throws(() => validateFixture(fixture), /public file count or path closure/i,
      "Ignored public files still invalidate the canonical closure");
    fixture.fs.rmSync(path.join(fixture.root, "docs", "unexpected.md"));
    const stage = path.join(fixture.root, "deploy", "staging", RELEASE_VERSION);
    fixture.fs.mkdirSync(stage);
    assert.throws(() => validateFixture(fixture), /staging root must be absent/i);
    fixture.fs.rmSync(stage, { recursive: true });

    const packageManifest = path.join(fixture.root, "docs", "package-manifest.md");
    fixture.fs.writeFileSync(packageManifest, "#!/usr/bin/env node\nconsole.log('copied');\n");
    assert.throws(() => validateFixture(fixture), /declared regular file|source shebang/i);
    fixture.fs.writeFileSync(
      packageManifest,
      fixture.git(fixture.root, ["show", `${fixture.packageCommit}:${PACKAGE_MANIFEST_PATH}`], null),
    );

    fixture.manifest.status = "prepared-awaiting-content-commit";
    fixture.fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /identity or bounds/i);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a stale package manifest based on an unrelated ancestor", () => {
  const fixture = materializeFixture({ staleBasis: true });
  try {
    assert.throws(() => validateFixture(fixture), /basis commit must be the sole parent/i);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a forged package-manifest table even when C2 hashes match it", () => {
  const fixture = materializeFixture({ tamperTable: true });
  try {
    assert.throws(() => validateFixture(fixture), /does not exactly match the C1 public closure/i);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a C2 commit containing an unrelated change", () => {
  const fixture = materializeFixture({ unrelatedC2Change: true });
  try {
    assert.throws(() => validateFixture(fixture), /must change only docs\/package-manifest\.md/i);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects forged historical and package identities", () => {
  const fixture = materializeFixture();
  try {
    fixture.manifest.last_verified_publication.receipt_sha256 = "0".repeat(64);
    fixture.fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /last-verified publication identity/i);

    fixture.manifest.last_verified_publication = { ...fixturePublication };
    fixture.manifest.package_manifest.sha256 = "0".repeat(64);
    fixture.fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /package-manifest identity/i);

    fixture.manifest.package_manifest = packageIdentity(
      fixture.root,
      fixture.packageCommit,
      fixture.contentCommit,
      fixture.git,
    );
    fixture.manifest.files[0].sha256 = "0".repeat(64);
    fixture.fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /file identity disagrees with C2/i);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a hand-maintained or incomplete retirement closure", () => {
  const fixture = materializeFixture();
  try {
    fixture.manifest.retired_files = [];
    fixture.manifest.retired_route_checks = [];
    fixture.fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /retired-file deletion closure is not exact/i);
  }
  finally {
    fixture.fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment generation proves its package transaction and emits metadata without source copies", () => {
  const source = fs.readFileSync(path.join(repositoryRoot, "tools", "build-site-deployment-manifest.js"), "utf8");
  assert.match(source, /verifyPackageManifestTransaction\(repositoryRoot, packageCommit/);
  assert.match(source, /assertDirectoryAbsent\(stagingRoot\)/);
  assert.doesNotMatch(source, /fs\.(?:mkdirSync|writeFileSync|copyFileSync|cpSync)/);
  assert.match(source, /process\.stdout\.write/);
});

test("same-length Git batch payload drift is rejected despite an unchanged object header", () => {
  const fixture = materializeFixture();
  fixture.faults.batchPayload = true;
  assert.throws(() => fixture.api.readPublicCommitClosure(fixture.root, fixture.contentCommit),
    /batch payload failed object-ID verification/);
});

test("canonical validation rejects substituted roots, linked files and changed working bytes", () => {
  const fixture = materializeFixture();
  assert.throws(() => fixture.api.validateDeploymentInput(fixture.manifestPath, {
    repositoryRoot: path.dirname(repositoryRoot)
  }), /canonical repository root/);
  assert.throws(() => fixture.api.validateDeploymentInput(path.join(repositoryRoot, "other.json")),
    /canonical manifest path/);
  const file = path.join(fixture.root, "docs", "artifact-000.md");
  const bytes = fixture.fs.readFileSync(file);
  const drift = Buffer.from(bytes);
  drift[0] ^= 1;
  fixture.fs.writeFileSync(file, drift);
  assert.throws(() => validateFixture(fixture), /Canonical public file identity mismatch/);
  fixture.fs.writeFileSync(file, bytes);
  const originalStat = fixture.fs.lstatSync;
  fixture.fs.lstatSync = (name) => name === file
    ? { ...originalStat(name), isSymbolicLink: () => true } : originalStat(name);
  assert.throws(() => validateFixture(fixture), /declared regular file/);
  fixture.fs.lstatSync = originalStat;
  fixture.fs.rmSync(file);
  assert.throws(() => validateFixture(fixture), /Virtual path does not exist/);
});

test("real canonical Git closure is read without staging or writing a second checkout", () => {
  for (const root of [path.dirname(repositoryRoot), ".", null]) {
    assert.throws(() => readPublicCommitClosure(root, "a".repeat(40)), /canonical repository root/);
  }
  const commit = execFileSync("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, encoding: "utf8" }).trim();
  const closure = readPublicCommitClosure(repositoryRoot, commit);
  assert.ok(closure.length >= 20 && closure.length <= 512);
  const current = closure.find((file) => file.path === "index.php");
  const actual = execFileSync("git", ["show", `${commit}:index.php`], { cwd: repositoryRoot });
  assert.ok(current.committed.equals(actual));
  assert.equal(current.sha256, crypto.createHash("sha256").update(actual).digest("hex"));
});

test("PowerShell validation delegates to the canonical shared validator after authority checks", () => {
  const source = fs.readFileSync(path.join(repositoryRoot, "tools", "deploy-site.ps1"), "utf8");
  const gate = source.lastIndexOf("Assert-CanonicalSourceAuthority");
  const validator = source.indexOf("& $script:verifiedNodeExecutablePath $validator $resolvedManifestPath");
  assert.ok(gate >= 0 && validator > gate);
  assert.match(source, /verify-site-deployment-input\.js/);
  assert.doesNotMatch(source, /Get-CredentialProfile|New-FtpRequest|Publish-File|Write-Receipt|Net\.WebRequest/);
  assert.match(source, /VALIDATION_ONLY/);
});
