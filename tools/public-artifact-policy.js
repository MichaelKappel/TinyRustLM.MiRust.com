#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { TextDecoder } = require("node:util");

const MAX_TEXT_ARTIFACT_BYTES = 2 * 1024 * 1024;
const UNKNOWN_TEXT_PROBE_BYTES = MAX_TEXT_ARTIFACT_BYTES + 4;
const PUBLIC_UAI_PATHS = new Set([
  ".uai/.htaccess",
  ".uai/index.uai",
  ".uai/long-term-memory.uai",
]);
const PUBLIC_HISTORICAL_BOUNDARY_PATHS = new Set([
  "docs/runtime-portal/index.md",
]);
const PUBLIC_DENY_CONTROL_PATHS = new Set([
  "docs/reports/.htaccess",
]);
const PRIVATE_PUBLICATION_PATH_PREFIXES = [
  "docs/reports/",
  "docs/runtime-portal/",
];
const ROOT_PUBLIC_PATHS = new Set([
  ".htaccess",
  "LICENSE.txt",
  "index.php",
  "llms-full.txt",
  "llms.txt",
  "robots.txt",
  "sitemap.xml",
]);
const PUBLIC_PATH_PREFIXES = [
  ".well-known/",
  "assets/",
  "data/",
  "docs/",
  "includes/",
];
const ALLOWED_SITE_SOURCE_PATHS = new Set([
  "assets/css/site.css",
  "assets/js/site.js",
  "data/pages.php",
  "data/site.php",
  "docs/index.php",
  "docs/reports-index.php",
  "includes/footer.php",
  "includes/functions.php",
  "includes/header.php",
  "index.php",
]);
const SOURCE_EXTENSIONS = new Set([
  ".bat",
  ".c",
  ".cc",
  ".cjs",
  ".cpp",
  ".cs",
  ".csproj",
  ".fs",
  ".fsproj",
  ".go",
  ".h",
  ".hpp",
  ".java",
  ".js",
  ".jsx",
  ".kt",
  ".kts",
  ".mjs",
  ".php",
  ".props",
  ".ps1",
  ".py",
  ".rb",
  ".rs",
  ".sh",
  ".sln",
  ".swift",
  ".targets",
  ".ts",
  ".tsx",
  ".vb",
  ".vbproj",
  ".vcxproj",
]);
const SOURCE_ENTRYPOINTS = new Set([
  ".gitattributes",
  ".gitmodules",
  ".gitignore",
  "cmakelists.txt",
  "cargo.lock",
  "cargo.toml",
  "dockerfile",
  "makefile",
  "package-lock.json",
  "package.json",
  "pnpm-lock.yaml",
  "yarn.lock",
]);
const SOURCE_ARCHIVE_SUFFIXES = [
  ".tar.bz2",
  ".tar.gz",
  ".tar.xz",
  ".tar.zst",
  ".7z",
  ".a",
  ".apk",
  ".bundle",
  ".bz2",
  ".cab",
  ".crate",
  ".deb",
  ".dmg",
  ".ear",
  ".gz",
  ".iso",
  ".jar",
  ".nupkg",
  ".rar",
  ".rpm",
  ".tar",
  ".tgz",
  ".txz",
  ".war",
  ".whl",
  ".xz",
  ".zip",
  ".zst",
];
const TEXT_EXTENSIONS = new Set([
  "",
  ".css",
  ".html",
  ".json",
  ".md",
  ".php",
  ".txt",
  ".uai",
  ".xml",
]);
const UTF8_DECODER = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
const BINARY_MAGIC_PREFIXES = [
  Buffer.from([0x00, 0x61, 0x73, 0x6d]), // WebAssembly
  Buffer.from([0x7f, 0x45, 0x4c, 0x46]), // ELF
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), // PNG
  Buffer.from([0xff, 0xd8, 0xff]), // JPEG
  Buffer.from("GIF87a", "ascii"),
  Buffer.from("GIF89a", "ascii"),
  Buffer.from("%PDF-", "ascii"),
  Buffer.from("PK\u0003\u0004", "binary"),
  Buffer.from("SQLite format 3\u0000", "binary"),
  Buffer.from([0x1f, 0x8b]), // gzip
  Buffer.from([0x37, 0x7a, 0xbc, 0xaf, 0x27, 0x1c]), // 7z
];
const SOURCE_SIGNAL_PATTERNS = [
  { id: "rust-use", family: "rust", pattern: /^\s*(?:pub(?:\([^)]*\))?\s+)?use\s+[A-Za-z_][\w:]*(?:::\{[^}]+\})?;\s*$/ },
  { id: "rust-function", family: "rust", pattern: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:async\s+)?fn\s+[A-Za-z_]\w*\s*\([^)]*\)(?:\s*->\s*[^\{]+)?\s*\{\s*$/ },
  { id: "rust-type", family: "rust", pattern: /^\s*(?:pub(?:\([^)]*\))?\s+)?(?:struct|enum|trait|impl|mod)\s+[A-Za-z_]\w*(?:\s*<[^>]+>)?(?:\s+for\s+[^\{]+)?\s*\{?\s*$/ },
  { id: "rust-let", family: "rust", pattern: /^\s*let\s+(?:mut\s+)?[A-Za-z_]\w*(?:\s*:\s*[^=]+)?\s*=.+;\s*$/ },
  { id: "rust-attribute", family: "rust", pattern: /^\s*#\[(?:cfg|derive|test|allow|deny|forbid)\b[^\]]*\]\s*$/ },
  { id: "c-include", family: "c-family", pattern: /^\s*#\s*include\s*[<"][^>"]+[>"]\s*$/ },
  { id: "c-type", family: "c-family", pattern: /^\s*(?:typedef\s+)?(?:struct|enum|union)\s+[A-Za-z_]\w*\s*\{\s*$/ },
  { id: "c-function", family: "c-family", pattern: /^\s*(?:static\s+|inline\s+|const\s+)*[A-Za-z_]\w*(?:\s*\*+)?\s+[A-Za-z_]\w*\s*\([^;]*\)\s*\{\s*$/ },
  { id: "csharp-using", family: "csharp", pattern: /^\s*using\s+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*;\s*$/ },
  { id: "csharp-type", family: "csharp", pattern: /^\s*(?:(?:public|private|protected|internal|static|sealed|abstract|partial|readonly)\s+)*(?:class|record|interface|enum|struct)\s+[A-Za-z_]\w*(?:\s*<[^>]+>)?[^;]*\{?\s*$/ },
  { id: "csharp-member", family: "csharp", pattern: /^\s*(?:(?:public|private|protected|internal|static|virtual|override|async|sealed|readonly)\s+)+[A-Za-z_][\w<>,.?\[\]]*\s+[A-Za-z_]\w*\s*\([^;]*\)(?:\s*=>[^;]+;|\s*\{)\s*$/ },
  { id: "jvm-package", family: "jvm", pattern: /^\s*package\s+[A-Za-z_]\w*(?:\.[A-Za-z_]\w*)*;?\s*$/ },
  { id: "jvm-import", family: "jvm", pattern: /^\s*import\s+(?:static\s+)?[A-Za-z_]\w*(?:\.[A-Za-z_*]\w*)+;?\s*$/ },
  { id: "jvm-function", family: "jvm", pattern: /^\s*(?:(?:public|private|protected|internal|static|final|suspend|override)\s+)*(?:fun\s+)?[A-Za-z_][\w<>,.?\[\]]*\s+[A-Za-z_]\w*\s*\([^;]*\)\s*(?:\{|=)\s*$/ },
  { id: "go-package", family: "go", pattern: /^\s*package\s+[A-Za-z_]\w*\s*$/ },
  { id: "go-import", family: "go", pattern: /^\s*import\s*(?:\(|"[^"]+")\s*$/ },
  { id: "go-function", family: "go", pattern: /^\s*func\s+(?:\([^)]*\)\s*)?[A-Za-z_]\w*\s*\([^)]*\)(?:\s*\([^)]*\)|\s+[^\{]+)?\s*\{\s*$/ },
  { id: "javascript-import", family: "javascript", pattern: /^\s*(?:import|export)\s+.+(?:\s+from\s+['"][^'"]+['"]|['"][^'"]+['"]);?\s*$/ },
  { id: "javascript-function", family: "javascript", pattern: /^\s*(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+[A-Za-z_$][\w$]*\s*\([^)]*\)\s*\{\s*$/ },
  { id: "javascript-type", family: "javascript", pattern: /^\s*(?:export\s+)?(?:default\s+)?(?:class|interface|type|enum)\s+[A-Za-z_$][\w$]*\b.*(?:\{|=)\s*$/ },
  { id: "javascript-binding", family: "javascript", pattern: /^\s*(?:export\s+)?(?:const|let|var)\s+[A-Za-z_$][\w$]*(?:\s*:\s*[^=]+)?\s*=.+;?\s*$/ },
  { id: "python-import", family: "python", pattern: /^\s*(?:from\s+[A-Za-z_][\w.]*\s+import\s+.+|import\s+[A-Za-z_][\w.]*(?:\s+as\s+[A-Za-z_]\w*)?)\s*$/ },
  { id: "python-function", family: "python", pattern: /^\s*(?:async\s+)?def\s+[A-Za-z_]\w*\s*\([^)]*\)(?:\s*->\s*[^:]+)?\s*:\s*$/ },
  { id: "python-type", family: "python", pattern: /^\s*class\s+[A-Za-z_]\w*(?:\([^)]*\))?\s*:\s*$/ },
  { id: "python-main", family: "python", pattern: /^\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:\s*$/ },
  { id: "php-open", family: "php", pattern: /^\s*<\?php\s*$/ },
  { id: "php-namespace", family: "php", pattern: /^\s*namespace\s+[A-Za-z_]\w*(?:\\[A-Za-z_]\w*)*;\s*$/ },
  { id: "php-function", family: "php", pattern: /^\s*(?:(?:public|private|protected|static|final|abstract)\s+)*function\s+[A-Za-z_]\w*\s*\([^)]*\)(?:\s*:\s*[^\{]+)?\s*\{\s*$/ },
  { id: "powershell-param", family: "powershell", pattern: /^\s*param\s*\(\s*$/i },
  { id: "powershell-function", family: "powershell", pattern: /^\s*function\s+[A-Za-z]+-[A-Za-z][\w-]*\s*\{\s*$/i },
  { id: "powershell-binding", family: "powershell", pattern: /^\s*\$[A-Za-z_][\w:]*\s*=.+$/ },
  { id: "shell-function", family: "shell", pattern: /^\s*(?:function\s+)?[A-Za-z_][\w-]*\s*\(\s*\)\s*\{\s*$/ },
  { id: "shell-setting", family: "shell", pattern: /^\s*set\s+-[A-Za-z]*[eu][A-Za-z]*\s*$/ },
];

function compareOrdinal(left, right) {
  return left < right ? -1 : left > right ? 1 : 0;
}

// Canonicalizes a repository-relative path before any allowlist decision.
function normalizeRelativePath(relativePath) {
  if (typeof relativePath !== "string" || relativePath.length < 1 || relativePath.length > 512) {
    throw new Error("Artifact path must be a bounded non-empty string.");
  }

  const normalized = relativePath.replaceAll("\\", "/");
  const segments = normalized.split("/");
  if (
    normalized.startsWith("/") ||
    normalized.endsWith("/") ||
    segments.some((segment) => segment.length < 1 || segment === "." || segment === "..")
  ) {
    throw new Error(`Artifact path is not canonical: ${relativePath}`);
  }
  return normalized;
}

// Defines the one exact path closure shared by package and deployment tooling.
function isPublicArtifactPath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  const allowed = (
    PUBLIC_UAI_PATHS.has(normalized) ||
    ROOT_PUBLIC_PATHS.has(normalized) ||
    PUBLIC_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) && !normalized.endsWith("/.gitkeep");
  if (!allowed) return false;
  if (
    PUBLIC_DENY_CONTROL_PATHS.has(normalized) ||
    PUBLIC_HISTORICAL_BOUNDARY_PATHS.has(normalized)
  ) return true;
  return !PRIVATE_PUBLICATION_PATH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

// Removes only balanced Markdown fenced blocks; an unmatched opener hides nothing.
function withoutBalancedMarkdownFences(text) {
  const lines = text.split("\n");
  const hidden = new Set();
  for (let index = 0; index < lines.length; index += 1) {
    const opener = lines[index].match(/^ {0,3}(`{3,}|~{3,})[^\r]*$/);
    if (!opener) continue;
    const marker = opener[1][0];
    const minimumLength = opener[1].length;
    let closing = -1;
    for (let candidate = index + 1; candidate < lines.length; candidate += 1) {
      const match = lines[candidate].match(/^ {0,3}(`{3,}|~{3,})\s*\r?$/);
      if (match && match[1][0] === marker && match[1].length >= minimumLength) {
        closing = candidate;
        break;
      }
    }
    if (closing < 0) continue;
    for (let hiddenIndex = index; hiddenIndex <= closing; hiddenIndex += 1) hidden.add(hiddenIndex);
    index = closing;
  }
  return lines.map((line, index) => hidden.has(index) ? "" : line).join("\n");
}

function matchingSourceSignals(line) {
  return SOURCE_SIGNAL_PATTERNS.filter((signal) => signal.pattern.test(line));
}

function isKnownSourceShebang(line) {
  return /^#!\s*\/(?:usr\/bin\/(?:env\s+)?|bin\/)(?:bash|sh|zsh|fish|node|deno|python(?:3)?|ruby|pwsh|powershell)(?:\s|$)/i.test(line);
}

function isCompactSourceLine(line) {
  const trimmed = line.trim();
  if (!trimmed) return true;
  if (matchingSourceSignals(line).length > 0) return true;
  return (
    /^(?:\/\/|\/\*|\*|\*\/|#(?!\s)|<!--|-->|;)/.test(trimmed) ||
    /^[{}()[\],;]+$/.test(trimmed) ||
    /^(?:if|for|while|match|switch|try|catch|finally)\s*[({].*[){:]?\s*\{?\s*$/.test(trimmed) ||
    /^(?:return|break|continue|throw)\b.*;?$/.test(trimmed) ||
    /^(?:await\s+)?[A-Za-z_$][\w$.:]*(?:<[^>]+>)?\s*\([^)]*\)\s*;?$/.test(trimmed) ||
    /^[A-Za-z_$][\w$.[\]:-]*\s*(?::=|=>|=)\s*.+;?$/.test(trimmed)
  );
}

function assertNoCopiedSourceText(normalized, extension, text) {
  if (
    /(?:^|\n)\s*BEGIN (?:SOURCE )?FILE:\s*[^\n]+/i.test(text) &&
    /(?:^|\n)\s*END (?:SOURCE )?FILE:\s*[^\n]+/i.test(text)
  ) {
    throw new Error(`Embedded plaintext source bundle is forbidden: ${normalized}`);
  }

  const visible = extension === ".md" ? withoutBalancedMarkdownFences(text) : text;
  const lines = visible.split("\n");
  const substantive = lines.filter((line) => line.trim().length > 0);
  const first = substantive[0] || "";
  if (isKnownSourceShebang(first)) {
    throw new Error(`Plaintext source shebang is forbidden: ${normalized}`);
  }
  if (/^\s*diff --git a\/\S+ b\/\S+\s*$/m.test(visible) && /^\s*@@ -\d+(?:,\d+)? \+\d+(?:,\d+)? @@/m.test(visible)) {
    throw new Error(`Plaintext Git source patch is forbidden: ${normalized}`);
  }
  if (/^\s*\[package\]\s*$/m.test(visible) && /^\s*name\s*=\s*"[^"]+"\s*$/m.test(visible) && /^\s*version\s*=\s*"[^"]+"\s*$/m.test(visible)) {
    throw new Error(`Plaintext Cargo package source is forbidden: ${normalized}`);
  }
  if (/<Project\b[^>]*\bSdk\s*=\s*["'][^"']+["'][^>]*>/i.test(visible) && /<TargetFrameworks?>[^<]+<\/TargetFrameworks?>/i.test(visible)) {
    throw new Error(`Plaintext .NET project source is forbidden: ${normalized}`);
  }
  if (/^Microsoft Visual Studio Solution File, Format Version \d+(?:\.\d+)+\s*$/m.test(visible)) {
    throw new Error(`Plaintext Visual Studio solution source is forbidden: ${normalized}`);
  }
  if (/^\s*\[core\]\s*$/m.test(visible) && /^\s*repositoryformatversion\s*=\s*\d+\s*$/m.test(visible)) {
    throw new Error(`Plaintext Git repository configuration is forbidden: ${normalized}`);
  }

  const trimmed = visible.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (
        parsed && typeof parsed === "object" && !Array.isArray(parsed) &&
        typeof parsed.name === "string" && parsed.name.length > 0 &&
        ["scripts", "dependencies", "devDependencies", "peerDependencies", "packageManager"].some(
          (field) => Object.prototype.hasOwnProperty.call(parsed, field),
        )
      ) {
        throw new Error(`Plaintext package.json source is forbidden: ${normalized}`);
      }
    }
    catch (error) {
      if (error instanceof Error && /package\.json source is forbidden/.test(error.message)) throw error;
    }
  }

  const signalLines = new Set();
  const signalClasses = new Set();
  const signalFamilies = new Set();
  for (const line of substantive) {
    const signals = matchingSourceSignals(line);
    if (signals.length < 1) continue;
    signalLines.add(line.trim());
    for (const signal of signals) {
      signalClasses.add(signal.id);
      signalFamilies.add(signal.family);
    }
  }
  const density = substantive.length === 0 ? 0 : signalLines.size / substantive.length;
  const denseMultiSignal = (
    (signalClasses.size >= 3 && signalLines.size >= 6 && density >= 0.20) ||
    (signalClasses.size >= 2 && signalLines.size >= 4 && density >= 0.60)
  );
  if (denseMultiSignal) {
    throw new Error(
      `Dense plaintext source is forbidden (${signalFamilies.size} families, ${signalClasses.size} classes): ${normalized}`,
    );
  }

  const entrypoint = substantive.some((line) => (
    /^\s*(?:pub\s+)?fn\s+main\s*\(/.test(line) ||
    /^\s*(?:public\s+)?static\s+void\s+Main\s*\(/.test(line) ||
    /^\s*func\s+main\s*\(/.test(line) ||
    /^\s*if\s+__name__\s*==\s*['"]__main__['"]\s*:/.test(line) ||
    /^\s*<\?php\s*$/.test(line)
  ));
  if (
    entrypoint &&
    substantive.length >= 2 &&
    substantive.length <= 512 &&
    substantive.every(isCompactSourceLine)
  ) {
    throw new Error(`Compact plaintext source entrypoint is forbidden: ${normalized}`);
  }
}

function decodeBoundedText(normalized, bytes) {
  if (bytes.length > MAX_TEXT_ARTIFACT_BYTES) {
    throw new Error(`Text artifact exceeds the bounded publication limit: ${normalized}`);
  }
  let text;
  try {
    text = UTF8_DECODER.decode(bytes);
  }
  catch {
    throw new Error(`Text artifact is not strict UTF-8: ${normalized}`);
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (text.startsWith("\uFEFF")) {
    throw new Error(`Text artifact contains multiple byte-order marks: ${normalized}`);
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) {
    throw new Error(`Text artifact contains a forbidden control character: ${normalized}`);
  }
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

function startsWithBytes(bytes, prefix) {
  return bytes.length >= prefix.length && bytes.subarray(0, prefix.length).equals(prefix);
}

// Treats an unknown suffix as text only when its bounded byte evidence is strict UTF-8.
// Known binary signatures, invalid UTF-8, NUL, and binary controls remain binary artifacts.
function decodeRenamedTextCandidate(normalized, bytes) {
  if (BINARY_MAGIC_PREFIXES.some((prefix) => startsWithBytes(bytes, prefix))) return null;

  const truncated = bytes.length > MAX_TEXT_ARTIFACT_BYTES;
  const probe = bytes.subarray(0, Math.min(bytes.length, UNKNOWN_TEXT_PROBE_BYTES));
  let text;
  try {
    const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });
    text = decoder.decode(probe, { stream: truncated });
  }
  catch {
    return null;
  }
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(text)) return null;
  if (truncated) {
    throw new Error(`UTF-8 text artifact under an unrecognized suffix exceeds the bounded publication limit: ${normalized}`);
  }
  if (text.startsWith("\uFEFF")) text = text.slice(1);
  if (text.startsWith("\uFEFF")) {
    throw new Error(`Text artifact contains multiple byte-order marks: ${normalized}`);
  }
  return text.replaceAll("\r\n", "\n").replaceAll("\r", "\n");
}

// Rejects private workstation and operator material even when its filename looks public.
function assertNoPrivatePublicationDetails(normalized, text) {
  const violations = [
    [/(?<![A-Za-z0-9])[A-Za-z]:\\/u, "absolute Windows path"],
    [/(?:^|[\s("'`=])\\\\[^\\\s]+\\/mu, "UNC path"],
    [/\/(?:home|Users)\/[A-Za-z0-9._-]+\//u, "absolute user-home path"],
    [/(?:^|[\s("'`])\/?\.uai\/(?:taboo|talisman|totem|startup-packet|short-term-memory|file-handoff|system-profile|next-recursive-prompt|receiver-brief|memory|operations|context|constraints|decisions|architecture|coding-standards|test-plan)\.uai\b/imu, "private UAI route"],
    [/(?:^|[\s("'`/])workspace\.uai\b/imu, "workspace authority route"],
    [/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u, "private key"],
    [/(?:https?|ftps?|ssh):\/\/[^\s/@:]+:[^\s/@]+@/iu, "credential-bearing URL"],
    [/(?:^|[\s,{])(?:password|passwd|api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["']?(?!redacted\b|none\b|null\b|false\b)[^\s"',}]{8,}/imu, "credential assignment"],
    [/(?:^|[\s,{])(?:private[_ -]?(?:evidence(?:[_ -]?(?:root|path))?|path|root)|evidence[_ -]?root)\s*[:=]\s*[^\s,}]+/imu, "private evidence locator"],
  ];
  for (const [pattern, description] of violations) {
    if (pattern.test(text)) {
      throw new Error(`Public artifact contains a forbidden ${description}: ${normalized}`);
    }
  }
}

// Rejects authority copies and source-shaped content before it reaches an output closure.
function assertPublishableArtifact(relativePath, bytes, options = {}) {
  const normalized = normalizeRelativePath(relativePath);
  if (!Buffer.isBuffer(bytes)) {
    throw new Error(`Artifact bytes must be a Buffer: ${normalized}`);
  }

  const lowerPath = normalized.toLowerCase();
  const basename = path.posix.basename(lowerPath);
  const extension = path.posix.extname(basename);
  const allowSiteSource = options.allowSiteSource === true;
  const segments = lowerPath.split("/");

  if (segments.some((segment) => segment === ".git" || segment === ".hg" || segment === ".svn")) {
    throw new Error(`Source-control metadata is forbidden: ${normalized}`);
  }

  if (SOURCE_ARCHIVE_SUFFIXES.some((suffix) => lowerPath.endsWith(suffix))) {
    throw new Error(`Source archive path is forbidden: ${normalized}`);
  }

  if (["workspace.uai", "taboo.uai", "talisman.uai", "totem.uai"].includes(basename)) {
    throw new Error(`Private source-authority marker is forbidden: ${normalized}`);
  }

  if (
    /(?:^|[._ -])all[._ -]*source(?:[._ -]*(?:review|bundle|copy|archive))?(?:[._ -]|$)/i.test(basename) ||
    /(?:^|[._ -])source[._ -]*(?:review[._ -]*bundle|bundle)(?:[._ -]|$)/i.test(basename)
  ) {
    throw new Error(`Plaintext source bundle is forbidden: ${normalized}`);
  }

  const sourceShaped = SOURCE_EXTENSIONS.has(extension) || SOURCE_ENTRYPOINTS.has(basename);
  const allowedSiteSource = allowSiteSource && ALLOWED_SITE_SOURCE_PATHS.has(lowerPath);
  if (sourceShaped && !allowedSiteSource) {
    throw new Error(`Copied source or build entrypoint is forbidden: ${normalized}`);
  }

  if (TEXT_EXTENSIONS.has(extension)) {
    const text = decodeBoundedText(normalized, bytes);
    assertNoPrivatePublicationDetails(normalized, text);
    if (!allowedSiteSource) assertNoCopiedSourceText(normalized, extension, text);
  }
  else if (!allowedSiteSource) {
    const text = decodeRenamedTextCandidate(normalized, bytes);
    if (text !== null) {
      assertNoPrivatePublicationDetails(normalized, text);
      assertNoCopiedSourceText(normalized, extension, text);
    }
  }

  return normalized;
}

// Distinguishes an absent staging destination from an empty or stale one.
function assertDirectoryAbsent(directory) {
  try {
    fs.lstatSync(directory);
  }
  catch (error) {
    if (error && error.code === "ENOENT") return;
    throw error;
  }
  throw new Error(`Staging root must be absent before materialization: ${directory}`);
}

// Rejects a directory reached through a symlink or junction ancestor.
function assertPlainDirectory(directory) {
  const resolved = path.resolve(directory);
  const item = fs.lstatSync(resolved);
  if (!item.isDirectory() || item.isSymbolicLink()) {
    throw new Error(`Expected a plain directory: ${resolved}`);
  }
  const real = fs.realpathSync.native(resolved);
  if (process.platform === "win32" ? real.toLowerCase() !== resolved.toLowerCase() : real !== resolved) {
    throw new Error(`Directory resolves through a link or junction: ${resolved}`);
  }
}

// Enumerates only regular files and rejects links or other special entries.
function walkRegularFiles(directory, root = directory) {
  return fs.readdirSync(directory, { withFileTypes: true })
    .sort((left, right) => compareOrdinal(left.name, right.name))
    .flatMap((entry) => {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isSymbolicLink()) {
        throw new Error(`Staging closure must not contain symbolic links: ${absolutePath}`);
      }
      if (entry.isDirectory()) return walkRegularFiles(absolutePath, root);
      if (!entry.isFile()) {
        throw new Error(`Staging closure contains an unsupported entry: ${absolutePath}`);
      }
      return [{
        absolutePath,
        relativePath: path.relative(root, absolutePath).split(path.sep).join("/"),
      }];
    });
}

// Recomputes the staged closure so missing, extra, or changed files fail closed.
function assertExactFileTree(directory, expectedFiles) {
  const root = fs.lstatSync(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) {
    throw new Error(`Staging root must be a plain directory: ${directory}`);
  }

  const expected = new Map(expectedFiles.map((file) => [
    normalizeRelativePath(file.path),
    { bytes: file.bytes, sha256: file.sha256 },
  ]));
  if (expected.size !== expectedFiles.length) {
    throw new Error("Expected staging closure contains a duplicate path.");
  }

  const actual = walkRegularFiles(directory);
  if (actual.length !== expected.size) {
    throw new Error(`Staging closure file count mismatch: expected ${expected.size}, found ${actual.length}`);
  }

  for (const file of actual) {
    const identity = expected.get(file.relativePath);
    if (!identity) {
      throw new Error(`Staging closure contains an unexpected file: ${file.relativePath}`);
    }
    const bytes = fs.readFileSync(file.absolutePath);
    const sha256 = crypto.createHash("sha256").update(bytes).digest("hex");
    if (bytes.length !== identity.bytes || sha256 !== identity.sha256) {
      throw new Error(`Staging file identity mismatch: ${file.relativePath}`);
    }
  }
}

module.exports = {
  PRIVATE_PUBLICATION_PATH_PREFIXES,
  PUBLIC_DENY_CONTROL_PATHS,
  PUBLIC_HISTORICAL_BOUNDARY_PATHS,
  PUBLIC_PATH_PREFIXES,
  PUBLIC_UAI_PATHS,
  ROOT_PUBLIC_PATHS,
  MAX_TEXT_ARTIFACT_BYTES,
  assertDirectoryAbsent,
  assertExactFileTree,
  assertPlainDirectory,
  assertPublishableArtifact,
  compareOrdinal,
  isPublicArtifactPath,
  normalizeRelativePath,
  withoutBalancedMarkdownFences,
};
