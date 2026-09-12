"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const php = process.env.PHP_BINARY || (process.platform === "win32" ? "C:\\php\\php.exe" : "php");
const phpReady = spawnSync(php, ["-v"], { windowsHide: true }).status === 0;

/** Invoke the real PHP path boundary without a copied source or PHP fixture file. */
function resolveFile(root, relative) {
  const result = spawnSync(php, ["-r",
    "require $argv[1]; echo json_encode(preview_direct_file($argv[2], $argv[3]));",
    path.join(__dirname, "preview-router.php"), root, relative],
  { encoding: "utf8", windowsHide: true });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test("preview resolves only canonical direct files within its root", {
  skip: phpReady ? false : "PHP CLI is unavailable",
}, () => {
  assert.equal(resolveFile(repositoryRoot, "README.md"), path.join(repositoryRoot, "README.md"));
  for (const relative of ["", "../README.md", "./README.md", "/README.md",
    "tools//preview-router.php", "tools/../README.md", "missing-file.txt", "tools"]) {
    assert.equal(resolveFile(repositoryRoot, relative), null, relative);
  }
  assert.equal(resolveFile(path.join(repositoryRoot, "missing-root"), "README.md"), null);
});

test("preview refuses a directory link even when its target is inside the root", {
  skip: phpReady ? false : "PHP CLI is unavailable",
}, (t) => {
  const parent = path.join(repositoryRoot, "artifacts");
  fs.mkdirSync(parent, { recursive: true });
  assert.equal(fs.realpathSync.native(parent), parent);
  const root = fs.mkdtempSync(path.join(parent, "preview-path-"));
  const marker = crypto.randomUUID();
  const markerPath = path.join(root, ".operation-owner.json");
  fs.writeFileSync(markerPath, marker, { flag: "wx" });
  try {
    const direct = path.join(root, "direct");
    fs.mkdirSync(direct);
    fs.writeFileSync(path.join(direct, "probe.txt"), "bounded non-product path probe\n");
    try { fs.symlinkSync(direct, path.join(root, "alias"), process.platform === "win32" ? "junction" : "dir"); }
    catch (error) {
      if (error.code !== "EPERM" && error.code !== "EACCES") throw error;
      t.skip("Local account cannot create the directory-link probe");
      return;
    }
    assert.equal(resolveFile(root, "direct/probe.txt"), path.join(direct, "probe.txt"));
    assert.equal(resolveFile(root, "alias/probe.txt"), null);
    assert.equal(resolveFile(path.join(root, "alias"), "probe.txt"), null);
  } finally {
    assert.equal(path.dirname(root), parent);
    assert.equal(fs.realpathSync.native(root), root);
    assert.equal(fs.readFileSync(markerPath, "utf8"), marker);
    fs.rmSync(root, { recursive: true });
    assert.equal(fs.existsSync(root), false);
  }
});
