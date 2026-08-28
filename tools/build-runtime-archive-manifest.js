#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const repositoryRoot = path.resolve(__dirname, "..");
const archiveRoot = path.join(repositoryRoot, "docs", "runtime-portal");
const outputPath = path.join(archiveRoot, "MANIFEST.md");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => left.name.localeCompare(right.name))
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

const files = walk(archiveRoot)
  .filter((absolutePath) => absolutePath !== outputPath)
  .map((absolutePath) => {
    const bytes = fs.readFileSync(absolutePath);
    return {
      path: path.relative(archiveRoot, absolutePath).split(path.sep).join("/"),
      bytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
    };
  })
  .sort((left, right) => left.path.localeCompare(right.path));

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
  "- Manifest updated: `2026-08-28`",
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

fs.writeFileSync(outputPath, document, "utf8");
process.stdout.write(`${outputPath}\n${files.length} files\n${totalBytes} bytes\n`);
