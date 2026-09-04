#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const { assertCanonicalSourceAuthority } = require("./source-authority-preflight.js");

const repositoryRoot = path.resolve(__dirname, "..");
const archiveRoot = path.join(repositoryRoot, "docs", "runtime-portal");
const MAX_ARCHIVE_FILE_BYTES = 8 * 1024 * 1024;

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareOrdinal(left.name, right.name))
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Archive must not contain symbolic links: ${absolutePath}`);
      }
      if (entry.isDirectory()) return walk(absolutePath);
      if (!entry.isFile()) {
        throw new Error(`Archive contains unsupported entry: ${absolutePath}`);
      }
      return [absolutePath];
    });
}

function gitBlobObjectId(bytes) {
  const header = Buffer.from(`blob ${bytes.length}\0`, "ascii");
  return crypto.createHash("sha1").update(header).update(bytes).digest("hex");
}

function normalizeCrlfBytes(bytes) {
  return Buffer.from(bytes.toString("latin1").replaceAll("\r\n", "\n"), "latin1");
}

// Asks Git for the clean-filter identity, then returns the only byte candidate
// whose blob object ID proves that identity without writing the index or object store.
function readProspectiveGitBlobBytes(root, absolutePath) {
  const relativePath = path.relative(root, absolutePath).split(path.sep).join("/");
  if (relativePath.startsWith("../") || path.isAbsolute(relativePath)) {
    throw new Error(`Archive file escaped the repository root: ${absolutePath}`);
  }
  const worktreeBytes = fs.readFileSync(absolutePath);
  const prospectiveObjectId = execFileSync(
    "git",
    ["hash-object", "--stdin", `--path=${relativePath}`],
    {
      cwd: root,
      encoding: "utf8",
      input: worktreeBytes,
      maxBuffer: 1024 * 1024,
    },
  ).trim();
  if (!/^[0-9a-f]{40}$/.test(prospectiveObjectId)) {
    throw new Error(`Git returned no prospective blob identity for ${relativePath}`);
  }
  if (gitBlobObjectId(worktreeBytes) === prospectiveObjectId) return worktreeBytes;

  const lfBytes = normalizeCrlfBytes(worktreeBytes);
  if (!lfBytes.equals(worktreeBytes) && gitBlobObjectId(lfBytes) === prospectiveObjectId) {
    return lfBytes;
  }
  throw new Error(`Unsupported Git clean-filter transformation for ${relativePath}`);
}

function buildRuntimeArchiveManifest(root = repositoryRoot, rootArchive = archiveRoot) {
  const resolvedRoot = path.resolve(root);
  const resolvedArchive = path.resolve(rootArchive);
  const resolvedOutput = path.join(resolvedArchive, "MANIFEST.md");
  const gitRoot = path.resolve(execFileSync(
    "git",
    ["rev-parse", "--show-toplevel"],
    { cwd: resolvedRoot, encoding: "utf8", maxBuffer: 1024 * 1024 },
  ).trim());
  const sameRoot = process.platform === "win32"
    ? gitRoot.toLowerCase() === resolvedRoot.toLowerCase()
    : gitRoot === resolvedRoot;
  if (!sameRoot) throw new Error("Runtime archive inventory requires the exact repository root.");

  const files = walk(resolvedArchive)
    .filter((absolutePath) => absolutePath !== resolvedOutput)
    .map((absolutePath) => {
      const bytes = readProspectiveGitBlobBytes(resolvedRoot, absolutePath);
      const relativePath = path.relative(resolvedArchive, absolutePath).split(path.sep).join("/");
      if (bytes.length > MAX_ARCHIVE_FILE_BYTES) {
        throw new Error(`Historical archive file exceeds its local inventory bound: ${relativePath}`);
      }
      return {
        path: relativePath,
        bytes: bytes.length,
        sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      };
    })
    .sort((left, right) => compareOrdinal(left.path, right.path));

  const totalBytes = files.reduce((sum, file) => sum + file.bytes, 0);
  const rows = files.map(
    (file) => `| \`${file.path}\` | ${file.bytes} | \`${file.sha256}\` |`,
  );
  const document = [
    "# TinyRustLM Historical Runtime Archive Manifest",
    "",
    "This directory is preserved historical evidence only. It is not a current",
    "specification, shipping runtime, compatibility path, fallback, migration, or",
    "product claim. Current authority is the TinyRustLM.MiRust.com developer portal",
    "and the sole clean-slate six-member SLM2 contract.",
    "",
    "- Manifest schema: `tinyrustlm.mirust.historical_runtime_archive.v1`",
    "- Manifest updated: `2026-08-31`",
    `- Preserved file count, excluding this manifest: ${files.length}`,
    `- Preserved byte count, excluding this manifest: ${totalBytes}`,
    "- Current app: <https://TinyRustLM.com/>",
    "- Current developer portal: <https://TinyRustLM.MiRust.com/developer-portal/>",
    "",
    "## Preserved Files",
    "",
    "| Path | Bytes | SHA-256 |",
    "| --- | ---: | --- |",
    ...rows,
    "",
  ].join("\n");
  return { document, files, outputPath: resolvedOutput, totalBytes };
}

function main() {
  assertCanonicalSourceAuthority(repositoryRoot);
  const built = buildRuntimeArchiveManifest(repositoryRoot, archiveRoot);
  if (process.argv.includes("--print")) {
    process.stdout.write(built.document);
  }
  else if (process.argv.includes("--check")) {
    const existing = readProspectiveGitBlobBytes(repositoryRoot, built.outputPath).toString("utf8");
    if (existing !== built.document) {
      const actualLines = existing.split("\n");
      const expectedLines = built.document.split("\n");
      let mismatch = 0;
      while (
        mismatch < actualLines.length &&
        mismatch < expectedLines.length &&
        actualLines[mismatch] === expectedLines[mismatch]
      ) mismatch += 1;
      throw new Error(
        `Historical runtime archive manifest is stale at line ${mismatch + 1}: ${built.outputPath}`,
      );
    }
    process.stdout.write(`VALID ${built.outputPath}\n${built.files.length} files\n${built.totalBytes} bytes\n`);
  }
  else {
    fs.writeFileSync(built.outputPath, Buffer.from(built.document, "utf8"));
    process.stdout.write(`${built.outputPath}\n${built.files.length} files\n${built.totalBytes} bytes\n`);
  }
}

if (require.main === module) main();

module.exports = {
  buildRuntimeArchiveManifest,
  readProspectiveGitBlobBytes,
};
