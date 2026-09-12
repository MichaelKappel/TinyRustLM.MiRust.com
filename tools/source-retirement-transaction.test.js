#!/usr/bin/env node
"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");
const { temporaryDirectory } = require("./test-artifacts.js");
const repositoryRoot = path.resolve(__dirname, "..");
const scriptPath = path.join(__dirname, "retire-public-source-copies.ps1");
const powershell = process.platform === "win32" ? "powershell.exe" : "pwsh";
const goneBody = Buffer.from("This public source copy has been permanently retired.\n", "utf8");
const retiredPaths = [
  "docs/reports/gguf-mirust-all-source-review-bundle.txt",
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
  "docs/runtime-portal/runtime-docs/workspace.uai",
  ".uai/taboo.uai",
  ".uai/talisman.uai",
  ".uai/totem.uai",
];

/** Run the canonical script without creating source, site or authority copies. */
function runPowerShell(arguments_, env = process.env) {
  return spawnSync(powershell, ["-NoLogo", "-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", ...arguments_], {
    cwd: repositoryRoot, encoding: "utf8", windowsHide: true, timeout: 180000, maxBuffer: 2 * 1024 * 1024, env,
  });
}

test("Apache retirement payload is exact, narrow, and independent from PHP", () => {
  assert.equal(goneBody.length, 54);
  assert.deepEqual(fs.readFileSync(path.join(repositoryRoot, "docs", "retired-source-copy-gone.txt")), goneBody);

  const root = fs.readFileSync(path.join(repositoryRoot, ".htaccess"), "utf8");
  const uaiRule = "RewriteRule ^\\.uai/(?!index\\.uai$|long-term-memory\\.uai$).+ - [G,NC]";
  const archiveRule = "RewriteRule ^docs/runtime-portal/(?!index\\.md$).+ - [G,NC]";
  const bypass = "RewriteCond %{REQUEST_FILENAME} -f [OR]";
  assert.ok(root.indexOf(uaiRule) >= 0 && root.indexOf(uaiRule) < root.indexOf(bypass));
  const reportRule = root.indexOf("RewriteRule ^docs/reports/(?:");
  assert.ok(reportRule >= 0 && reportRule < root.indexOf(bypass));
  for (const relativePath of retiredPaths.filter((item) => item.startsWith("docs/reports/"))) {
    assert.ok(root.includes(path.posix.basename(relativePath).replace(".", "\\.")), relativePath);
  }
  assert.ok(root.indexOf(archiveRule) >= 0 && root.indexOf(archiveRule) < root.indexOf(bypass));
  assert.doesNotMatch(root, /all-source-review-bundle\\\.txt\$ index\.php/i);
  assert.doesNotMatch(root, /workspace\\\.uai\$ index\.php/i);
  assert.match(root, /^ErrorDocument 410 \/docs\/retired-source-copy-gone\.txt$/m);
  assert.match(root, /^Header always set Cache-Control "no-store"$/m);
  assert.match(root, /^Header always set X-Robots-Tag "noindex, nofollow"$/m);
  assert.match(root, /^Header always set X-Content-Type-Options "nosniff"$/m);
  assert.match(root, /^Header always set Content-Type "text\/plain; charset=utf-8"$/m);

  const reportGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "reports", ".htaccess"), "utf8");
  const archiveGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "runtime-portal", ".htaccess"), "utf8");
  const workspaceGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "runtime-portal", "runtime-docs", ".htaccess"), "utf8");
  const uaiGuard = fs.readFileSync(path.join(repositoryRoot, ".uai", ".htaccess"), "utf8");
  assert.match(reportGuard, /^RewriteRule \^\(\?:/m);
  for (const relativePath of retiredPaths.filter((item) => item.startsWith("docs/reports/"))) {
    assert.ok(reportGuard.includes(path.posix.basename(relativePath).replace(".", "\\.")), relativePath);
  }
  assert.match(archiveGuard, /^RewriteRule \^\(\?!index\\\.md\$\)\.\+ - \[G,NC\]$/m);
  assert.match(workspaceGuard, /^RewriteRule \^workspace\\\.uai\$ - \[G,NC\]$/m);
  assert.match(uaiGuard, /<FilesMatch "\^\(index\|long-term-memory\)\\\.uai\$">/);
  assert.match(uaiGuard, /<FilesMatch "\^\(\?!\(index\|long-term-memory\)\\\.uai\$\)\.\+">/);
});


test("canonical preflight remains blocked before credentials or network despite hostile Node options", () => {
  const receiptRoot = path.join(repositoryRoot, "deploy/source-retirement-receipts");
  const before = fs.existsSync(receiptRoot) ? fs.readdirSync(receiptRoot).sort() : null;
  const result = runPowerShell(["-File", scriptPath, "-NodeExecutablePath", process.execPath], {
    ...process.env, NODE_OPTIONS: "--require definitely-not-loaded", NODE_PATH: "definitely-not-searched",
  });
  assert.ifError(result.error);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr + result.stdout, /blocked pending an independently attested secret-free tuple digest/i);
  assert.deepEqual(fs.existsSync(receiptRoot) ? fs.readdirSync(receiptRoot).sort() : null, before);
});

for (const parameter of ["-FixtureRoot", "-FixtureFault"]) {
  test("retired fixture parameter rejects before any work: " + parameter, () => {
    const result = runPowerShell(["-File", scriptPath, parameter, "not-created"]);
    assert.ifError(result.error);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr + result.stdout, /NamedParameterNotFound|parameter cannot be found/i);
  });
}

test("actual PowerShell transaction preserves failure custody using in-memory transport", (context) => {
  const scratch = temporaryDirectory(context, "retirement-pester-");
  const command = [
    "$result = Invoke-Pester -Script './tools/retire-public-source-copies_test.ps1' -CodeCoverage './tools/retire-public-source-copies.ps1' -PassThru -Quiet",
    "$failures = @($result.TestResult | Where-Object { $_.Result -eq 'Failed' } | ForEach-Object { @{ name=$_.Name; message=([string]$_.FailureMessage).Substring(0,[Math]::Min(800,([string]$_.FailureMessage).Length))} })",
    "$record = @{total=$result.TotalCount;passed=$result.PassedCount;failed=$result.FailedCount;skipped=$result.SkippedCount;failures=$failures;commandsAnalyzed=$result.CodeCoverage.NumberOfCommandsAnalyzed;commandsExecuted=$result.CodeCoverage.NumberOfCommandsExecuted}",
    "$record.changedFunctions = @('Initialize-SourceRetirementState','Invoke-SourceRetirementTransaction','Invoke-SourceRetirement') | ForEach-Object { $name=$_; $hit=@($result.CodeCoverage.HitCommands | Where-Object { $_.Function -eq $name }).Count; $miss=@($result.CodeCoverage.MissedCommands | Where-Object { $_.Function -eq $name }).Count; @{name=$name;hit=$hit;miss=$miss} }",
    "Write-Output ('RETIREMENT_TEST_RESULT=' + ($record | ConvertTo-Json -Depth 5 -Compress))",
    "if ($result.FailedCount -ne 0) { exit 1 }",
  ].join("; ");
  const result = runPowerShell(["-Command", command], {...process.env, TEMP:scratch, TMP:scratch});
  assert.ifError(result.error);
  const match = result.stdout.match(/^RETIREMENT_TEST_RESULT=(.+)$/m);
  assert.ok(match, result.stderr + result.stdout);
  const report = JSON.parse(match[1]);
  context.diagnostic(JSON.stringify(report));
  assert.equal(result.status, 0, JSON.stringify(report));
  assert.equal(report.failed, 0);
  assert.equal(report.skipped, 0);
  assert.ok(report.total >= 17);
});
