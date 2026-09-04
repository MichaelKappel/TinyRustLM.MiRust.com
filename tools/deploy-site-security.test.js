#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const deployScript = path.join(repositoryRoot, "tools", "deploy-site.ps1");
const deployReadme = path.join(repositoryRoot, "deploy", "README.md");
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";

test("legacy full-site publish fails before manifest, credentials, receipts, or remote mutation", () => {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-disabled-publisher-"));
  try {
    const report = path.join(owner, "must-not-exist.json");
    const result = spawnSync(powershell, [
      "-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass",
      "-File", deployScript,
      "-NodeExecutablePath", process.execPath,
      "-Publish",
      "-ManifestPath", path.join(owner, "missing-manifest.json"),
      "-FileZillaProfilePath", path.join(owner, "missing-profile.xml"),
      "-ReportPath", report,
    ], {
      cwd: repositoryRoot,
      encoding: "utf8",
      maxBuffer: 2 * 1024 * 1024,
      windowsHide: true,
    });
    assert.notEqual(result.status, 0);
    assert.match(`${result.stderr}\n${result.stdout}`, /Legacy full-site publishing is disabled/u);
    assert.deepEqual(fs.readdirSync(owner), []);
    assert.equal(fs.existsSync(report), false);
  }
  finally { fs.rmSync(owner, { recursive: true, force: true }); }
});

test("disabled publish guard precedes every legacy publisher dependency and mutation call", () => {
  const source = fs.readFileSync(deployScript, "utf8");
  const disabledGate = source.indexOf("if ($Publish) {");
  assert.ok(disabledGate >= 0);
  for (const later of [
    "Add-Type -AssemblyName System.Net.Http",
    "$manifestItem = Get-Item",
    "$profile = Get-CredentialProfile",
    "$status = Publish-File",
    "Remove-RemoteFileIfPresent -RemotePath $currentPath",
    "Write-Receipt -Receipt $receipt",
  ]) {
    const offset = source.indexOf(later);
    assert.ok(offset > disabledGate, later);
  }
  assert.match(source, /Complete the hardened source-retirement transaction/u);
  assert.doesNotMatch(source, /&\s+node\b/iu);
  assert.match(source, /&\s+\$resolvedNode\s+\$preflightItem\.FullName/iu);
  assert.match(source, /Source-authority Node runtime does not match its immutable expected identity/u);
});

test("deployment instructions expose validation only and require exact retirement evidence", () => {
  const source = fs.readFileSync(deployReadme, "utf8");
  assert.match(source, /`tools\/deploy-site\.ps1` is validation-only/u);
  assert.match(source, /There is currently no authorized full-site publisher/u);
  assert.match(source, /terminal status\s+`retired-routes-verified`/u);
  assert.match(source, /future\s+publisher must require its exact committed identity/u);
  assert.match(source, /-NodeExecutablePath/u);
  assert.match(source, /exact checked-in byte\s+length and SHA-256 identity/u);
  assert.doesNotMatch(source, /^\s*&\s+\.\\tools\\deploy-site\.ps1\s+-Publish\b/mu);
});
