#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { TextDecoder } = require("node:util");
const { assertCanonicalSourceAuthority } = require("./source-authority-preflight.js");
const {
  assertDirectoryAbsent,
  assertPlainDirectory,
  assertPublishableArtifact,
  compareOrdinal,
  isPublicArtifactPath,
  normalizeRelativePath,
} = require("./public-artifact-policy.js");

const RELEASE_VERSION = "1.8.3";
const RELEASE_DATE = "2026-08-31";
const MIN_PUBLIC_ARTIFACTS = 20;
const MAX_PUBLIC_ARTIFACTS = 512;
const RETIREMENT_POLICY = "last-verified-publication-minus-current-public-closure";
const PACKAGE_MANIFEST_PATH = "docs/package-manifest.md";
const DEPLOYMENT_MANIFEST_PATH = "deploy/site-deployment-manifest.v1.json";
const HISTORICAL_RECEIPT_AUTHORITY = Object.freeze({
  commit: "6d56e6d4a1811a7d7b94d10ff384071ea866974e",
  blob: "fe5633220e96fb131957035a11f1245a96ec5a30",
  path: "deploy/receipts/site-deployment-20260830T014629Z.json",
});
const RETAINED_PRIVATE_REPORT_PATHS = Object.freeze([
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
]);
const REQUIRED_RETIRED_PATHS = new Set([
  ".uai/taboo.uai",
  ".uai/talisman.uai",
  ".uai/totem.uai",
  "docs/reports/gguf-mirust-all-source-review-bundle.txt",
  ...RETAINED_PRIVATE_REPORT_PATHS,
  "docs/runtime-portal/runtime-docs/workspace.uai",
]);
const HTTPS_READBACK_PATHS = new Set([
  ".uai/index.uai",
  ".uai/long-term-memory.uai",
  ".well-known/uaix-talisman.txt",
  "LICENSE.txt",
  "assets/css/site.css",
  "assets/js/site.js",
  "docs/long-term-memory.md",
  PACKAGE_MANIFEST_PATH,
  "docs/report-index.md",
  "docs/runtime-portal/index.md",
  "llms-full.txt",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true });

/** Read bounded Git output only from this module's canonical owning repository. */
function git(repositoryRoot, args, encoding = "utf8", input) {
  if (typeof repositoryRoot !== "string" || !path.isAbsolute(repositoryRoot) ||
      path.relative(path.resolve(__dirname, ".."), path.resolve(repositoryRoot)) !== "") {
    throw new Error("Deployment validation requires the canonical repository root.");
  }
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    input,
    maxBuffer: 128 * 1024 * 1024,
    timeout: 30000,
  });
}

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function assertCommitId(value, label) {
  if (typeof value !== "string" || !/^[0-9a-f]{40}$/.test(value)) {
    throw new Error(`${label} must be one lowercase 40-character Git object ID.`);
  }
}

function decodeUtf8(bytes, label) {
  try {
    return UTF8_DECODER.decode(bytes);
  }
  catch {
    throw new Error(`${label} is not strict UTF-8.`);
  }
}

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value).sort(compareOrdinal).map(
      (key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`,
    ).join(",")}}`;
  }
  return JSON.stringify(value);
}

function exactJsonEqual(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function readGitBlobAt(repositoryRoot, commit, relativePath) {
  assertCommitId(commit, "Git commit");
  const blob = git(repositoryRoot, ["rev-parse", `${commit}:${relativePath}`]).trim();
  assertCommitId(blob, `Git blob for ${relativePath}`);
  const bytes = git(repositoryRoot, ["cat-file", "blob", blob], null);
  const rehashed = git(repositoryRoot, ["hash-object", "--stdin"], "utf8", bytes).trim();
  if (rehashed !== blob) {
    throw new Error(`Git blob bytes failed object-ID verification: ${relativePath}`);
  }
  return { blob, bytes };
}

function parseBoundedJson(bytes, label) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 2 || bytes.length > 2 * 1024 * 1024) {
    throw new Error(`${label} is not one bounded JSON artifact.`);
  }
  try {
    return JSON.parse(decodeUtf8(bytes, label));
  }
  catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${label} is not valid JSON.`);
    throw error;
  }
}

function readHistoricalPublicationAuthority(repositoryRoot) {
  git(repositoryRoot, ["cat-file", "-e", `${HISTORICAL_RECEIPT_AUTHORITY.commit}^{commit}`]);
  const historical = readGitBlobAt(
    repositoryRoot,
    HISTORICAL_RECEIPT_AUTHORITY.commit,
    HISTORICAL_RECEIPT_AUTHORITY.path,
  );
  if (historical.blob !== HISTORICAL_RECEIPT_AUTHORITY.blob) {
    throw new Error("Historical 1.8.2 receipt path does not resolve to its pinned Git blob.");
  }

  const receipt = parseBoundedJson(historical.bytes, "Historical 1.8.2 deployment receipt");
  if (
    receipt.schema !== "tinyrustlm.mirust.site_deployment_receipt.v1" ||
    receipt.site !== "TinyRustLM.MiRust.com" ||
    receipt.origin !== "https://tinyrustlm.mirust.com" ||
    receipt.version !== "1.8.2" ||
    receipt.status !== "published-and-readback-verified" ||
    !/^[0-9a-f]{40}$/.test(receipt.source_commit || "") ||
    !/^[0-9a-f]{40}$/.test(receipt.source_tree || "") ||
    !/^[0-9a-f]{40}$/.test(receipt.publisher_commit || "") ||
    !/^[0-9a-f]{64}$/.test(receipt.manifest_sha256 || "") ||
    !Number.isSafeInteger(receipt.file_count) ||
    !Number.isSafeInteger(receipt.total_bytes) ||
    !Array.isArray(receipt.files) ||
    receipt.files.length !== receipt.file_count
  ) {
    throw new Error("Historical 1.8.2 receipt identity or bounds are invalid.");
  }

  const sourceTree = git(repositoryRoot, ["rev-parse", `${receipt.source_commit}^{tree}`]).trim();
  if (sourceTree !== receipt.source_tree) {
    throw new Error("Historical 1.8.2 receipt source tree does not match its immutable commit.");
  }
  const historicalManifestBlob = readGitBlobAt(
    repositoryRoot,
    receipt.publisher_commit,
    DEPLOYMENT_MANIFEST_PATH,
  );
  if (sha256(historicalManifestBlob.bytes) !== receipt.manifest_sha256) {
    throw new Error("Historical 1.8.2 receipt does not bind the publisher commit's manifest bytes.");
  }
  const historicalManifest = parseBoundedJson(
    historicalManifestBlob.bytes,
    "Historical 1.8.2 deployment manifest",
  );
  if (
    historicalManifest.schema !== "tinyrustlm.mirust.site_deployment_manifest.v1" ||
    historicalManifest.site !== receipt.site ||
    historicalManifest.origin !== receipt.origin ||
    historicalManifest.version !== receipt.version ||
    historicalManifest.source_commit !== receipt.source_commit ||
    historicalManifest.source_tree !== receipt.source_tree ||
    !Array.isArray(historicalManifest.files) ||
    historicalManifest.files.length !== receipt.file_count
  ) {
    throw new Error("Historical 1.8.2 receipt and deployment manifest identities disagree.");
  }

  let publishedCount = 0;
  let alreadyCurrentCount = 0;
  let totalBytes = 0;
  for (let index = 0; index < receipt.files.length; index += 1) {
    const observed = receipt.files[index];
    const declared = historicalManifest.files[index];
    if (
      observed.path !== declared.path ||
      observed.bytes !== declared.bytes ||
      observed.sha256 !== declared.sha256 ||
      !["published", "already-current"].includes(observed.status)
    ) {
      throw new Error(`Historical 1.8.2 receipt file closure disagrees at index ${index}.`);
    }
    totalBytes += observed.bytes;
    if (observed.status === "published") publishedCount += 1;
    else alreadyCurrentCount += 1;
  }
  if (
    totalBytes !== receipt.total_bytes ||
    publishedCount !== receipt.published_count ||
    alreadyCurrentCount !== receipt.already_current_count ||
    publishedCount + alreadyCurrentCount !== receipt.file_count
  ) {
    throw new Error("Historical 1.8.2 receipt aggregate closure is inconsistent.");
  }

  return {
    publication: Object.freeze({
      version: receipt.version,
      source_commit: receipt.source_commit,
      source_tree: receipt.source_tree,
      receipt: HISTORICAL_RECEIPT_AUTHORITY.path,
      receipt_git_commit: HISTORICAL_RECEIPT_AUTHORITY.commit,
      receipt_git_blob: `sha1:${historical.blob}`,
      receipt_bytes: historical.bytes.length,
      receipt_sha256: sha256(historical.bytes),
    }),
    receipt,
    receiptBytes: historical.bytes,
    manifest: historicalManifest,
  };
}

function readPublicCommitClosure(repositoryRoot, commit, options = {}) {
  assertCommitId(commit, "Public closure commit");
  git(repositoryRoot, ["cat-file", "-e", `${commit}^{commit}`]);
  const excluded = new Set(options.excludedPaths || []);
  const listing = decodeUtf8(
    git(repositoryRoot, ["ls-tree", "-r", "-z", "--long", "--full-tree", commit], null),
    "Git public closure listing",
  );
  const entries = listing.split("\0").filter(Boolean).map((entry) => {
    const match = entry.match(/^[0-9]{6} blob ([0-9a-f]{40})\s+([0-9]+)\t([\s\S]+)$/);
    if (!match) throw new Error("Git public closure contains a non-blob or malformed entry.");
    return { blob: match[1], bytes: Number(match[2]), path: match[3] };
  }).filter((entry) => !excluded.has(entry.path) && isPublicArtifactPath(entry.path))
    .sort((left, right) => compareOrdinal(left.path, right.path));

  const request = Buffer.from(`${entries.map((entry) => entry.blob).join("\n")}\n`, "ascii");
  const batch = git(repositoryRoot, ["cat-file", "--batch"], null, request);
  let offset = 0;
  const closure = entries.map((entry) => {
    const headerEnd = batch.indexOf(0x0a, offset);
    if (headerEnd < 0) throw new Error(`Git batch response is truncated before ${entry.path}.`);
    const header = batch.subarray(offset, headerEnd).toString("ascii");
    const match = header.match(/^([0-9a-f]{40}) blob ([0-9]+)$/);
    if (!match || match[1] !== entry.blob || Number(match[2]) !== entry.bytes) {
      throw new Error(`Git batch response identity disagrees for ${entry.path}.`);
    }
    const contentStart = headerEnd + 1;
    const contentEnd = contentStart + entry.bytes;
    if (contentEnd >= batch.length || batch[contentEnd] !== 0x0a) {
      throw new Error(`Git batch response bytes are truncated for ${entry.path}.`);
    }
    const committed = Buffer.from(batch.subarray(contentStart, contentEnd));
    // A matching batch header alone does not bind the returned payload to its Git object.
    const actualBlob = crypto.createHash("sha1")
      .update(`blob ${committed.length}\0`).update(committed).digest("hex");
    if (actualBlob !== entry.blob) {
      throw new Error(`Git batch payload failed object-ID verification: ${entry.path}`);
    }
    offset = contentEnd + 1;
    assertPublishableArtifact(entry.path, committed, { allowSiteSource: true });
    return {
      path: entry.path,
      bytes: committed.length,
      sha256: sha256(committed),
      committed,
    };
  });
  if (offset !== batch.length) {
    throw new Error("Git batch response contains trailing data after the public closure.");
  }
  return closure;
}

function deriveRetiredPaths(historicalFiles, currentFiles, requiredPaths = REQUIRED_RETIRED_PATHS) {
  if (!Array.isArray(historicalFiles) || historicalFiles.length < 1 || historicalFiles.length > 512) {
    throw new Error("Historical publication file closure is outside its bounds.");
  }
  if (!Array.isArray(currentFiles) || currentFiles.length < MIN_PUBLIC_ARTIFACTS || currentFiles.length > MAX_PUBLIC_ARTIFACTS) {
    throw new Error("Current public file closure is outside its bounds.");
  }
  const current = new Set(currentFiles.map((file) => normalizeRelativePath(String(file.path))));
  const historical = new Set();
  for (const file of historicalFiles) {
    const relativePath = normalizeRelativePath(String(file.path));
    if (historical.has(relativePath)) {
      throw new Error(`Historical publication contains a duplicate path: ${relativePath}`);
    }
    historical.add(relativePath);
  }
  const retired = [...historical].filter((relativePath) => !current.has(relativePath)).sort(compareOrdinal);
  for (const required of requiredPaths) {
    if (!retired.includes(required)) {
      throw new Error(`Required private publication retirement is missing: ${required}`);
    }
  }
  return retired;
}

function buildRetiredRouteChecks(retiredPaths) {
  const special = new Map([
    [".uai/taboo.uai", ["/.uai/taboo.uai", "/.UAI/TABOO.UAI", "/.uai/%74aboo%2Euai", "/.uai%2Ftaboo.uai"]],
    [".uai/talisman.uai", ["/.uai/talisman.uai", "/.UAI/TALISMAN.UAI", "/.uai/%74alisman%2Euai", "/.uai%2Ftalisman.uai"]],
    [".uai/totem.uai", ["/.uai/totem.uai", "/.UAI/TOTEM.UAI", "/.uai/%74otem%2Euai", "/.uai%2Ftotem.uai"]],
    ["docs/reports/gguf-mirust-all-source-review-bundle.txt", [
      "/docs/reports/gguf-mirust-all-source-review-bundle.txt",
      "/DOCS/REPORTS/GGUF-MIRUST-ALL-SOURCE-REVIEW-BUNDLE.TXT",
      "/docs/reports/%67%67%75%66-mirust-all-source-review-bundle%2Etxt",
      "/docs%2Freports%2Fgguf-mirust-all-source-review-bundle.txt",
    ]],
    ["docs/runtime-portal/runtime-docs/workspace.uai", [
      "/docs/runtime-portal/runtime-docs/workspace.uai",
      "/DoCs/RuNtImE-PoRtAl/RuNtImE-DoCs/WoRkSpAcE.UaI",
      "/docs/runtime-portal/runtime-docs/%77orkspace%2Euai",
      "/docs%2Fruntime-portal%2Fruntime-docs%2Fworkspace.uai",
    ]],
  ]);
  return retiredPaths.map((relativePath) => {
    let variants = special.get(relativePath);
    if (!variants && relativePath.startsWith("docs/reports/")) {
      const basename = path.posix.basename(relativePath);
      const dot = basename.lastIndexOf(".");
      const first = basename.codePointAt(0).toString(16).padStart(2, "0");
      const encodedBasename = `%${first}${basename.slice(1, dot)}%2E${basename.slice(dot + 1)}`;
      variants = [
        `/${relativePath}`,
        `/${relativePath.toUpperCase()}`,
        `/docs/reports/${encodedBasename}`,
        `/${relativePath.replaceAll("/", "%2F")}`,
      ];
    }
    return {
      canonical_path: `/${relativePath}`,
      variants: variants || [`/${relativePath}`],
    };
  });
}

function assertHistoricalPublicationShape(publication) {
  if (
    !publication || typeof publication !== "object" ||
    typeof publication.version !== "string" ||
    !/^[0-9a-f]{40}$/.test(publication.source_commit || "") ||
    !/^[0-9a-f]{40}$/.test(publication.source_tree || "") ||
    typeof publication.receipt !== "string" ||
    !/^[0-9a-f]{40}$/.test(publication.receipt_git_commit || "") ||
    !/^sha1:[0-9a-f]{40}$/.test(publication.receipt_git_blob || "") ||
    !Number.isSafeInteger(publication.receipt_bytes) || publication.receipt_bytes < 1 ||
    !/^[0-9a-f]{64}$/.test(publication.receipt_sha256 || "")
  ) {
    throw new Error("Last-verified publication authority is malformed.");
  }
}

function buildPackageManifestDocument(repositoryRoot, basisCommit, options = {}) {
  assertCommitId(basisCommit, "Package content-basis commit");
  const releaseVersion = options.releaseVersion || RELEASE_VERSION;
  const releaseDate = options.releaseDate || RELEASE_DATE;
  const historicalPublication = options.historicalPublication ||
    readHistoricalPublicationAuthority(repositoryRoot).publication;
  assertHistoricalPublicationShape(historicalPublication);

  const sourceTree = git(repositoryRoot, ["rev-parse", `${basisCommit}^{tree}`]).trim();
  const files = readPublicCommitClosure(repositoryRoot, basisCommit, {
    excludedPaths: [PACKAGE_MANIFEST_PATH],
  });
  if (files.length < MIN_PUBLIC_ARTIFACTS || files.length > MAX_PUBLIC_ARTIFACTS) {
    throw new Error(`Unexpected public package closure size: ${files.length}`);
  }
  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const rows = files.map(
    (file) => `| \`${file.path}\` | ${file.bytes} | \`${file.sha256}\` |`,
  );
  const document = [
    "# TinyRustLM Public Package Manifest",
    "",
    `- Version: \`${releaseVersion}\``,
    `- Release date: \`${releaseDate}\``,
    "- Status: `commit-bound-candidate`; this manifest is not deployment evidence.",
    `- Last verified publication: \`${historicalPublication.version}\` via \`${historicalPublication.receipt}\`.`,
    `- Last verified receipt authority: Git commit \`${historicalPublication.receipt_git_commit}\`, blob \`${historicalPublication.receipt_git_blob}\`, ${historicalPublication.receipt_bytes} bytes, SHA-256 \`${historicalPublication.receipt_sha256}\`.`,
    `- Content-basis commit: \`${basisCommit}\``,
    `- Content-basis tree: \`${sourceTree}\``,
    `- Public files, excluding this manifest: ${files.length}`,
    `- Public bytes, excluding this manifest: ${totalBytes}`,
    "",
    "This manifest excludes itself to avoid a recursive checksum. Historical",
    "runtime records remain repository-retained historical evidence. Their raw mirror",
    "is excluded from this public closure and creates no reader, compatibility path,",
    "fallback, migration, or product claim.",
    "",
    "| Path | Bytes | SHA-256 |",
    "| --- | ---: | --- |",
    ...rows,
    "",
  ].join("\n");
  return { document, files, sourceTree, totalBytes };
}

function readSinglePackageMetadata(document, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = [...document.matchAll(new RegExp("^- " + escaped + ": `([^`]+)`$", "gm"))];
  if (matches.length !== 1) {
    throw new Error(`Package manifest must contain exactly one ${label} field.`);
  }
  return matches[0][1];
}

function verifyPackageManifestTransaction(repositoryRoot, packageCommit, options = {}) {
  assertCommitId(packageCommit, "Package-manifest commit");
  const parents = git(repositoryRoot, ["rev-list", "--parents", "-n", "1", packageCommit])
    .trim()
    .split(/\s+/);
  if (parents.length !== 2 || parents[0] !== packageCommit) {
    throw new Error("Package-manifest C2 must have exactly one C1 parent.");
  }

  const actual = readGitBlobAt(repositoryRoot, packageCommit, PACKAGE_MANIFEST_PATH);
  const document = decodeUtf8(actual.bytes, "Committed package manifest");
  const basisCommit = readSinglePackageMetadata(document, "Content-basis commit");
  const basisTree = readSinglePackageMetadata(document, "Content-basis tree");
  assertCommitId(basisCommit, "Package content-basis commit");
  assertCommitId(basisTree, "Package content-basis tree");
  if (parents[1] !== basisCommit) {
    throw new Error("Package manifest basis commit must be the sole parent of package-only C2.");
  }
  const actualBasisTree = git(repositoryRoot, ["rev-parse", `${basisCommit}^{tree}`]).trim();
  if (actualBasisTree !== basisTree) {
    throw new Error("Package manifest basis tree does not match C1^{tree}.");
  }
  const changedPaths = git(repositoryRoot, [
    "diff-tree", "--no-commit-id", "--name-only", "-r", packageCommit, "--",
  ]).split(/\r?\n/).filter(Boolean);
  if (changedPaths.length !== 1 || changedPaths[0] !== PACKAGE_MANIFEST_PATH) {
    throw new Error(`Package-only C2 must change only ${PACKAGE_MANIFEST_PATH}.`);
  }

  const expected = buildPackageManifestDocument(repositoryRoot, basisCommit, options);
  const expectedBytes = Buffer.from(expected.document, "utf8");
  if (!actual.bytes.equals(expectedBytes)) {
    throw new Error("Committed package manifest does not exactly match the C1 public closure.");
  }
  assertPublishableArtifact(PACKAGE_MANIFEST_PATH, actual.bytes, { allowSiteSource: true });

  const packageTree = git(repositoryRoot, ["rev-parse", `${packageCommit}^{tree}`]).trim();
  const identity = Object.freeze({
    path: PACKAGE_MANIFEST_PATH,
    commit: packageCommit,
    tree: packageTree,
    basis_commit: basisCommit,
    basis_tree: basisTree,
    git_blob: `sha1:${actual.blob}`,
    bytes: actual.bytes.length,
    sha256: sha256(actual.bytes),
  });
  return {
    basisCommit,
    basisTree,
    identity,
    packageCommit,
    packageTree,
  };
}

/** Verify exact public bytes in their canonical checkout without a second staging tree. */
function validateDeploymentInput(manifestPath, options = {}) {
  const repositoryRoot = options.repositoryRoot || path.resolve(__dirname, "..");
  if (typeof repositoryRoot !== "string" || !path.isAbsolute(repositoryRoot) ||
      path.relative(path.resolve(__dirname, ".."), path.resolve(repositoryRoot)) !== "") {
    throw new Error("Deployment validation requires the canonical repository root.");
  }
  assertPlainDirectory(repositoryRoot);
  if (typeof manifestPath !== "string" || !path.isAbsolute(manifestPath) ||
      path.relative(path.join(repositoryRoot, DEPLOYMENT_MANIFEST_PATH), path.resolve(manifestPath)) !== "") {
    throw new Error("Deployment validation requires the canonical manifest path.");
  }
  assertPlainDirectory(path.dirname(manifestPath));
  assertDirectoryAbsent(path.join(repositoryRoot, "deploy", "staging", RELEASE_VERSION));
  const manifestItem = fs.lstatSync(manifestPath);
  if (!manifestItem.isFile() || manifestItem.isSymbolicLink() || manifestItem.size < 1 || manifestItem.size > 2 * 1024 * 1024) {
    throw new Error("Deployment manifest must be one bounded regular file.");
  }
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  if (
    manifest.schema !== "tinyrustlm.mirust.site_deployment_manifest.v1" ||
    manifest.site !== "TinyRustLM.MiRust.com" ||
    manifest.origin !== "https://tinyrustlm.mirust.com" ||
    manifest.version !== RELEASE_VERSION ||
    manifest.release_date !== RELEASE_DATE ||
    manifest.status !== "commit-bound-candidate" ||
    manifest.publication_claim !== "not-published-by-this-manifest" ||
    manifest.transport_profile !== "TinyRustLM.MiRust.com" ||
    !/^[0-9a-f]{40}$/.test(manifest.source_commit || "") ||
    !/^[0-9a-f]{40}$/.test(manifest.source_tree || "") ||
    !Array.isArray(manifest.files) ||
    manifest.files.length < MIN_PUBLIC_ARTIFACTS ||
    manifest.files.length > MAX_PUBLIC_ARTIFACTS ||
    manifest.retirement_policy !== RETIREMENT_POLICY
  ) {
    throw new Error("Deployment manifest identity or bounds are invalid.");
  }

  const authority = options.historicalAuthority ||
    ((!options.historicalPublication || !options.historicalFiles) ? readHistoricalPublicationAuthority(repositoryRoot) : null);
  const historicalPublication = options.historicalPublication || authority.publication;
  const historicalFiles = options.historicalFiles || authority.receipt.files;
  assertHistoricalPublicationShape(historicalPublication);
  if (!exactJsonEqual(manifest.last_verified_publication, historicalPublication)) {
    throw new Error("Deployment manifest last-verified publication identity is not exact.");
  }

  const packageTransaction = verifyPackageManifestTransaction(repositoryRoot, manifest.source_commit, {
    historicalPublication,
    releaseDate: manifest.release_date,
    releaseVersion: manifest.version,
  });
  if (packageTransaction.packageTree !== manifest.source_tree) {
    throw new Error("Deployment manifest source_tree does not equal package-only C2^{tree}.");
  }
  if (!exactJsonEqual(manifest.package_manifest, packageTransaction.identity)) {
    throw new Error("Deployment manifest package-manifest identity is not exact.");
  }
  const closure = readPublicCommitClosure(repositoryRoot, manifest.source_commit);
  git(repositoryRoot, ["merge-base", "--is-ancestor", manifest.source_commit, "HEAD"]);
  if (closure.length !== manifest.files.length) {
    throw new Error("Deployment manifest does not contain the exact public C2 path closure.");
  }
  const retiredPaths = deriveRetiredPaths(
    historicalFiles,
    closure,
    options.requiredRetiredPaths || REQUIRED_RETIRED_PATHS,
  );
  if (!exactJsonEqual(manifest.retired_files, retiredPaths)) {
    throw new Error("Deployment manifest retired-file deletion closure is not exact.");
  }
  if (!exactJsonEqual(manifest.retired_route_checks, buildRetiredRouteChecks(retiredPaths))) {
    throw new Error("Deployment manifest retired-route proof closure is not exact.");
  }
  // Ignored public files still exist and must not disappear from the byte closure.
  const localPaths = git(repositoryRoot, ["ls-files", "-z", "--cached", "--others"])
    .split("\0").filter(Boolean).filter(isPublicArtifactPath).sort(compareOrdinal);
  if (!exactJsonEqual(localPaths, closure.map((file) => file.path))) {
    throw new Error("Canonical public file count or path closure does not match the manifest.");
  }
  let totalBytes = 0;
  for (let index = 0; index < closure.length; index += 1) {
    const committed = closure[index];
    const expectedFile = {
      path: committed.path,
      bytes: committed.bytes,
      sha256: committed.sha256,
      https_readback_path: HTTPS_READBACK_PATHS.has(committed.path) ? `/${committed.path}` : null,
    };
    if (!exactJsonEqual(manifest.files[index], expectedFile)) {
      throw new Error(`Deployment manifest file identity disagrees with C2: ${committed.path}`);
    }
    const relativePath = normalizeRelativePath(manifest.files[index].path);
    if (!isPublicArtifactPath(relativePath) || retiredPaths.includes(relativePath)) {
      throw new Error(`Deployment manifest contains a forbidden or non-public path: ${relativePath}`);
    }
    const absolutePath = path.join(repositoryRoot, ...relativePath.split("/"));
    assertPlainDirectory(path.dirname(absolutePath));
    const stat = fs.lstatSync(absolutePath);
    if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== expectedFile.bytes || stat.size > 16777216) {
      throw new Error(`Canonical public file is not the declared regular file: ${relativePath}`);
    }
    const bytes = fs.readFileSync(absolutePath);
    assertPublishableArtifact(relativePath, bytes, { allowSiteSource: true });
    if (bytes.length !== expectedFile.bytes || sha256(bytes) !== expectedFile.sha256) {
      throw new Error(`Canonical public file identity mismatch: ${relativePath}`);
    }
    totalBytes += bytes.length;
    if (totalBytes > 67108864) throw new Error("Canonical public closure exceeds its total byte bound.");
  }
  return { fileCount: closure.length, totalBytes, manifest, packageTransaction };
}

if (require.main === module) {
  const repositoryRoot = path.resolve(__dirname, "..");
  assertCanonicalSourceAuthority(repositoryRoot);
  const manifestPath = process.argv[2];
  if (!manifestPath || process.argv.length !== 3) {
    throw new Error("Usage: node tools/verify-site-deployment-input.js <canonical-manifest>");
  }
  const result = validateDeploymentInput(path.resolve(manifestPath));
  process.stdout.write(`POLICY_VALID ${result.fileCount} files\n`);
}

module.exports = {
  DEPLOYMENT_MANIFEST_PATH,
  HISTORICAL_RECEIPT_AUTHORITY,
  HTTPS_READBACK_PATHS,
  MAX_PUBLIC_ARTIFACTS,
  MIN_PUBLIC_ARTIFACTS,
  PACKAGE_MANIFEST_PATH,
  RELEASE_DATE,
  RELEASE_VERSION,
  RETAINED_PRIVATE_REPORT_PATHS,
  REQUIRED_RETIRED_PATHS,
  RETIREMENT_POLICY,
  buildRetiredRouteChecks,
  buildPackageManifestDocument,
  deriveRetiredPaths,
  readHistoricalPublicationAuthority,
  readPublicCommitClosure,
  validateDeploymentInput,
  verifyPackageManifestTransaction,
};
