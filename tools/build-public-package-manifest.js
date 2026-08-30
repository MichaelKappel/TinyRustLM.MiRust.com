#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const contentCommit = process.argv[2];
const outputPath = path.join(repositoryRoot, "docs", "package-manifest.md");
const excludedPath = "docs/package-manifest.md";
const releaseVersion = "1.8.2";
const releaseDate = "2026-08-29";

if (!/^[0-9a-f]{40}$/.test(contentCommit || "")) {
  throw new Error("Usage: node tools/build-public-package-manifest.js <40-character-content-commit>");
}

function git(args, encoding = "utf8") {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding,
    maxBuffer: 128 * 1024 * 1024,
  });
}

function isPublicPath(relativePath) {
  const publicUai = new Set([
    ".uai/.htaccess",
    ".uai/index.uai",
    ".uai/long-term-memory.uai",
    ".uai/talisman.uai",
    ".uai/taboo.uai",
    ".uai/totem.uai",
  ]);
  const rootFiles = new Set([
    ".htaccess",
    "LICENSE.txt",
    "index.php",
    "llms-full.txt",
    "llms.txt",
    "robots.txt",
    "sitemap.xml",
  ]);

  return (
    publicUai.has(relativePath) ||
    rootFiles.has(relativePath) ||
    relativePath.startsWith(".well-known/") ||
    relativePath.startsWith("assets/") ||
    relativePath.startsWith("data/") ||
    relativePath.startsWith("docs/") ||
    relativePath.startsWith("includes/")
  ) && !relativePath.endsWith("/.gitkeep");
}

git(["cat-file", "-e", `${contentCommit}^{commit}`]);
const sourceTree = git(["rev-parse", `${contentCommit}^{tree}`]).trim();
const files = git(["ls-tree", "-r", "--name-only", contentCommit])
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((relativePath) => relativePath !== excludedPath && isPublicPath(relativePath))
  .sort((left, right) => left.localeCompare(right))
  .map((relativePath) => {
    const bytes = git(["show", `${contentCommit}:${relativePath}`], null);
    return {
      path: relativePath,
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  });

if (files.length < 200 || files.length > 300) {
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
  `- Content-basis commit: \`${contentCommit}\``,
  `- Content-basis tree: \`${sourceTree}\``,
  `- Public files, excluding this manifest: ${files.length}`,
  `- Public bytes, excluding this manifest: ${totalBytes}`,
  "",
  "This manifest excludes itself to avoid a recursive checksum. Historical",
  "runtime files are included only as labeled preservation evidence; they do not",
  "create a current reader, compatibility path, fallback, migration, or product",
  "claim.",
  "",
  "| Path | Bytes | SHA-256 |",
  "| --- | ---: | --- |",
  ...rows,
  "",
].join("\n");

fs.writeFileSync(outputPath, document, "utf8");
process.stdout.write(`${outputPath}\n${files.length} files\n${totalBytes} bytes\n`);
