#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { assertPublishableArtifact } = require("./public-artifact-policy.js");
const { assertCanonicalSourceAuthority } = require("./source-authority-preflight.js");
const {
  PACKAGE_MANIFEST_PATH,
  RELEASE_DATE,
  RELEASE_VERSION,
  buildPackageManifestDocument,
  readHistoricalPublicationAuthority,
} = require("./verify-site-deployment-input.js");

const repositoryRoot = path.resolve(__dirname, "..");
assertCanonicalSourceAuthority(repositoryRoot);
const contentCommit = process.argv[2];
const outputPath = path.join(repositoryRoot, "docs", "package-manifest.md");
const historicalPublication = readHistoricalPublicationAuthority(repositoryRoot).publication;

if (contentCommit === "--check-prepared") {
  const prepared = fs.readFileSync(outputPath, "utf8");
  for (const marker of [
    `Prepared version: \`${RELEASE_VERSION}\``,
    `Prepared release date: \`${RELEASE_DATE}\``,
    "Status: `awaiting-content-commit`",
    "Content-basis commit: `pending`",
    `Last verified publication: \`${historicalPublication.version}\``,
    `Last verified receipt: \`${historicalPublication.receipt}\``,
  ]) {
    if (!prepared.includes(marker)) {
      throw new Error(`Prepared package manifest marker is missing: ${marker}`);
    }
  }
  process.stdout.write(`PREPARED ${RELEASE_VERSION}; commit-bound package manifest pending\n`);
  process.exit(0);
}

if (!/^[0-9a-f]{40}$/.test(contentCommit || "")) {
  throw new Error("Usage: node tools/build-public-package-manifest.js <40-character-content-commit>|--check-prepared");
}

const built = buildPackageManifestDocument(repositoryRoot, contentCommit, {
  historicalPublication,
  releaseDate: RELEASE_DATE,
  releaseVersion: RELEASE_VERSION,
});
const documentBytes = Buffer.from(built.document, "utf8");
assertPublishableArtifact(PACKAGE_MANIFEST_PATH, documentBytes, {
  allowSiteSource: true,
});
fs.writeFileSync(outputPath, documentBytes);
process.stdout.write(`${outputPath}\n${built.files.length} files\n${built.totalBytes} bytes\n`);
