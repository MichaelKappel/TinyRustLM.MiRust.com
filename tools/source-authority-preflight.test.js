#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const vm = require("node:vm");
const Module = require("node:module");
const {
  EXPECTED_NODE_RUNTIME,
  EXPECTED_SOURCE_AUTHORITY_VERIFIER,
  assertFileIdentity,
  canonicalSourceAuthorityGatePath,
} = require("./source-authority-preflight.js");

const repositoryRoot = path.resolve(__dirname, "..");

/** Execute canonical CommonJS source in memory with explicit process-boundary replies. */
function loadCanonical(name, dependencies, asMain = false) {
  const filename = path.join(__dirname, name);
  const module = { exports: {} };
  const originalRequire = Module.createRequire(filename);
  const require = (id) => Object.hasOwn(dependencies, id) ? dependencies[id] : originalRequire(id);
  require.main = asMain ? module : null;
  vm.runInNewContext(fs.readFileSync(filename, "utf8"), {
    require, module, exports: module.exports, __dirname, __filename: filename,
    process, Buffer, Set, Map, TextDecoder, console
  }, { filename });
  return module.exports;
}

test("checked-in identities bind the exact Node runtime and canonical verifier bytes", () => {
  assert.doesNotThrow(() => assertFileIdentity(
    process.execPath,
    EXPECTED_NODE_RUNTIME,
    "Source-authority Node runtime",
  ));
  assert.doesNotThrow(() => assertFileIdentity(
    canonicalSourceAuthorityGatePath(repositoryRoot),
    EXPECTED_SOURCE_AUTHORITY_VERIFIER,
    "Canonical source-authority verifier",
  ));
});

test("hostile, malformed and timed-out gate replies stop the guarded action", () => {
  for (const result of [
    { status: 23, stdout: "" }, { status: null, error: new Error("synthetic timeout") },
    { status: 0, stdout: "not-json" },
    { status: 0, stdout: JSON.stringify({ verdict: "pass", wholeVolumeInventoryPerformed: true }) }
  ]) {
    let invoked = 0;
    const api = loadCanonical("source-authority-preflight.js", {
      "node:child_process": { spawnSync(runtime, args, options) {
        invoked += 1;
        assert.equal(runtime, process.execPath);
        assert.equal(args[0], canonicalSourceAuthorityGatePath(repositoryRoot));
        assert.equal(options.timeout, 120000);
        assert.equal(options.env.NODE_OPTIONS, undefined);
        assert.equal(options.env.NODE_PATH, undefined);
        return result;
      } }
    });
    assert.throws(() => api.assertCanonicalSourceAuthority(repositoryRoot), /gate.*(?:failed|verdict)/i);
    assert.equal(invoked, 1);
  }
});

test("a substituted verifier or wrong Node identity is rejected before execution", () => {
  let invoked = 0;
  const api = loadCanonical("source-authority-preflight.js", {
    "node:child_process": { spawnSync() { invoked += 1; throw new Error("must not execute"); } }
  });
  assert.throws(() => api.assertCanonicalSourceAuthority(repositoryRoot, {
    gatePath: path.join(repositoryRoot, "README.md")
  }), /immutable expected identity/);
  assert.throws(() => api.assertCanonicalSourceAuthority(repositoryRoot, {
    expectedRuntimeIdentity: { bytes: EXPECTED_NODE_RUNTIME.bytes, sha256: "0".repeat(64) }
  }), /Node runtime does not match/);
  assert.equal(invoked, 0);
});

test("hostile gate prevents canonical CLI entrypoints from reading or writing deployment data", () => {
  for (const name of ["build-runtime-archive-manifest.js", "verify-site-deployment-input.js"]) {
    let gates = 0;
    let reads = 0;
    let writes = 0;
    assert.throws(() => loadCanonical(name, {
      "./source-authority-preflight.js": { assertCanonicalSourceAuthority(root) {
        assert.equal(root, repositoryRoot);
        gates += 1;
        throw new Error("synthetic hostile gate rejected");
      } },
      "node:fs": {
        readdirSync() { reads += 1; throw new Error("forbidden inventory read"); },
        lstatSync() { reads += 1; throw new Error("forbidden manifest read"); },
        writeFileSync() { writes += 1; throw new Error("forbidden artifact write"); }
      }
    }, true), /synthetic hostile gate rejected/);
    assert.equal(gates, 1);
    assert.equal(reads, 0);
    assert.equal(writes, 0);
  }
});

test("canonical PowerShell rejects a substituted runtime before deployment input or output", {
  skip: process.platform !== "win32"
}, () => {
  const nonce = crypto.randomBytes(12).toString("hex");
  const reportPath = path.join(repositoryRoot, "artifacts", `never-created-${nonce}.json`);
  const result = spawnSync("powershell.exe", [
    "-NoLogo", "-NoProfile", "-NonInteractive", "-File", path.join(__dirname, "deploy-site.ps1"),
    "-NodeExecutablePath", path.join(repositoryRoot, "README.md"),
    "-ManifestPath", path.join(repositoryRoot, "artifacts", `missing-${nonce}.json`)
  ], { cwd: repositoryRoot, encoding: "utf8", windowsHide: true, timeout: 10000 });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Node runtime does not match its immutable expected identity/);
  assert.equal(fs.existsSync(reportPath), false);
});

test("every release or deployment entrypoint gates before snapshot, staging, credentials, or transport", () => {
  const cases = [
    ["tools/build-public-package-manifest.js", "assertCanonicalSourceAuthority(repositoryRoot)", "readHistoricalPublicationAuthority(repositoryRoot)"],
    ["tools/build-runtime-archive-manifest.js", "assertCanonicalSourceAuthority(repositoryRoot)", "buildRuntimeArchiveManifest("],
    ["tools/build-site-deployment-manifest.js", "assertCanonicalSourceAuthority(repositoryRoot)", "readHistoricalPublicationAuthority(repositoryRoot)"],
    ["tools/verify-site-deployment-input.js", "assertCanonicalSourceAuthority(repositoryRoot)", "validateDeploymentInput("],
    ["tools/deploy-site.ps1", "Assert-CanonicalSourceAuthority", "$manifestItem = Get-Item"],
    ["tools/retire-public-source-copies.ps1", "Assert-CanonicalSourceAuthority", "$artifacts = @(Assert-LocalArtifacts)"],
  ];
  for (const [relativePath, gateNeedle, actionNeedle] of cases) {
    const source = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")), "utf8");
    const gate = source.lastIndexOf(gateNeedle);
    const action = source.lastIndexOf(actionNeedle);
    assert.ok(gate >= 0, `${relativePath} has no canonical authority gate`);
    assert.ok(action > gate, `${relativePath} can act before its authority gate`);
  }
});

test("PowerShell entrypoints invoke only an explicit identity-checked Node path", () => {
  for (const relativePath of [
    "tools/deploy-site.ps1",
    "tools/retire-public-source-copies.ps1",
  ]) {
    const source = fs.readFileSync(path.join(repositoryRoot, ...relativePath.split("/")), "utf8");
    assert.match(source, /\[string\]\$NodeExecutablePath = \$env:TINYRUSTLM_NODE_EXECUTABLE/u, relativePath);
    assert.ok(source.includes(`$expectedNodeExecutableBytes = [int64]${EXPECTED_NODE_RUNTIME.bytes}`), relativePath);
    assert.ok(source.includes(`$expectedNodeExecutableSha256 = "${EXPECTED_NODE_RUNTIME.sha256}"`), relativePath);
    assert.match(source, /Source-authority Node runtime does not match its immutable expected identity/u, relativePath);
    assert.match(source, /& \$resolvedNode \$preflightItem\.FullName/u, relativePath);
    assert.doesNotMatch(source, /&\s+node\b/iu, relativePath);
    assert.match(source, /Remove-Item Env:NODE_OPTIONS/u, relativePath);
    assert.match(source, /Remove-Item Env:NODE_PATH/u, relativePath);
  }
});
