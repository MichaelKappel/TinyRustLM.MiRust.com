"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { assertPlainDirectory } = require("./public-artifact-policy.js");

/** Own bounded non-source test output beneath this canonical repository's artifacts. */
function temporaryDirectory(context, prefix) {
  assert.match(prefix, /^[a-z][a-z0-9-]{0,63}$/);
  const artifactRoot = path.resolve(__dirname, "../artifacts");
  assertPlainDirectory(artifactRoot);
  const parent = path.join(artifactRoot, "tests");
  if (!fs.existsSync(parent)) fs.mkdirSync(parent);
  assertPlainDirectory(parent);
  const root = fs.mkdtempSync(path.join(parent, prefix));
  const marker = path.join(root, ".test-owner");
  const owner = crypto.randomUUID();
  fs.writeFileSync(marker, owner, { flag: "wx" });
  context.after(() => {
    assert.equal(path.dirname(root), parent);
    assertPlainDirectory(root);
    const stat = fs.lstatSync(marker);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.nlink === 1 && stat.size === owner.length);
    assert.equal(fs.readFileSync(marker, "utf8"), owner);
    const pending = [{ directory: root, depth: 0 }];
    let count = 0;
    while (pending.length) {
      const { directory, depth } = pending.pop();
      assert.ok(depth <= 32);
      for (const name of fs.readdirSync(directory)) {
        assert.ok(++count <= 8192);
        const entry = path.join(directory, name);
        const item = fs.lstatSync(entry);
        assert.ok(!item.isSymbolicLink() && (item.isFile() || item.isDirectory()));
        if (item.isDirectory()) pending.push({ directory: entry, depth: depth + 1 });
      }
    }
    fs.rmSync(root, { recursive: true, force: false, maxRetries: 3, retryDelay: 100 });
    assert.equal(fs.existsSync(root), false);
  });
  return root;
}

module.exports = { temporaryDirectory };
