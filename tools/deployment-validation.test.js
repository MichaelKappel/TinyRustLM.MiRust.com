#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const {
  PUBLIC_PATH_PREFIXES,
  PUBLIC_UAI_PATHS,
  ROOT_PUBLIC_PATHS,
} = require("./public-artifact-policy.js");
const {
  HTTPS_READBACK_PATHS,
  PACKAGE_MANIFEST_PATH,
  RELEASE_DATE,
  RELEASE_VERSION,
  RETAINED_PRIVATE_REPORT_PATHS,
  RETIREMENT_POLICY,
  buildRetiredRouteChecks,
  buildPackageManifestDocument,
  deriveRetiredPaths,
  readPublicCommitClosure,
  validateDeploymentInput,
} = require("./verify-site-deployment-input.js");

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

function git(root, args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: root,
    encoding,
    maxBuffer: 16 * 1024 * 1024,
  });
}

function commitAll(root, message) {
  git(root, ["add", "--all"]);
  git(root, ["commit", "--quiet", "-m", message]);
  return git(root, ["rev-parse", "HEAD"]).trim();
}

function packageIdentity(root, packageCommit, basisCommit) {
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

function materializeFixture(options = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-deployment-validation-"));
  try {
    git(root, ["init", "--quiet"]);
    git(root, ["config", "user.name", "TinyRustLM Test"]);
    git(root, ["config", "user.email", "test@example.invalid"]);
    git(root, ["config", "core.autocrlf", "false"]);

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

    const staging = path.join(root, "staging");
    fs.mkdirSync(staging);
    for (const file of closure) {
      const destination = path.join(staging, ...file.path.split("/"));
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.committed);
    }
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
      package_manifest: packageIdentity(root, packageCommit, basisCommit),
      transport_profile: "TinyRustLM.MiRust.com",
      retirement_policy: RETIREMENT_POLICY,
      files,
      route_smokes: [],
      retired_files: retiredFiles,
      retired_route_checks: buildRetiredRouteChecks(retiredFiles),
    };
    const manifestPath = path.join(root, "manifest.json");
    fs.writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    return {
      contentCommit,
      manifest,
      manifestPath,
      packageCommit,
      previousContentCommit,
      root,
      staging,
    };
  }
  catch (error) {
    fs.rmSync(root, { recursive: true, force: true });
    throw error;
  }
}

function validateFixture(fixture) {
  return validateDeploymentInput(fixture.manifestPath, fixture.staging, {
    historicalPublication: fixturePublication,
    historicalFiles: fixtureHistoricalFiles,
    requiredRetiredPaths: new Set(),
    repositoryRoot: fixture.root,
  });
}

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
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("shared deployment validator rejects extras, source disguised as text, and prepared manifests", () => {
  const fixture = materializeFixture();
  try {
    fs.writeFileSync(path.join(fixture.staging, "unexpected.txt"), "unexpected\n");
    assert.throws(() => validateFixture(fixture), /file count mismatch/i);
    fs.rmSync(path.join(fixture.staging, "unexpected.txt"));

    const packageManifest = path.join(fixture.staging, "docs", "package-manifest.md");
    fs.writeFileSync(packageManifest, "#!/usr/bin/env node\nconsole.log('copied');\n");
    assert.throws(() => validateFixture(fixture), /source shebang/i);
    fs.writeFileSync(
      packageManifest,
      git(fixture.root, ["show", `${fixture.packageCommit}:${PACKAGE_MANIFEST_PATH}`], null),
    );

    fixture.manifest.status = "prepared-awaiting-content-commit";
    fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /identity or bounds/i);
  }
  finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a stale package manifest based on an unrelated ancestor", () => {
  const fixture = materializeFixture({ staleBasis: true });
  try {
    assert.throws(() => validateFixture(fixture), /basis commit must be the sole parent/i);
  }
  finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a forged package-manifest table even when C2 hashes match it", () => {
  const fixture = materializeFixture({ tamperTable: true });
  try {
    assert.throws(() => validateFixture(fixture), /does not exactly match the C1 public closure/i);
  }
  finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a C2 commit containing an unrelated change", () => {
  const fixture = materializeFixture({ unrelatedC2Change: true });
  try {
    assert.throws(() => validateFixture(fixture), /must change only docs\/package-manifest\.md/i);
  }
  finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects forged historical and package identities", () => {
  const fixture = materializeFixture();
  try {
    fixture.manifest.last_verified_publication.receipt_sha256 = "0".repeat(64);
    fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /last-verified publication identity/i);

    fixture.manifest.last_verified_publication = { ...fixturePublication };
    fixture.manifest.package_manifest.sha256 = "0".repeat(64);
    fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /package-manifest identity/i);

    fixture.manifest.package_manifest = packageIdentity(
      fixture.root,
      fixture.packageCommit,
      fixture.contentCommit,
    );
    fixture.manifest.files[0].sha256 = "0".repeat(64);
    fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /file identity disagrees with C2/i);
  }
  finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment validation rejects a hand-maintained or incomplete retirement closure", () => {
  const fixture = materializeFixture();
  try {
    fixture.manifest.retired_files = [];
    fixture.manifest.retired_route_checks = [];
    fs.writeFileSync(fixture.manifestPath, `${JSON.stringify(fixture.manifest, null, 2)}\n`);
    assert.throws(() => validateFixture(fixture), /retired-file deletion closure is not exact/i);
  }
  finally {
    fs.rmSync(fixture.root, { recursive: true, force: true });
  }
});

test("deployment generation gates C3 materialization on the C1 to C2 proof", () => {
  const source = fs.readFileSync(path.join(repositoryRoot, "tools", "build-site-deployment-manifest.js"), "utf8");
  const transactionGate = source.indexOf("verifyPackageManifestTransaction(repositoryRoot, packageCommit");
  const stagingGate = source.indexOf("assertDirectoryAbsent(stagingRoot);", transactionGate);
  const materialization = source.indexOf("fs.mkdirSync(stagingRoot);", stagingGate);
  assert.ok(transactionGate >= 0, "package transaction gate is missing");
  assert.ok(transactionGate < stagingGate, "staging absence check precedes package transaction proof");
  assert.ok(stagingGate < materialization, "staging materialization precedes package transaction proof");
  assert.match(source, /package_manifest: packageTransaction\.identity/);
});

test("PowerShell validation independently proves commit tree, Git closure, blob identity, and policy before credentials", () => {
  const source = fs.readFileSync(path.join(repositoryRoot, "tools", "deploy-site.ps1"), "utf8");
  for (const required of [
    "source_tree does not equal source_commit^{tree}",
    '"ls-tree", "-r", "--name-only"',
    '"hash-object", "--no-filters"',
    '"cat-file", "-s"',
    "Assert-ExactStagingClosure",
    "Assert-CommitAndPublicClosure",
    "Assert-SharedPublicArtifactPolicy",
    "Retired remote source copy remains present after deletion",
  ]) {
    assert.ok(source.includes(required), required);
  }
  const cleanGate = source.indexOf("$gitStatus = @(git -C $repositoryRoot status --porcelain --untracked-files=all)");
  const sharedPolicyCall = source.indexOf("Assert-SharedPublicArtifactPolicy -ManifestPath");
  const publishGate = source.indexOf("if (-not $Publish) { exit 0 }");
  const credentialLoad = source.indexOf("$profile = Get-CredentialProfile");
  assert.ok(cleanGate >= 0 && cleanGate < sharedPolicyCall);
  assert.ok(sharedPolicyCall < publishGate);
  assert.ok(publishGate < credentialLoad);
  for (const policyPath of [...PUBLIC_UAI_PATHS, ...ROOT_PUBLIC_PATHS, ...PUBLIC_PATH_PREFIXES]) {
    assert.ok(source.includes(`"${policyPath}"`), `PowerShell public policy omits ${policyPath}`);
  }
  for (const privatePath of [".uai/talisman.uai", ".uai/taboo.uai", ".uai/totem.uai"]) {
    assert.equal(PUBLIC_UAI_PATHS.has(privatePath), false, privatePath);
  }
  assert.match(source, /docs\/runtime-portal\/index\.md/);
  assert.match(source, /last-verified-publication-minus-current-public-closure/);
});
