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
  buildRuntimeArchiveManifest,
  readProspectiveGitBlobBytes,
} = require("./build-runtime-archive-manifest.js");

const repositoryRoot = path.resolve(__dirname, "..");

function sha256(bytes) {
  return crypto.createHash("sha256").update(bytes).digest("hex");
}

function makeFixture() {
  const owner = fs.mkdtempSync(path.join(os.tmpdir(), "tinyrustlm-runtime-manifest-"));
  const rustRoot = path.join(owner, "Rust");
  const siteRoot = path.join(rustRoot, "TinyRustLM.MiRust.com");
  const archiveRoot = path.join(siteRoot, "docs", "runtime-portal");
  fs.mkdirSync(path.join(archiveRoot, "runtime-docs"), { recursive: true });
  fs.writeFileSync(
    path.join(siteRoot, ".gitattributes"),
    "docs/runtime-portal/** text eol=lf\n",
  );
  const relativePath = "runtime-docs/crlf-proof.md";
  const worktreeBytes = Buffer.from("alpha\r\nbeta\r\n", "utf8");
  const gitBlobBytes = Buffer.from("alpha\nbeta\n", "utf8");
  fs.writeFileSync(path.join(archiveRoot, ...relativePath.split("/")), worktreeBytes);
  const git = spawnSync("git", ["init", "--quiet"], { cwd: siteRoot, encoding: "utf8" });
  assert.equal(git.status, 0, git.stderr);
  return { archiveRoot, gitBlobBytes, owner, relativePath, siteRoot, worktreeBytes };
}

function build(fixture) {
  return buildRuntimeArchiveManifest(fixture.siteRoot, fixture.archiveRoot);
}

function assertCurrent(fixture) {
  const built = build(fixture);
  const existing = readProspectiveGitBlobBytes(fixture.siteRoot, built.outputPath).toString("utf8");
  if (existing !== built.document) throw new Error("Historical runtime archive manifest is stale.");
}

test("runtime archive inventory hashes prospective LF Git blobs instead of CRLF worktree bytes", () => {
  const fixture = makeFixture();
  try {
    const result = build(fixture);
    const expectedRow = `| \`${fixture.relativePath}\` | ${fixture.gitBlobBytes.length} | \`${sha256(fixture.gitBlobBytes)}\` |`;
    const forbiddenRow = `| \`${fixture.relativePath}\` | ${fixture.worktreeBytes.length} | \`${sha256(fixture.worktreeBytes)}\` |`;
    assert.match(result.document, new RegExp(expectedRow.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.equal(result.document.includes(forbiddenRow), false);
  }
  finally {
    fs.rmSync(fixture.owner, { recursive: true, force: true });
  }
});

test("runtime archive check rejects a manifest that silently inventories CRLF bytes", () => {
  const fixture = makeFixture();
  try {
    const printed = build(fixture).document;
    const expectedRow = `| \`${fixture.relativePath}\` | ${fixture.gitBlobBytes.length} | \`${sha256(fixture.gitBlobBytes)}\` |`;
    const staleRow = `| \`${fixture.relativePath}\` | ${fixture.worktreeBytes.length} | \`${sha256(fixture.worktreeBytes)}\` |`;
    assert.ok(printed.includes(expectedRow));
    fs.writeFileSync(
      path.join(fixture.archiveRoot, "MANIFEST.md"),
      printed.replace(expectedRow, staleRow),
      "utf8",
    );
    assert.throws(() => assertCurrent(fixture), /stale/i);
  }
  finally {
    fs.rmSync(fixture.owner, { recursive: true, force: true });
  }
});
