#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const {
  HISTORICAL_RECEIPT_AUTHORITY,
  RETIREMENT_POLICY,
  buildRetiredRouteChecks,
  deriveRetiredPaths,
  readHistoricalPublicationAuthority,
  readPublicCommitClosure,
  validateDeploymentInput,
} = require("./verify-site-deployment-input.js");
const { assertDirectoryAbsent, isPublicArtifactPath } = require("./public-artifact-policy.js");

const repositoryRoot = path.resolve(__dirname, "..");
const retiredPaths = [
  "docs/reports/gguf-mirust-all-source-review-bundle.txt",
  "docs/runtime-portal/runtime-docs/workspace.uai",
];
const retainedPrivateReports = [
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
];

// Reads a repository file without permitting path construction outside this checkout.
function read(relativePath) {
  return fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")), "utf8");
}

function assertLegalReleaseState(manifest, packageManifest) {
  assert.equal(manifest.version, "1.8.3");
  assert.equal(manifest.release_date, "2026-08-31");
  assert.equal(manifest.publication_claim, "not-published-by-this-manifest");
  assert.equal(manifest.retirement_policy, RETIREMENT_POLICY);
  assert.equal(manifest.last_verified_publication.version, "1.8.2");
  assert.ok(
    ["prepared-awaiting-content-commit", "commit-bound-candidate"].includes(manifest.status),
    manifest.status,
  );
  if (manifest.status === "prepared-awaiting-content-commit") {
    assert.equal(manifest.source_commit, null);
    assert.equal(manifest.source_tree, null);
    assert.deepEqual(manifest.files, []);
    assert.deepEqual(manifest.route_smokes, []);
    assert.deepEqual(manifest.retired_files, []);
    assert.deepEqual(manifest.retired_route_checks, []);
  }
  else {
    assert.match(manifest.source_commit, /^[0-9a-f]{40}$/);
    assert.match(manifest.source_tree, /^[0-9a-f]{40}$/);
    assert.ok(manifest.files.length >= 20 && manifest.files.length <= 512);
    assert.ok(manifest.route_smokes.length > 0);
    assert.ok(manifest.retired_files.length > 0);
    assert.equal(manifest.retired_route_checks.length, manifest.retired_files.length);
  }

  const packagePrepared = /Status: `awaiting-content-commit`/.test(packageManifest);
  const packageCandidate = /Status: `commit-bound-candidate`/.test(packageManifest);
  assert.notEqual(packagePrepared, packageCandidate, "package manifest must have exactly one legal state");
  if (packagePrepared) {
    assert.match(packageManifest, /Prepared version: `1\.8\.3`/);
    assert.match(packageManifest, /Content-basis commit: `pending`/);
    assert.equal(manifest.status, "prepared-awaiting-content-commit");
  }
  else {
    assert.match(packageManifest, /Version: `1\.8\.3`/);
    assert.match(packageManifest, /Content-basis commit: `[0-9a-f]{40}`/);
    assert.match(packageManifest, /Content-basis tree: `[0-9a-f]{40}`/);
  }
  if (manifest.status === "commit-bound-candidate") assert.equal(packageCandidate, true);
}

test("retired source copies and all stages are absent while canonical bytes match immutable C2", () => {
  for (const relativePath of retiredPaths) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, ...relativePath.split("/"))), false);
  }
  assertDirectoryAbsent(path.join(repositoryRoot, "deploy", "staging", "1.8.2"));
  const manifestPath = path.join(repositoryRoot, "deploy", "site-deployment-manifest.v1.json");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assertLegalReleaseState(manifest, read("docs/package-manifest.md"));
  const stagingRoot = path.join(repositoryRoot, "deploy", "staging", manifest.version);
  assertDirectoryAbsent(stagingRoot);
  if (manifest.status === "commit-bound-candidate") {
    const result = validateDeploymentInput(manifestPath);
    assert.equal(result.packageTransaction.packageCommit, manifest.source_commit);
    assert.equal(result.fileCount, manifest.files.length);
  }
});

test("historical reports remain repository-retained but outside the public deployment closure", () => {
  assert.equal(isPublicArtifactPath("docs/reports/.htaccess"), true);
  for (const relativePath of retainedPrivateReports) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, ...relativePath.split("/"))), true, relativePath);
    assert.equal(isPublicArtifactPath(relativePath), false, relativePath);
  }
});

test("live indexes exclude retired source copies and retirement metadata matches the immutable release state", () => {
  const currentFiles = [
    ".uai/archives/source-report-manifest.json",
    "docs/package-manifest.md",
    "docs/report-index.md",
    "docs/reports-index.php",
    "docs/runtime-portal/MANIFEST.md",
    "docs/runtime-portal/runtime-docs/MANIFEST.md",
    "sitemap.xml",
  ];
  for (const currentFile of currentFiles) {
    const contents = read(currentFile).toLowerCase();
    for (const retiredPath of retiredPaths) {
      assert.equal(contents.includes(retiredPath.toLowerCase()), false, `${currentFile} retains ${retiredPath}`);
    }
    assert.equal(contents.includes("/docs/reports/gguf-mirust-all-source-review-bundle.txt"), false);
  }
  for (const currentFile of [
    "docs/index.php",
    "docs/report-index.md",
    "docs/reports-index.php",
    "sitemap.xml",
  ]) {
    assert.equal(read(currentFile).toLowerCase().includes("/docs/reports/"), false, currentFile);
  }

  const sourceManifest = JSON.parse(read(".uai/archives/source-report-manifest.json"));
  assert.equal(
    sourceManifest.reports.some((report) => report.stable_id === "report_gguf_mirust_all_source_review_bundle"),
    false,
  );
  const obsoleteExplanation = sourceManifest.reports.find(
    (report) => report.stable_id === "report_understanding_tinyrustlm_creation_and_purpose",
  );
  assert.ok(obsoleteExplanation);
  assert.doesNotMatch(obsoleteExplanation.summary, /primary TinyRustLM explanation/i);
  assert.match(obsoleteExplanation.summary, /obsolete historical report/i);
  const deploymentManifest = JSON.parse(read("deploy/site-deployment-manifest.v1.json"));
  assert.equal(
    deploymentManifest.files.some((file) => retiredPaths.includes(String(file.path).toLowerCase())),
    false,
  );
  assert.equal(
    (deploymentManifest.route_smokes || []).some((route) => retiredPaths.includes(String(route.path).slice(1).toLowerCase())),
    false,
  );
  assert.equal(deploymentManifest.retirement_policy, RETIREMENT_POLICY);
  assertLegalReleaseState(deploymentManifest, read("docs/package-manifest.md"));
  const expectedRetiredPaths = deploymentManifest.status === "prepared-awaiting-content-commit"
    ? []
    : deriveRetiredPaths(
      readHistoricalPublicationAuthority(repositoryRoot).receipt.files,
      readPublicCommitClosure(repositoryRoot, deploymentManifest.source_commit),
    );
  assert.deepEqual(deploymentManifest.retired_files, expectedRetiredPaths);
  assert.deepEqual(deploymentManifest.retired_route_checks, buildRetiredRouteChecks(expectedRetiredPaths));
});

test("source-report manifest binds the canonical LF report-index bytes", () => {
  const sourceManifest = JSON.parse(read(".uai/archives/source-report-manifest.json"));
  const reportsIndexPhp = read("docs/reports-index.php");
  const reportIndex = Buffer.from(read("docs/report-index.md").replaceAll("\r\n", "\n"));
  const longTermMemory = Buffer.from(read("docs/long-term-memory.md").replaceAll("\r\n", "\n"));
  const reportIndexSha256 = crypto.createHash("sha256").update(reportIndex).digest("hex").toUpperCase();
  const longTermMemorySha256 = crypto.createHash("sha256").update(longTermMemory).digest("hex").toUpperCase();
  assert.equal(
    sourceManifest.report_index_sha256,
    reportIndexSha256,
    `report-index identity drift (${reportIndex.length} canonical bytes at ${repositoryRoot})`,
  );
  assert.equal(
    sourceManifest.long_term_memory_sha256,
    longTermMemorySha256,
    `long-term-memory identity drift (${longTermMemory.length} canonical bytes at ${repositoryRoot})`,
  );
  assert.ok(reportIndex.includes(Buffer.from(`SHA-256: \`${longTermMemorySha256}\``)));
  for (const report of sourceManifest.reports) {
    const reportBytes = Buffer.from(read(report.path).replaceAll("\r\n", "\n"));
    const reportSha256 = crypto.createHash("sha256").update(reportBytes).digest("hex").toUpperCase();
    assert.equal(isPublicArtifactPath(report.path), false, report.path);
    assert.equal(report.bytes, reportBytes.length, report.path);
    assert.equal(report.sha256, reportSha256, report.path);
    assert.ok(reportIndex.includes(Buffer.from(`| ${report.bytes} | \`${report.sha256}\` |`)), report.path);
    assert.ok(reportsIndexPhp.includes(`'bytes' => ${report.bytes}`), report.path);
    assert.ok(reportsIndexPhp.includes(`'sha256' => '${report.sha256}'`), report.path);
  }
});

test("public pointer ledger binds only current LF public documents", () => {
  const pointerLedger = read(".uai/long-term-memory.uai");
  for (const relativePath of [
    "docs/long-term-memory.md",
    "docs/report-index.md",
    "docs/runtime-portal/index.md",
  ]) {
    const bytes = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
    assert.equal(bytes.includes(13), false, relativePath);
    const digest = crypto.createHash("sha256").update(bytes).digest("hex");
    assert.ok(pointerLedger.includes(`path: ${relativePath}\n    sha256: ${digest}`), relativePath);
  }
});

const runtimeRetirementReviewPath = "artifacts/ecosystem-cleanup-20260912/historical-runtime-retirement-review.json";
const runtimeRetirementReviewSha256 = "c0555bc18fde0b9232811444b45b8332d07fddf2d7efec57b8f024468b212108";

/** Bind the compact review before using any of its historical paths or identities. */
function readRuntimeRetirementReview() {
  const bytes = fs.readFileSync(path.join(repositoryRoot, runtimeRetirementReviewPath));
  assert.ok(bytes.length > 0 && bytes.length < 262144);
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"), runtimeRetirementReviewSha256);
  const review = JSON.parse(bytes);
  assert.equal(review.fileCount, 184);
  assert.equal(review.files.length, 184);
  assert.equal(review.retainedGitCommit, "7a6f9db1d33d9d19700af180917de2d45ccf9f89");
  return review;
}

test("historical Runtime review preserves every exact Git blob without copied source fixtures", () => {
  const review = readRuntimeRetirementReview();
  const listing = execFileSync("git", ["ls-tree", "-r", "-z", review.retainedGitCommit, "--", "docs/runtime-portal"],
    { cwd: repositoryRoot, encoding: "utf8", timeout: 30000, maxBuffer: 1048576 });
  const entries = new Map(listing.split("\0").filter(Boolean).map((line) => {
    const match = line.match(/^100644 blob ([0-9a-f]{40})\t(.+)$/u);
    assert.ok(match, "Historical closure contains an unexpected Git entry");
    return [match[2], match[1]];
  }));
  const batch = execFileSync("git", ["cat-file", "--batch"], { cwd: repositoryRoot, timeout: 30000,
    maxBuffer: 8388608, input: review.files.map((file) => file.retainedGitBlob).join("\n") + "\n" });
  let offset = 0;
  for (const file of review.files) {
    assert.equal(entries.get("docs/runtime-portal/" + file.relativePath), file.retainedGitBlob);
    const end = batch.indexOf(10, offset);
    assert.ok(end > offset);
    const header = batch.subarray(offset, end).toString("ascii").match(/^([0-9a-f]{40}) blob ([0-9]+)$/u);
    assert.ok(header);
    assert.equal(header[1], file.retainedGitBlob);
    const length = Number(header[2]);
    assert.ok(Number.isSafeInteger(length) && length <= 8388608);
    const payload = batch.subarray(end + 1, end + 1 + length);
    assert.equal(payload.length, length);
    assert.equal(batch[end + 1 + length], 10);
    assert.equal(crypto.createHash("sha1").update("blob " + length + "\0").update(payload).digest("hex"), file.retainedGitBlob);
    assert.equal(crypto.createHash("sha256").update(payload).digest("hex"), file.retainedGitSha256);
    offset = end + 2 + length;
  }
  assert.equal(offset, batch.length);
});

test("reviewed historical Runtime files and obsolete archive tools are physically absent", () => {
  const review = readRuntimeRetirementReview();
  const remaining = review.files.filter((file) => fs.existsSync(path.join(repositoryRoot, "docs/runtime-portal", file.relativePath)));
  assert.equal(remaining.length, 0, "Reviewed historical Runtime files still remain: " + remaining.length);
  for (const name of ["build-runtime-archive-manifest.js", "runtime-archive-manifest.test.js"]) {
    assert.equal(fs.existsSync(path.join(__dirname, name)), false);
  }
  for (const relative of review.retainedCurrentFiles) {
    assert.equal(fs.existsSync(path.join(repositoryRoot, "docs/runtime-portal", relative)), true);
  }
});

test("1.8.3 prepared and commit-bound candidate states preserve last-verified 1.8.2", () => {
  for (const relativePath of [
    "README.md",
    "llms.txt",
    "llms-full.txt",
    "docs/long-term-memory.md",
    "data/pages.php",
  ]) {
    const contents = read(relativePath);
    assert.match(contents, /Prepared source package: [`']?1\.8\.3/i, relativePath);
    assert.match(contents, /Last verified publication[^.\n]*1\.8\.2/i, relativePath);
  }

  const manifest = JSON.parse(read("deploy/site-deployment-manifest.v1.json"));
  const packageManifest = read("docs/package-manifest.md");
  assertLegalReleaseState(manifest, packageManifest);
});

test("commit-bound package and deployment fixture is a legal post-generation state", () => {
  const digest = "1".repeat(40);
  const manifest = {
    version: "1.8.3",
    release_date: "2026-08-31",
    status: "commit-bound-candidate",
    publication_claim: "not-published-by-this-manifest",
    retirement_policy: RETIREMENT_POLICY,
    source_commit: digest,
    source_tree: "2".repeat(40),
    last_verified_publication: { version: "1.8.2" },
    files: Array.from({ length: 20 }, (_, index) => ({ path: `docs/${index}.txt` })),
    route_smokes: [{ path: "/" }],
    retired_files: ["docs/retired-fixture.txt"],
    retired_route_checks: [{ path: "/docs/retired-fixture.txt", variants: ["/docs/retired-fixture.txt"] }],
  };
  const packageManifest = [
    "# TinyRustLM Public Package Manifest",
    "",
    "- Version: `1.8.3`",
    "- Release date: `2026-08-31`",
    "- Status: `commit-bound-candidate`; this manifest is not deployment evidence.",
    `- Content-basis commit: \`${digest}\``,
    `- Content-basis tree: \`${"2".repeat(40)}\``,
    "",
  ].join("\n");
  assert.doesNotThrow(() => assertLegalReleaseState(manifest, packageManifest));
});

test("the intake ledger retains identity without a live durable path", () => {
  const ledger = read(".uai/intake-outcome-ledger.uai");
  const start = ledger.indexOf("source_filename: GGUF_MiRust_All_Source_Review_Bundle(1).txt");
  const end = ledger.indexOf("\n  - source_filename:", start + 1);
  assert.notEqual(start, -1);
  const record = ledger.slice(start, end === -1 ? ledger.length : end);
  assert.match(record, /disposition: retired-source-copy/);
  assert.match(record, /historical_git_commit: [0-9a-f]{40}/);
  assert.match(record, /historical_git_blob: sha1:[0-9a-f]{40}/);
  assert.match(record, /there is no live durable path or public route/);
  assert.doesNotMatch(record, /\n\s+durable_path:/);
  assert.doesNotMatch(record, /\n\s+deep_link:/);
});

test("immutable deployment receipts retain exact tracked bytes with no staged or untracked mutations", () => {
  const unstaged = execFileSync(
    "git",
    ["diff", "--name-only", "--", "deploy/receipts"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  const staged = execFileSync(
    "git",
    ["diff", "--cached", "--name-only", "--", "deploy/receipts"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  const untracked = execFileSync(
    "git",
    ["ls-files", "--others", "--exclude-standard", "--", "deploy/receipts"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  assert.equal(unstaged, "");
  assert.equal(staged, "");
  assert.equal(untracked, "");

  const tracked = execFileSync(
    "git",
    ["ls-files", "--", "deploy/receipts"],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim().split(/\r?\n/).filter(Boolean);
  assert.ok(tracked.length > 0);
  for (const relativePath of tracked) {
    const committed = execFileSync("git", ["show", `HEAD:${relativePath}`], { cwd: repositoryRoot });
    const working = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")));
    assert.deepEqual(working, committed, relativePath);
  }
});

test("last-verified 1.8.2 authority resolves and verifies one immutable historical Git blob", () => {
  const authority = readHistoricalPublicationAuthority(repositoryRoot);
  assert.equal(authority.publication.version, "1.8.2");
  assert.equal(authority.publication.receipt, HISTORICAL_RECEIPT_AUTHORITY.path);
  assert.equal(authority.publication.receipt_git_commit, HISTORICAL_RECEIPT_AUTHORITY.commit);
  assert.equal(authority.publication.receipt_git_blob, `sha1:${HISTORICAL_RECEIPT_AUTHORITY.blob}`);
  assert.equal(authority.publication.receipt_bytes, 78092);
  assert.equal(
    authority.publication.receipt_sha256,
    "e762a900aad256d5783ea5fbdec68307f95b08d4e0f1f76db6765329fa172cf2",
  );

  const resolvedBlob = execFileSync(
    "git",
    ["rev-parse", `${HISTORICAL_RECEIPT_AUTHORITY.commit}:${HISTORICAL_RECEIPT_AUTHORITY.path}`],
    { cwd: repositoryRoot, encoding: "utf8" },
  ).trim();
  assert.equal(resolvedBlob, HISTORICAL_RECEIPT_AUTHORITY.blob);
  assert.deepEqual(
    fs.readFileSync(path.join(repositoryRoot, ...HISTORICAL_RECEIPT_AUTHORITY.path.split("/"))),
    authority.receiptBytes,
  );
});

test("release generators consume shared Git authority instead of literal receipt claims or HEAD bytes", () => {
  for (const relativePath of [
    "tools/build-public-package-manifest.js",
    "tools/build-site-deployment-manifest.js",
  ]) {
    const source = read(relativePath);
    assert.doesNotMatch(source, /2547720541dfb927a81a85ae3eac3222908b9771/, relativePath);
    assert.doesNotMatch(source, /bc7b4a9d5c74e4f94fb7a168211a865fb099dadc/, relativePath);
    assert.doesNotMatch(source, /e762a900aad256d5783ea5fbdec68307f95b08d4e0f1f76db6765329fa172cf2/, relativePath);
    assert.doesNotMatch(source, /HEAD:.*site-deployment-20260830T014629Z/i, relativePath);
    assert.match(source, /readHistoricalPublicationAuthority/, relativePath);
  }
});
