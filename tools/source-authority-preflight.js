#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const crypto = require("node:crypto");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const MAX_GATE_OUTPUT_BYTES = 64 * 1024;
const EXPECTED_NODE_RUNTIME = Object.freeze({
  bytes: 91380224,
  sha256: "63c259c81e5d472b5f11c8d506070130cb04a1ecf84b80377a34ed6ec9048088",
});
const EXPECTED_SOURCE_AUTHORITY_VERIFIER = Object.freeze({
  // Canonical committed gate from TinyRustLM.com 70e890e; no copied gate is admitted.
  bytes: 141430,
  sha256: "f99083edfe7eae96279acafcb624eb88e1a26e43d5622d498711fe280691647d",
});

function sha256RegularFile(filePath, expectedBytes, label) {
  let item;
  try {
    item = fs.lstatSync(filePath);
  }
  catch {
    throw new Error(`${label} is unavailable.`);
  }
  if (
    !item.isFile() ||
    item.isSymbolicLink() ||
    !Number.isSafeInteger(expectedBytes) ||
    expectedBytes < 1 ||
    item.size !== expectedBytes
  ) {
    throw new Error(`${label} does not match its immutable expected identity or bounded regular-file shape.`);
  }

  const handle = fs.openSync(filePath, "r");
  const hash = crypto.createHash("sha256");
  const chunk = Buffer.allocUnsafe(Math.min(1024 * 1024, expectedBytes));
  let offset = 0;
  try {
    while (offset < expectedBytes) {
      const count = fs.readSync(
        handle,
        chunk,
        0,
        Math.min(chunk.length, expectedBytes - offset),
        offset,
      );
      if (count < 1) throw new Error(`${label} ended before its expected byte length.`);
      hash.update(chunk.subarray(0, count));
      offset += count;
    }
  }
  finally {
    fs.closeSync(handle);
  }
  return hash.digest("hex");
}

function assertFileIdentity(filePath, expectedIdentity, label) {
  if (
    !expectedIdentity ||
    !Number.isSafeInteger(expectedIdentity.bytes) ||
    !/^[0-9a-f]{64}$/u.test(expectedIdentity.sha256 || "")
  ) {
    throw new Error(`${label} expected identity is invalid.`);
  }
  const actualSha256 = sha256RegularFile(filePath, expectedIdentity.bytes, label);
  if (actualSha256 !== expectedIdentity.sha256) {
    throw new Error(`${label} does not match its immutable expected identity.`);
  }
}

function canonicalSourceAuthorityGatePath(repositoryRoot) {
  const resolvedRepository = path.resolve(repositoryRoot);
  return path.join(
    path.dirname(resolvedRepository),
    "TinyRustLM.com",
    "tinyrustlm",
    "tools",
    "verify-single-source-authority.js",
  );
}

function assertCanonicalSourceAuthority(repositoryRoot, options = {}) {
  const runtimePath = path.resolve(options.runtimePath || process.execPath);
  const gatePath = path.resolve(
    options.gatePath || canonicalSourceAuthorityGatePath(repositoryRoot),
  );
  assertFileIdentity(
    runtimePath,
    options.expectedRuntimeIdentity || EXPECTED_NODE_RUNTIME,
    "Source-authority Node runtime",
  );
  assertFileIdentity(
    gatePath,
    options.expectedGateIdentity || EXPECTED_SOURCE_AUTHORITY_VERIFIER,
    "Canonical source-authority verifier",
  );

  const childEnvironment = { ...process.env };
  delete childEnvironment.NODE_OPTIONS;
  delete childEnvironment.NODE_PATH;

  const result = spawnSync(runtimePath, [gatePath], {
    cwd: path.dirname(path.dirname(gatePath)),
    encoding: "utf8",
    env: childEnvironment,
    maxBuffer: MAX_GATE_OUTPUT_BYTES,
    timeout: 120000,
    windowsHide: true,
  });
  if (result.error || result.status !== 0) {
    throw new Error("Canonical source-authority gate failed closed.");
  }

  const lines = String(result.stdout || "").split(/\r?\n/u).filter(Boolean);
  let verdict;
  try {
    verdict = JSON.parse(lines.at(-1) || "");
  }
  catch {
    throw new Error("Canonical source-authority gate returned no exact JSON verdict.");
  }
  if (
    verdict.verdict !== "pass" ||
    verdict.canonicalLayoutAvailable !== true ||
    verdict.localScanPerformed !== true ||
    verdict.coverageClass !== "registered-governed-roots-only" ||
    verdict.wholeVolumeInventoryPerformed !== false
  ) {
    throw new Error("Canonical source-authority gate did not return the required pass verdict.");
  }
  return verdict;
}

if (require.main === module) {
  const repositoryRoot = path.resolve(__dirname, "..");
  assertCanonicalSourceAuthority(repositoryRoot);
  process.stdout.write("SOURCE_AUTHORITY_VALID\n");
}

module.exports = {
  EXPECTED_NODE_RUNTIME,
  EXPECTED_SOURCE_AUTHORITY_VERIFIER,
  assertFileIdentity,
  assertCanonicalSourceAuthority,
  canonicalSourceAuthorityGatePath,
};
