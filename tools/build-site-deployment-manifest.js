#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { assertCanonicalSourceAuthority } = require("./source-authority-preflight.js");
const {
  assertDirectoryAbsent,
  assertExactFileTree,
  assertPlainDirectory,
  assertPublishableArtifact,
} = require("./public-artifact-policy.js");
const {
  HTTPS_READBACK_PATHS,
  MAX_PUBLIC_ARTIFACTS,
  MIN_PUBLIC_ARTIFACTS,
  RELEASE_DATE,
  RELEASE_VERSION,
  RETIREMENT_POLICY,
  buildRetiredRouteChecks,
  deriveRetiredPaths,
  readHistoricalPublicationAuthority,
  readPublicCommitClosure,
  verifyPackageManifestTransaction,
} = require("./verify-site-deployment-input.js");

const repositoryRoot = path.resolve(__dirname, "..");
assertCanonicalSourceAuthority(repositoryRoot);
const packageCommit = process.argv[2];
const outputPath = path.resolve(
  repositoryRoot,
  process.argv[3] || "deploy/site-deployment-manifest.v1.json",
);
const stagingRoot = path.join(repositoryRoot, "deploy", "staging", RELEASE_VERSION);
const historicalAuthority = readHistoricalPublicationAuthority(repositoryRoot);
const historicalPublication = historicalAuthority.publication;

if (packageCommit === "--check-prepared") {
  const prepared = JSON.parse(fs.readFileSync(outputPath, "utf8"));
  if (
    prepared.version !== RELEASE_VERSION ||
    prepared.release_date !== RELEASE_DATE ||
    prepared.status !== "prepared-awaiting-content-commit" ||
    prepared.publication_claim !== "not-published-by-this-manifest" ||
    prepared.last_verified_publication?.version !== historicalPublication.version ||
    prepared.last_verified_publication?.source_commit !== historicalPublication.source_commit ||
    prepared.last_verified_publication?.source_tree !== historicalPublication.source_tree ||
    prepared.last_verified_publication?.receipt !== historicalPublication.receipt ||
    prepared.last_verified_publication?.receipt_sha256 !== historicalPublication.receipt_sha256 ||
    prepared.source_commit !== null ||
    prepared.source_tree !== null ||
    !Array.isArray(prepared.files) || prepared.files.length !== 0 ||
    !Array.isArray(prepared.route_smokes) || prepared.route_smokes.length !== 0 ||
    prepared.retirement_policy !== RETIREMENT_POLICY ||
    !Array.isArray(prepared.retired_files) || prepared.retired_files.length !== 0 ||
    !Array.isArray(prepared.retired_route_checks) || prepared.retired_route_checks.length !== 0
  ) {
    throw new Error("Prepared deployment manifest is not a bounded non-published 1.8.3 placeholder.");
  }
  assertDirectoryAbsent(stagingRoot);
  process.stdout.write(`PREPARED ${RELEASE_VERSION}; commit-bound deployment manifest and staging pending\n`);
  process.exit(0);
}

if (!/^[0-9a-f]{40}$/.test(packageCommit || "")) {
  throw new Error("Usage: node tools/build-site-deployment-manifest.js <40-character-package-commit> [output]|--check-prepared");
}

function git(args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  });
}

git(["cat-file", "-e", `${packageCommit}^{commit}`]);
const packageTransaction = verifyPackageManifestTransaction(repositoryRoot, packageCommit, {
  historicalPublication,
  releaseDate: RELEASE_DATE,
  releaseVersion: RELEASE_VERSION,
});
const sourceTree = packageTransaction.packageTree;
const requiredMarkers = new Map([
  [".uai/index.uai", [
    `prepared_release: ${RELEASE_VERSION}`,
    "prepared_status: awaiting_content_commit_and_publication_proof",
    `last_verified_release: ${historicalPublication.version}`,
  ]],
  [".well-known/uaix-talisman.txt", [
    `prepared_release: ${RELEASE_VERSION}`,
    `last_verified_release: ${historicalPublication.version}`,
    "Public Release Boundary",
    "Repository governance remains local",
    "Only index.uai and long-term-memory.uai are public pointer records",
  ]],
  ["README.md", [
    `Prepared source package: \`${RELEASE_VERSION}\``,
    `Last verified publication: \`${historicalPublication.version}\``,
    "exactly one authoritative source checkout",
    "invalidate deployed-current",
  ]],
  ["data/pages.php", [
    `Prepared source package: ${RELEASE_VERSION}`,
    `The last verified publication remains ${historicalPublication.version}`,
    "One canonical checkout",
    "1.8.1 was published on 2026-08-29",
    "1.8.0 was published on 2026-08-28",
  ]],
  ["data/site.php", [
    `'version' => '${RELEASE_VERSION}'`,
    `'release_date' => '${RELEASE_DATE}'`,
    "'release_status' => 'prepared-awaiting-content-commit'",
    `'last_verified_version' => '${historicalPublication.version}'`,
  ]],
  ["includes/functions.php", [
    "'- Prepared version: '",
    "'- Prepared status: '",
    "'- Last verified publication: '",
  ]],
  ["docs/long-term-memory.md", [
    `Prepared source package: \`${RELEASE_VERSION}\``,
    `Last verified publication: \`${historicalPublication.version}\``,
    "declared public artifact",
  ]],
  ["llms-full.txt", [
    `Prepared source package: ${RELEASE_VERSION}`,
    `Last verified publication: ${historicalPublication.version}`,
    "exactly one authoritative source checkout",
    "invalidates",
  ]],
  ["llms.txt", [
    `Prepared source package: ${RELEASE_VERSION}`,
    `Last verified publication: ${historicalPublication.version}`,
    "exactly one canonical TinyRustLM.com checkout",
    "invalidate deployed-current status",
  ]],
]);

for (const [relativePath, markers] of requiredMarkers) {
  const committed = git(["show", `${packageCommit}:${relativePath}`]);
  for (const marker of markers) {
    if (!committed.includes(marker)) {
      throw new Error(`Missing release marker in ${relativePath}: ${marker}`);
    }
  }
}

const stagedFiles = readPublicCommitClosure(repositoryRoot, packageCommit).map((file) => {
  assertPublishableArtifact(file.path, file.committed, { allowSiteSource: true });
  return {
    ...file,
    https_readback_path: HTTPS_READBACK_PATHS.has(file.path) ? `/${file.path}` : null,
  };
});

if (stagedFiles.length < MIN_PUBLIC_ARTIFACTS || stagedFiles.length > MAX_PUBLIC_ARTIFACTS) {
  throw new Error(`Unexpected public deployment closure size: ${stagedFiles.length}`);
}

assertDirectoryAbsent(stagingRoot);
fs.mkdirSync(path.dirname(stagingRoot), { recursive: true });
assertPlainDirectory(path.dirname(stagingRoot));
fs.mkdirSync(stagingRoot);
assertPlainDirectory(stagingRoot);
for (const file of stagedFiles) {
  const relativePath = file.path;
  const stagedPath = path.join(stagingRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
  fs.writeFileSync(stagedPath, file.committed);
}

const files = stagedFiles.map(({ committed, ...file }) => file);
const retiredFiles = deriveRetiredPaths(historicalAuthority.receipt.files, files);
const retiredRouteChecks = buildRetiredRouteChecks(retiredFiles);
assertExactFileTree(stagingRoot, files);

const manifest = {
  schema: "tinyrustlm.mirust.site_deployment_manifest.v1",
  site: "TinyRustLM.MiRust.com",
  origin: "https://tinyrustlm.mirust.com",
  version: RELEASE_VERSION,
  release_date: RELEASE_DATE,
  status: "commit-bound-candidate",
  publication_claim: "not-published-by-this-manifest",
  last_verified_publication: historicalPublication,
  source_commit: packageCommit,
  source_tree: sourceTree,
  package_manifest: packageTransaction.identity,
  transport_profile: "TinyRustLM.MiRust.com",
  retirement_policy: RETIREMENT_POLICY,
  files,
  route_smokes: [
    { path: "/", contains: `Prepared package ${RELEASE_VERSION}` },
    { path: "/updates/", contains: `Prepared source package: ${RELEASE_VERSION}` },
    { path: "/developer-portal/", contains: "Developer Portal" },
    { path: "/docs/", contains: "Docs" },
    { path: "/contact/", contains: "Contact Mike Kappel" },
    { path: "/docs/runtime-portal/index.md", contains: "repository-retained historical evidence" },
  ],
  retired_files: retiredFiles,
  retired_route_checks: retiredRouteChecks,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${outputPath}\n${files.length} files\n`);
process.stdout.write(`${stagingRoot}\n`);
