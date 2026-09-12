#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const test = require("node:test");
const {
  MAX_TEXT_ARTIFACT_BYTES,
  assertDirectoryAbsent,
  assertPlainDirectory,
  assertPublishableArtifact,
  isPublicArtifactPath,
} = require("./public-artifact-policy.js");

test("allows current documentation and the explicit live-site source allowlist", () => {
  assert.equal(assertPublishableArtifact("docs/report.md", Buffer.from("report\n")), "docs/report.md");
  assert.equal(
    assertPublishableArtifact(
      "docs/source-review-notes.md",
      Buffer.from("# Source review notes\n\nThis prose records findings without copying source.\n"),
    ),
    "docs/source-review-notes.md",
  );
  assert.equal(
    assertPublishableArtifact("assets/js/site.js", Buffer.from("'use strict';\n"), { allowSiteSource: true }),
    "assets/js/site.js",
  );
  for (const relativePath of [
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/totem.uai",
  ]) {
    assert.throws(
      () => assertPublishableArtifact(relativePath, Buffer.from("profile: local-authority\n"), {
        allowRootTaboo: true,
        allowSiteSource: true,
      }),
      /private source-authority marker/i,
      relativePath,
    );
  }
});

test("rejects nested authority markers and source-bundle names", () => {
  for (const relativePath of [
    "docs/runtime/workspace.uai",
    "docs/archive/.uai/taboo.uai",
    "docs/reports/model-all-source.txt",
    "docs/reports/source-review-bundle.txt",
    "docs/reports/source_bundle.md",
    "docs/archive/source-copy.tar.gz",
    "docs/archive/repository.bundle",
    "docs/archive/.git/config.txt",
  ]) {
    assert.throws(() => assertPublishableArtifact(relativePath, Buffer.from("x\n")), /forbidden/i);
  }
});

test("rejects copied source, build entrypoints, and embedded plaintext source bundles", () => {
  assert.throws(
    () => assertPublishableArtifact("docs/archive/program.cs", Buffer.from("class Program {}\n")),
    /copied source/i,
  );
  assert.throws(
    () => assertPublishableArtifact("docs/archive/package.json", Buffer.from("{}\n")),
    /entrypoint/i,
  );
  assert.throws(
    () => assertPublishableArtifact(
      "docs/archive/site.js",
      Buffer.from("'use strict';\n"),
      { allowSiteSource: true },
    ),
    /copied source/i,
  );
  assert.throws(
    () => assertPublishableArtifact(
      "docs/archive/innocent.txt",
      Buffer.from("BEGIN FILE: src/main.rs\nfn main() {}\nEND FILE: src/main.rs\n"),
    ),
    /embedded plaintext source bundle/i,
  );
  assert.throws(
    () => assertPublishableArtifact("docs/archive/large.txt", Buffer.alloc(MAX_TEXT_ARTIFACT_BYTES + 1)),
    /bounded publication limit/i,
  );
});

test("rejects decisive source signatures copied into ordinary text", () => {
  const cases = [
    ["docs/copy.txt", "#!/usr/bin/env node\nconsole.log('copied');\n", /shebang/i],
    ["docs/copy.md", "diff --git a/a.rs b/a.rs\n@@ -1 +1 @@\n-old\n+new\n", /Git source patch/i],
    ["docs/copy.txt", "[package]\nname = \"copy\"\nversion = \"1.0.0\"\n", /Cargo package/i],
    ["docs/copy.txt", "<Project Sdk=\"Microsoft.NET.Sdk\">\n<TargetFramework>net10.0</TargetFramework>\n</Project>\n", /.NET project/i],
    ["docs/copy.txt", "Microsoft Visual Studio Solution File, Format Version 12.00\n", /Visual Studio solution/i],
    ["docs/copy.txt", "[core]\nrepositoryformatversion = 0\nfilemode = true\n", /repository configuration/i],
    ["docs/copy.txt", "{\"name\":\"copy\",\"scripts\":{\"test\":\"node test.js\"}}\n", /package\.json/i],
    ["docs/copy.txt", "fn main() {\nlet value = 1;\nrun(value);\n}\n", /entrypoint/i],
  ];
  for (const [relativePath, contents, expected] of cases) {
    assert.throws(() => assertPublishableArtifact(relativePath, Buffer.from(contents)), expected);
  }
});

test("rejects dense multi-signal source while allowing balanced Markdown examples", () => {
  const rust = [
    "use std::path::Path;",
    "use std::fs::File;",
    "#[derive(Debug)]",
    "pub struct Runner {",
    "}",
    "impl Runner {",
    "pub fn run() {",
    "let value = 1;",
    "}",
    "}",
    "",
  ].join("\n");
  assert.throws(
    () => assertPublishableArtifact("docs/copied-library.txt", Buffer.from(rust)),
    /dense plaintext source/i,
  );
  for (const relativePath of [
    "docs/copied-library.dat",
    "docs/copied-library.yaml",
    "docs/copied-library.log",
  ]) {
    assert.throws(
      () => assertPublishableArtifact(relativePath, Buffer.from(rust)),
      /dense plaintext source/i,
      relativePath,
    );
  }
  assert.doesNotThrow(() => assertPublishableArtifact(
    "docs/tutorial.md",
    Buffer.from(`# Tutorial\n\nA bounded example follows.\n\n\`\`\`rust\n${rust}\`\`\`\n\nThe prose continues.\n`),
  ));
  assert.throws(
    () => assertPublishableArtifact(
      "docs/unclosed-tutorial.md",
      Buffer.from(`# Tutorial\n\n\`\`\`rust\n${rust}`),
    ),
    /dense plaintext source/i,
  );
});

test("keeps bounded binary artifacts binary under unknown or renamed suffixes", () => {
  const wasm = Buffer.from([0x00, 0x61, 0x73, 0x6d, 0x01, 0x00, 0x00, 0x00]);
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0xff]);
  const opaque = Buffer.from([0xc3, 0x28, 0x00, 0xff, 0x10]);
  assert.doesNotThrow(() => assertPublishableArtifact("docs/fixture.dat", wasm));
  assert.doesNotThrow(() => assertPublishableArtifact("docs/fixture.payload", png));
  assert.doesNotThrow(() => assertPublishableArtifact("docs/fixture.opaque", opaque));
  assert.doesNotThrow(() => assertPublishableArtifact(
    "docs/ordinary-note.dat",
    Buffer.from("A bounded UTF-8 note without copied source remains publishable.\n"),
  ));
});

test("requires bounded strict UTF-8 text and rejects unsafe controls", () => {
  assert.doesNotThrow(() => assertPublishableArtifact(
    "docs/bom.txt",
    Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from("ordinary text\n")]),
  ));
  assert.throws(
    () => assertPublishableArtifact(
      "docs/two-boms.txt",
      Buffer.concat([Buffer.from([0xef, 0xbb, 0xbf, 0xef, 0xbb, 0xbf]), Buffer.from("text\n")]),
    ),
    /multiple byte-order marks/i,
  );
  assert.throws(
    () => assertPublishableArtifact("docs/not-utf8.txt", Buffer.from([0xc3, 0x28])),
    /strict UTF-8/i,
  );
  assert.throws(
    () => assertPublishableArtifact("docs/control.txt", Buffer.from("before\0after\n")),
    /control character/i,
  );
});

test("rejects private topology, operator routes, evidence locators, and credential material", () => {
  const cases = [
    ["docs/path.txt", "checkout: E:\\Source\\Rust\\Product\n", /absolute Windows path/i],
    ["docs/unc.txt", "root: \\\\private-host\\share\\project\n", /UNC path/i],
    ["docs/home.txt", "root: /home/operator/project\n", /user-home path/i],
    ["docs/uai.txt", "Read /.uai/startup-packet.uai before work.\n", /private UAI route/i],
    ["docs/workspace.txt", "Open workspace.uai before work.\n", /workspace authority route/i],
    ["docs/key.txt", "-----BEGIN PRIVATE KEY-----\nsecret\n", /private key/i],
    ["docs/url.txt", "ftps://operator:secret-value@example.invalid/root\n", /credential-bearing URL/i],
    ["docs/secret.txt", "api_key = abcdefghijklmnop\n", /credential assignment/i],
    ["docs/evidence.txt", "private_evidence_root: hidden-volume/root\n", /private evidence locator/i],
  ];
  for (const [relativePath, contents, expected] of cases) {
    assert.throws(() => assertPublishableArtifact(relativePath, Buffer.from(contents)), expected, relativePath);
  }
});

test("defines the exact public path policy used by package and deployment closure", () => {
  for (const relativePath of [
    ".htaccess",
    ".uai/index.uai",
    ".uai/long-term-memory.uai",
    ".well-known/uaix-talisman.txt",
    "assets/js/site.js",
    "data/site.php",
    "docs/report-index.md",
    "docs/reports/.htaccess",
    "docs/runtime-portal/index.md",
    "includes/functions.php",
  ]) {
    assert.equal(isPublicArtifactPath(relativePath), true, relativePath);
  }
  for (const relativePath of [
    ".uai/taboo.uai",
    ".uai/talisman.uai",
    ".uai/totem.uai",
    ".uai/short-term-memory.uai",
    "docs/reports/tiny-language-models-for-wasm.md",
    "docs/reports/understanding-tinyrustlm-creation-and-purpose.md",
    "docs/runtime-portal/MANIFEST.md",
    "docs/runtime-portal/runtime-docs/index.md",
    "README.md",
    "deploy/site-deployment-manifest.v1.json",
    "tools/deploy-site.ps1",
    "docs/.gitkeep",
  ]) {
    assert.equal(isPublicArtifactPath(relativePath), false, relativePath);
  }
});

test("accepts every current public working-tree artifact under the narrowed policy", () => {
  const listed = execFileSync(
    "git",
    ["ls-files", "--cached", "--others", "--exclude-standard"],
    { cwd: path.resolve(__dirname, ".."), encoding: "utf8", maxBuffer: 16 * 1024 * 1024 },
  )
    .split(/\r?\n/)
    .filter(Boolean)
    .filter(isPublicArtifactPath)
    .filter((relativePath) => fs.existsSync(path.join(__dirname, "..", ...relativePath.split("/"))));
  assert.ok(listed.length >= 20 && listed.length <= 80, `unexpected public closure: ${listed.length}`);
  for (const relativePath of listed) {
    const bytes = fs.readFileSync(path.join(__dirname, "..", ...relativePath.split("/")));
    assert.doesNotThrow(
      () => assertPublishableArtifact(relativePath, bytes, { allowSiteSource: true }),
      relativePath,
    );
  }
});

test("release generators enforce public policy while the local historical inventory remains separate", () => {
  const toolsRoot = __dirname;
  const runtime = fs.readFileSync(path.join(toolsRoot, "build-runtime-archive-manifest.js"), "utf8");
  const packageManifest = fs.readFileSync(path.join(toolsRoot, "build-public-package-manifest.js"), "utf8");
  const deployment = fs.readFileSync(path.join(toolsRoot, "build-site-deployment-manifest.js"), "utf8");

  for (const source of [packageManifest, deployment]) {
    assert.match(source, /require\("\.\/public-artifact-policy\.js"\)/);
    assert.match(source, /assertPublishableArtifact\(/);
  }
  assert.doesNotMatch(runtime, /public-artifact-policy\.js/);
  assert.doesNotMatch(runtime, /assertPublishableArtifact\(/);
  assert.match(runtime, /function compareOrdinal/);
  assert.match(runtime, /MAX_ARCHIVE_FILE_BYTES/);
  assert.match(runtime, /Historical archive file exceeds its local inventory bound/);
  assert.match(deployment, /assertDirectoryAbsent\(stagingRoot\)/);
  assert.doesNotMatch(deployment, /fs\.(?:mkdirSync|writeFileSync|copyFileSync|cpSync)/);
});

test("retired staging paths must be absent", () => {
  const existing = path.resolve(__dirname);
  assert.doesNotThrow(() => assertPlainDirectory(existing));
  assert.throws(() => assertDirectoryAbsent(existing), /must be absent/i);
  assert.doesNotThrow(() => assertDirectoryAbsent(path.join(existing, "absent-stage-" + process.pid)));
});
