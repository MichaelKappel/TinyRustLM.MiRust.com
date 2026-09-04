#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const {
  EXPECTED_NODE_RUNTIME,
  EXPECTED_SOURCE_AUTHORITY_VERIFIER,
  assertFileIdentity,
  assertCanonicalSourceAuthority,
  canonicalSourceAuthorityGatePath,
} = require("./source-authority-preflight.js");

const repositoryRoot = path.resolve(__dirname, "..");

function fileIdentity(filePath) {
  const bytes = fs.readFileSync(filePath);
  return {
    bytes: bytes.length,
    sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
  };
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

test("a hostile authority-gate failure stops the guarded action", () => {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-authority-hostile-"));
  try {
    const gatePath = path.join(owner, "hostile-gate.js");
    const gateMarker = path.join(owner, "gate-ran.txt");
    const actionMarker = path.join(owner, "action-ran.txt");
    fs.writeFileSync(
      gatePath,
      `require('node:fs').writeFileSync(${JSON.stringify(gateMarker)}, 'failed gate reached\\n'); process.exit(23);\n`,
    );
    assert.throws(() => {
      assertCanonicalSourceAuthority(repositoryRoot, {
        gatePath,
        expectedGateIdentity: fileIdentity(gatePath),
      });
      fs.writeFileSync(actionMarker, "forbidden action\n");
    }, /source-authority gate failed/i);
    assert.equal(fs.existsSync(gateMarker), true);
    assert.equal(fs.existsSync(actionMarker), false);
  }
  finally {
    fs.rmSync(owner, { recursive: true, force: true });
  }
});

test("a pass-shaped mutable verifier is rejected before it can execute", () => {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-authority-identity-"));
  try {
    const gatePath = path.join(owner, "untrusted-gate.js");
    const gateMarker = path.join(owner, "gate-ran.txt");
    fs.writeFileSync(
      gatePath,
      `require('node:fs').writeFileSync(${JSON.stringify(gateMarker)}, 'must not run\\n'); process.stdout.write(JSON.stringify({canonicalLayoutAvailable:true,coverageClass:'registered-governed-roots-only',localScanPerformed:true,verdict:'pass',wholeVolumeInventoryPerformed:false}) + '\\n');\n`,
    );
    assert.throws(
      () => assertCanonicalSourceAuthority(repositoryRoot, { gatePath }),
      /immutable expected identity/i,
    );
    assert.equal(fs.existsSync(gateMarker), false);
  }
  finally {
    fs.rmSync(owner, { recursive: true, force: true });
  }
});

test("a mismatched Node runtime identity is rejected before verifier execution", () => {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-authority-runtime-"));
  try {
    const gatePath = path.join(owner, "gate.js");
    const gateMarker = path.join(owner, "gate-ran.txt");
    fs.writeFileSync(
      gatePath,
      `require('node:fs').writeFileSync(${JSON.stringify(gateMarker)}, 'must not run\\n');\n`,
    );
    assert.throws(
      () => assertCanonicalSourceAuthority(repositoryRoot, {
        gatePath,
        expectedGateIdentity: fileIdentity(gatePath),
        expectedRuntimeIdentity: {
          bytes: EXPECTED_NODE_RUNTIME.bytes,
          sha256: "0".repeat(64),
        },
      }),
      /Node runtime does not match its immutable expected identity/i,
    );
    assert.equal(fs.existsSync(gateMarker), false);
  }
  finally {
    fs.rmSync(owner, { recursive: true, force: true });
  }
});

test("hostile gate failure reaches neither archive snapshot nor deployment input", () => {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-authority-entrypoint-"));
  try {
    const rustRoot = path.join(owner, "Rust");
    const siteRoot = path.join(rustRoot, "TinyRustLM.MiRust.com");
    const toolsRoot = path.join(siteRoot, "tools");
    const archiveRoot = path.join(siteRoot, "docs", "runtime-portal");
    const gateRoot = path.join(rustRoot, "TinyRustLM.com", "tinyrustlm", "tools");
    const gateMarker = path.join(owner, "gate-ran.txt");
    fs.mkdirSync(toolsRoot, { recursive: true });
    fs.mkdirSync(archiveRoot, { recursive: true });
    fs.mkdirSync(gateRoot, { recursive: true });
    fs.writeFileSync(path.join(archiveRoot, "evidence.md"), "must not be inventoried\n");
    for (const relativePath of [
      "tools/build-runtime-archive-manifest.js",
      "tools/source-authority-preflight.js",
      "tools/deploy-site.ps1",
    ]) {
      fs.copyFileSync(
        path.join(repositoryRoot, ...relativePath.split("/")),
        path.join(siteRoot, ...relativePath.split("/")),
      );
    }
    fs.writeFileSync(
      path.join(gateRoot, "verify-single-source-authority.js"),
      `require('node:fs').writeFileSync(${JSON.stringify(gateMarker)}, 'hostile gate reached\\n'); process.exit(29);\n`,
    );

    const archive = spawnSync(process.execPath, [
      path.join(toolsRoot, "build-runtime-archive-manifest.js"),
    ], { cwd: siteRoot, encoding: "utf8", windowsHide: true });
    assert.notEqual(archive.status, 0);
    assert.match(`${archive.stderr}\n${archive.stdout}`, /immutable expected identity/i);
    assert.equal(fs.existsSync(path.join(archiveRoot, "MANIFEST.md")), false);

    if (process.platform === "win32") {
      const reportPath = path.join(owner, "forbidden-report.json");
      const deployment = spawnSync("powershell.exe", [
        "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
        "-File", path.join(toolsRoot, "deploy-site.ps1"),
        "-NodeExecutablePath", process.execPath,
        "-ManifestPath", path.join(owner, "missing-manifest.json"),
        "-FileZillaProfilePath", path.join(owner, "missing-profile.xml"),
        "-ReportPath", reportPath,
      ], { cwd: siteRoot, encoding: "utf8", windowsHide: true });
      assert.notEqual(deployment.status, 0);
      assert.match(`${deployment.stderr}\n${deployment.stdout}`, /source-authority gate failed/i);
      assert.equal(fs.existsSync(reportPath), false);
    }
    assert.equal(fs.existsSync(gateMarker), false);
  }
  finally {
    fs.rmSync(owner, { recursive: true, force: true });
  }
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
