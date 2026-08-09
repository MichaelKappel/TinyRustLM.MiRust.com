#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");

const repositoryRoot = path.resolve(__dirname, "..");
const contentCommit = process.argv[2];
const outputPath = path.resolve(
  repositoryRoot,
  process.argv[3] || "deploy/site-deployment-manifest.v1.json",
);
const stagingRoot = path.join(repositoryRoot, "deploy", "staging", "1.7.0");

if (!/^[0-9a-f]{40}$/.test(contentCommit || "")) {
  throw new Error("Usage: node tools/build-site-deployment-manifest.js <40-character-content-commit> [output]");
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

const httpsReadbacks = new Set([
  ".uai/index.uai",
  ".uai/long-term-memory.uai",
  ".uai/talisman.uai",
  ".uai/taboo.uai",
  ".uai/totem.uai",
  ".well-known/uaix-talisman.txt",
  "LICENSE.txt",
  "assets/css/site.css",
  "assets/js/site.js",
  "docs/long-term-memory.md",
  "docs/package-manifest.md",
  "docs/report-index.md",
  "docs/runtime-portal/MANIFEST.md",
  "docs/runtime-portal/index.md",
  "docs/runtime-portal/package/healthz",
  "docs/runtime-portal/package/version.json",
  "docs/runtime-portal/runtime-docs/index.md",
  "docs/runtime-portal/runtime-docs/long-term-memory.uai",
  "llms-full.txt",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
]);

git(["cat-file", "-e", `${contentCommit}^{commit}`]);
const sourceTree = git(["rev-parse", `${contentCommit}^{tree}`]).trim();
const tracked = git(["ls-tree", "-r", "--name-only", contentCommit])
  .split(/\r?\n/)
  .filter(Boolean)
  .filter(isPublicPath)
  .sort((left, right) => left.localeCompare(right));

const files = tracked.map((relativePath) => {
  const committed = git(["show", `${contentCommit}:${relativePath}`], null);
  const stagedPath = path.join(stagingRoot, ...relativePath.split("/"));
  fs.mkdirSync(path.dirname(stagedPath), { recursive: true });
  fs.writeFileSync(stagedPath, committed);
  return {
    path: relativePath,
    bytes: committed.length,
    sha256: crypto.createHash("sha256").update(committed).digest("hex"),
    https_readback_path: httpsReadbacks.has(relativePath) ? `/${relativePath}` : null,
  };
});

if (files.length < 200 || files.length > 300) {
  throw new Error(`Unexpected public deployment closure size: ${files.length}`);
}

const manifest = {
  schema: "tinyrustlm.mirust.site_deployment_manifest.v1",
  site: "TinyRustLM.MiRust.com",
  origin: "https://tinyrustlm.mirust.com",
  version: "1.7.0",
  release_date: "2026-08-09",
  source_commit: contentCommit,
  source_tree: sourceTree,
  transport_profile: "TinyRustLM.MiRust.com",
  files,
  route_smokes: [
    { path: "/", contains: "Site package 1.7.0" },
    { path: "/updates/", contains: "1.7.0 - 2026-08-09" },
    { path: "/developer-portal/", contains: "Developer Portal" },
    { path: "/docs/", contains: "Docs" },
    { path: "/contact/", contains: "Contact Mike Kappel" },
    { path: "/docs/runtime-portal/runtime-docs/index.md", contains: "Runtime.MiRust.com" },
  ],
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
process.stdout.write(`${outputPath}\n${files.length} files\n`);
process.stdout.write(`${stagingRoot}\n`);
