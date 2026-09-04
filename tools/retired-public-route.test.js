#!/usr/bin/env node
"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const net = require("node:net");
const path = require("node:path");
const { once } = require("node:events");
const { spawn, spawnSync } = require("node:child_process");
const test = require("node:test");

const repositoryRoot = path.resolve(__dirname, "..");
const goneBody = "This public source copy has been permanently retired.\n";
const retainedReportNames = [
  "analyzing-website-virality.md",
  "future-proof-native-html5-techniques.md",
  "innovative-vanilla-web-design.md",
  "mememtech-vanilla-web-architecture.md",
  "memory-systems-domains-research.md",
  "rust-wasm-neural-model-patterns.md",
  "tiny-language-models-for-rust-wasm.md",
  "tiny-language-models-for-wasm.md",
  "understanding-tinyrustlm-creation-and-purpose.md",
  "vanilla-js-future-proof-techniques.md",
];
const retiredReportNames = [
  ...retainedReportNames,
  "gguf-mirust-all-source-review-bundle.txt",
];

function encodedBasename(name) {
  const first = name.codePointAt(0).toString(16).padStart(2, "0");
  const dot = name.lastIndexOf(".");
  return `%${first}${name.slice(1, dot)}%2E${name.slice(dot + 1)}`;
}

function reportRouteVariants(name) {
  return [
    `/docs/reports/${name}`,
    `/DOCS/REPORTS/${name.toUpperCase()}`,
    `/docs/reports/${encodedBasename(name)}`,
    `/docs%2Freports%2F${name}`,
  ];
}

// Finds the same local PHP CLI used by the site's focused syntax checks.
function findPhpBinary() {
  const candidates = [
    process.env.PHP_BINARY,
    process.platform === "win32" ? "C:\\php\\php.exe" : "php",
    "php",
  ].filter(Boolean);
  for (const candidate of candidates) {
    if (path.isAbsolute(candidate) && !fs.existsSync(candidate)) continue;
    const probe = spawnSync(candidate, ["-v"], { encoding: "utf8", windowsHide: true });
    if (!probe.error && probe.status === 0) return candidate;
  }
  return null;
}

// Reserves a loopback port long enough to avoid hard-coded test listeners.
async function availablePort() {
  const server = net.createServer();
  server.unref();
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

// Makes one non-following request and returns the raw status, headers, and bounded body.
function request(port, requestPath, method = "GET") {
  return new Promise((resolve, reject) => {
    const operation = http.request({
      host: "127.0.0.1",
      port,
      path: requestPath,
      method,
      timeout: 3000,
    }, (response) => {
      const chunks = [];
      let bytes = 0;
      response.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 4096) {
          response.destroy(new Error("Response exceeded the route-test body bound."));
          return;
        }
        chunks.push(chunk);
      });
      response.on("end", () => resolve({
        body: Buffer.concat(chunks).toString("utf8"),
        headers: response.headers,
        status: response.statusCode,
      }));
    });
    operation.on("timeout", () => operation.destroy(new Error("Route request timed out.")));
    operation.on("error", reject);
    operation.end();
  });
}

// Polls only until the owned PHP process accepts requests or exits.
async function waitUntilReady(server, port, diagnostics) {
  let lastError = "no request attempted";
  for (let attempt = 0; attempt < 60; attempt += 1) {
    if (server.exitCode !== null) {
      throw new Error(`PHP server exited before readiness (${lastError}): ${diagnostics()}`);
    }
    try {
      await request(port, "/", "HEAD");
      return;
    }
    catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw new Error(`PHP server did not become ready (${lastError}): ${diagnostics()}`);
}

// Verifies every terminal header and the fixed non-reflective response body.
function assertGone(response, expectBody = true) {
  assert.equal(response.status, 410);
  assert.equal(response.headers.location, undefined);
  assert.equal(response.headers["cache-control"], "no-store");
  assert.equal(response.headers["x-robots-tag"], "noindex, nofollow");
  assert.equal(response.headers["x-content-type-options"], "nosniff");
  assert.equal(response.headers["content-type"], "text/plain; charset=utf-8");
  assert.equal(response.headers["content-length"], String(Buffer.byteLength(goneBody)));
  assert.equal(response.body, expectBody ? goneBody : "");
  assert.ok(Buffer.byteLength(response.body) <= 128);
}

test("Apache guards retire private UAI and raw archive paths before file bypass", () => {
  const contents = fs.readFileSync(path.join(repositoryRoot, ".htaccess"), "utf8");
  const uaiRule = "RewriteRule ^\\.uai/(?!index\\.uai$|long-term-memory\\.uai$).+ - [G,NC]";
  const archiveRule = "RewriteRule ^docs/runtime-portal/(?!index\\.md$).+ - [G,NC]";
  const bypass = "RewriteCond %{REQUEST_FILENAME} -f [OR]";
  assert.ok(contents.indexOf(uaiRule) > contents.indexOf("RewriteEngine On"));
  const reportRule = contents.indexOf("RewriteRule ^docs/reports/(?:");
  assert.ok(reportRule > contents.indexOf(uaiRule));
  for (const name of retiredReportNames) {
    assert.ok(contents.includes(name.replace(".", "\\.")), name);
  }
  assert.ok(contents.indexOf(archiveRule) > reportRule);
  assert.ok(contents.indexOf(archiveRule) < contents.indexOf(bypass));
  assert.doesNotMatch(contents, /RewriteRule \^docs\/reports\/\.\+/);
  assert.match(contents, /^ErrorDocument 410 \/docs\/retired-source-copy-gone\.txt$/m);

  const reportGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "reports", ".htaccess"), "utf8");
  const archiveGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "runtime-portal", ".htaccess"), "utf8");
  const workspaceGuard = fs.readFileSync(path.join(repositoryRoot, "docs", "runtime-portal", "runtime-docs", ".htaccess"), "utf8");
  const uaiGuard = fs.readFileSync(path.join(repositoryRoot, ".uai", ".htaccess"), "utf8");
  assert.match(reportGuard, /^RewriteRule \^\(\?:/m);
  for (const name of retiredReportNames) {
    assert.ok(reportGuard.includes(name.replace(".", "\\.")), name);
  }
  assert.doesNotMatch(reportGuard, /RewriteRule \^\.\+/);
  assert.match(archiveGuard, /^RewriteRule \^\(\?!index\\\.md\$\)\.\+ - \[G,NC\]$/m);
  assert.match(workspaceGuard, /^RewriteRule \^workspace\\\.uai\$ - \[G,NC\]$/m);
  assert.match(uaiGuard, /<FilesMatch "\^\(index\|long-term-memory\)\\\.uai\$">/);
  assert.match(uaiGuard, /<FilesMatch "\^\(\?!\(index\|long-term-memory\)\\\.uai\$\)\.\+">/);
});

test("deployment readback requires production GET and HEAD retirement proof", () => {
  const deployment = fs.readFileSync(path.join(repositoryRoot, "tools", "deploy-site.ps1"), "utf8");
  const generator = fs.readFileSync(path.join(repositoryRoot, "tools", "build-site-deployment-manifest.js"), "utf8");
  assert.match(deployment, /Assert-RetiredRouteReadback/);
  assert.match(deployment, /if \(\$CacheBusted\)/);
  assert.match(deployment, /foreach \(\$cacheBusted in @\(\$false, \$true\)\)/);
  assert.match(deployment, /-Method "GET"/);
  assert.match(deployment, /-Method "HEAD"/);
  assert.match(deployment, /-CacheBusted \$cacheBusted/);
  assert.match(deployment, /retired_route_request_count[^\n]+\* 4/);
  assert.match(deployment, /StatusCode -ne 410/);
  assert.match(deployment, /Headers\.Location/);
  assert.match(deployment, /Content-Length/);
  assert.match(generator, /retired_route_checks/);
});

const phpBinary = findPhpBinary();
test("non-public UAI and raw archive routes return bounded 410 responses while public boundaries remain available", {
  skip: phpBinary ? false : "PHP CLI is unavailable",
}, async () => {
  const port = await availablePort();
  const server = spawn(phpBinary, ["-S", `127.0.0.1:${port}`, "index.php"], {
    cwd: repositoryRoot,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  let diagnosticText = "";
  const capture = (chunk) => {
    diagnosticText = (diagnosticText + chunk.toString("utf8")).slice(-8192);
  };
  server.stdout.on("data", capture);
  server.stderr.on("data", capture);

  try {
    await waitUntilReady(server, port, () => diagnosticText);
    const retiredRequests = [
      ...retiredReportNames.flatMap(reportRouteVariants),
      "/docs/runtime-portal/runtime-docs/workspace.uai",
      "/DoCs/RuNtImE-PoRtAl/RuNtImE-DoCs/WoRkSpAcE.UaI",
      "/docs/runtime-portal/runtime-docs/%77orkspace%2Euai",
      "/docs%2Fruntime-portal%2Fruntime-docs%2Fworkspace.uai",
      "/docs/reports/gguf-mirust-all-source-review-bundle.txt?ignored=query",
      "/.uai/taboo.uai",
      "/.UAI/TALISMAN.UAI",
      "/.uai/%74otem%2Euai",
      "/.uai%2Fshort-term-memory.uai",
      "/docs/runtime-portal/MANIFEST.md",
      "/docs/runtime-portal/runtime-docs/readme.md",
      "/docs/runtime-portal/runtime-docs/workspace.uai/child",
      "/docs/runtime-portal/runtime-docs/workspace.uaix",
      "/docs/runtime-portal/package/README.md",
      "/DoCs/RuNtImE-PoRtAl/PaCkAgE/README.MD",
      "/docs/runtime-portal/%70ackage%2FREADME.md",
    ];
    for (const requestPath of retiredRequests) {
      assertGone(await request(port, requestPath));
      assertGone(await request(port, requestPath, "HEAD"), false);
    }

    const unrelatedRequests = [
      ["/docs/", 200],
      ["/docs/report-index.md", 200],
      ["/.uai/index.uai", 200],
      ["/.uai/long-term-memory.uai", 200],
      ["/docs/runtime-portal/index.md", 200],
      ["/docs/reports/not-a-retained-report.md", 404],
      ["/docs/reports/gguf-mirust-all-source-review-bundle.txt.more", 404],
      ["/docs/reports/%2567%2567%2575%2566-mirust-all-source-review-bundle%252Etxt", 404],
      ["/.uai%252Ftaboo.uai", 404],
    ];
    for (const [requestPath, expectedStatus] of unrelatedRequests) {
      const response = await request(port, requestPath, "HEAD");
      assert.equal(response.status, expectedStatus, requestPath);
      assert.notEqual(response.status, 410, requestPath);
    }

    const markdown = await request(port, "/contact/?format=md");
    assert.equal(markdown.status, 200);
    assert.match(markdown.body, /^- Prepared version: 1\.8\.3$/m);
    assert.match(markdown.body, /^- Prepared status: prepared-awaiting-content-commit$/m);
    assert.match(markdown.body, /^- Last verified publication: 1\.8\.2 \(2026-08-29\)$/m);
    assert.doesNotMatch(markdown.body, /^- Version: 1\.8\.3$/m);
  }
  finally {
    if (server.exitCode === null) {
      const stopped = once(server, "exit");
      server.kill();
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error("PHP server did not stop.")), 3000);
        stopped.then(
          (result) => { clearTimeout(timeout); resolve(result); },
          (error) => { clearTimeout(timeout); reject(error); },
        );
      });
    }
  }
});
