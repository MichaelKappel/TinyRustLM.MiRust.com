"use strict";

const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const Module = require("node:module");

const repositoryRoot = path.resolve(__dirname, "..");

/** Compute Git's actual blob object ID without creating a repository or object. */
function blobId(bytes) {
  return crypto.createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");
}

/** Build bounded synthetic filesystem/Git responses entirely in process memory. */
function createVirtualBoundary() {
  const files = new Map();
  const directories = new Set([repositoryRoot]);
  const commits = new Map();
  const blobs = new Map();
  let head = null;
  let sequence = 0;
  const calls = [];
  const faults = { batchPayload: false };

  /** Every simulated path names the actual repository; no alternate source root exists. */
  function normalized(value) {
    const resolved = path.resolve(value);
    const relative = path.relative(repositoryRoot, resolved);
    assert.ok(relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
    return resolved;
  }

  /** Record virtual parent directories without touching the drive. */
  function mkdirSync(value) {
    let current = normalized(value);
    while (!directories.has(current)) {
      directories.add(current);
      current = path.dirname(current);
    }
  }

  /** Replace a bounded virtual file used by adversarial validation cases. */
  function writeFileSync(value, bytes) {
    const name = normalized(value);
    mkdirSync(path.dirname(name));
    const buffer = Buffer.from(bytes);
    assert.ok(files.size < 1024 && buffer.length <= 2 * 1024 * 1024);
    files.set(name, buffer);
  }

  /** Read only explicitly synthesized data; missing paths cannot fall back to disk. */
  function readFileSync(value, encoding) {
    const bytes = files.get(normalized(value));
    if (!bytes) throw Object.assign(new Error("Virtual file does not exist"), { code: "ENOENT" });
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  }

  /** Present ordinary file/directory metadata to the real policy checker. */
  function lstatSync(value) {
    const name = normalized(value);
    if (!files.has(name) && !directories.has(name)) {
      throw Object.assign(new Error("Virtual path does not exist"), { code: "ENOENT" });
    }
    return { size: files.get(name)?.length || 0, isSymbolicLink: () => false,
      isFile: () => files.has(name), isDirectory: () => directories.has(name) };
  }

  /** Return only immediate children, preserving the real recursive policy execution. */
  function readdirSync(value, options = {}) {
    const directory = normalized(value);
    return [...new Set([...directories, ...files.keys()])]
      .filter((entry) => entry !== directory && path.dirname(entry) === directory)
      .map((entry) => options.withFileTypes
        ? { name: path.basename(entry), ...lstatSync(entry) } : path.basename(entry));
  }

  /** Delete virtual records only; recursive cleanup never reaches a filesystem API. */
  function rmSync(value, options = {}) {
    const name = normalized(value);
    files.delete(name);
    if (options.recursive) {
      for (const entry of files.keys()) if (entry.startsWith(name + path.sep)) files.delete(entry);
      for (const entry of directories) if (entry === name || entry.startsWith(name + path.sep)) directories.delete(entry);
    }
  }
  const realpathSync = (value) => normalized(value);
  realpathSync.native = realpathSync;
  const virtualFs = { mkdirSync, writeFileSync, readFileSync, lstatSync, readdirSync, rmSync, realpathSync };

  /** Resolve an explicitly created virtual commit. */
  function getCommit(id) {
    const commit = commits.get(id === "HEAD" ? head : id);
    assert.ok(commit, `Unexpected virtual commit: ${id}`);
    return commit;
  }

  /** Implement only the exact Git command protocol exercised by the validator. */
  function git(root, args, encoding = "utf8", input) {
    assert.equal(root, repositoryRoot);
    calls.push(args);
    let result;
    const [command, argument] = args;
    if (command === "add") result = "";
    else if (command === "commit") {
      const snapshot = new Map([...files].filter(([name]) => name.startsWith(path.join(repositoryRoot, "docs") + path.sep))
        .map(([name, bytes]) => [path.relative(repositoryRoot, name).split(path.sep).join("/"), Buffer.from(bytes)]));
      const id = String(++sequence).padStart(40, "0");
      const tree = crypto.createHash("sha1").update(JSON.stringify([...snapshot].map(([name, bytes]) => [name, blobId(bytes)]))).digest("hex");
      for (const bytes of snapshot.values()) blobs.set(blobId(bytes), bytes);
      commits.set(id, { id, parent: head, tree, snapshot });
      head = id;
      result = "";
    } else if (command === "rev-parse") {
      if (argument === "HEAD") result = head;
      else if (argument.endsWith("^{tree}")) result = getCommit(argument.slice(0, -7)).tree;
      else {
        const separator = argument.indexOf(":");
        const bytes = getCommit(argument.slice(0, separator)).snapshot.get(argument.slice(separator + 1));
        assert.ok(bytes);
        result = blobId(bytes);
      }
    } else if (command === "rev-list") {
      const commit = getCommit(args.at(-1));
      result = `${commit.id} ${commit.parent}`;
    } else if (command === "diff-tree") {
      const commit = getCommit(args.at(-2));
      const previous = getCommit(commit.parent).snapshot;
      result = [...commit.snapshot].filter(([name, bytes]) => !previous.get(name)?.equals(bytes)).map(([name]) => name).join("\n");
    } else if (command === "ls-tree") {
      result = [...getCommit(args.at(-1)).snapshot].map(([name, bytes]) =>
        `100644 blob ${blobId(bytes)} ${bytes.length}\t${name}\0`).join("");
    } else if (command === "ls-files") {
      const tracked = [...getCommit("HEAD").snapshot.keys()];
      const present = [...files.keys()].map((name) => path.relative(repositoryRoot, name).split(path.sep).join("/"))
        .filter((name) => !args.includes("--exclude-standard") || name !== faults.ignoredFile);
      result = [...new Set([...tracked, ...present])].join("\0") + "\0";
    } else if (command === "merge-base") {
      let current = getCommit(args[3]);
      while (current.id !== args[2] && current.parent) current = getCommit(current.parent);
      assert.equal(current.id, args[2], "Virtual commit is not an ancestor");
      result = "";
    } else if (command === "show") {
      const separator = argument.indexOf(":");
      result = getCommit(argument.slice(0, separator)).snapshot.get(argument.slice(separator + 1));
      assert.ok(result);
    } else if (command === "hash-object") result = blobId(input);
    else if (command === "cat-file" && argument === "-e") {
      getCommit(args[2].replace("^{commit}", ""));
      result = "";
    } else if (command === "cat-file" && argument === "blob") result = blobs.get(args[2]);
    else if (command === "cat-file" && argument === "--batch") {
      result = Buffer.concat(input.toString("ascii").trim().split("\n").flatMap((id) => {
        const bytes = blobs.get(id);
        assert.ok(bytes);
        return [Buffer.from(`${id} blob ${bytes.length}\n`), bytes, Buffer.from("\n")];
      }));
      if (faults.batchPayload) result[result.indexOf(0x0a) + 1] ^= 1;
    } else throw new Error(`Unexpected virtual Git command: ${args.join(" ")}`);
    assert.notEqual(result, undefined);
    const bytes = Buffer.isBuffer(result) ? result : Buffer.from(result);
    return encoding ? bytes.toString(encoding) : Buffer.from(bytes);
  }

  /** Load the canonical implementation in memory with explicit boundary responses. */
  function load(name, dependencies) {
    const filename = path.join(__dirname, name);
    const loaded = new Module(filename, module);
    loaded.filename = filename;
    loaded.paths = Module._nodeModulePaths(__dirname);
    const requireOriginal = loaded.require.bind(loaded);
    loaded.require = (id) => Object.hasOwn(dependencies, id) ? dependencies[id] : requireOriginal(id);
    loaded._compile(fs.readFileSync(filename, "utf8"), filename);
    return loaded.exports;
  }
  const policy = load("public-artifact-policy.js", { "node:fs": virtualFs });
  const api = load("verify-site-deployment-input.js", {
    "node:fs": virtualFs, "./public-artifact-policy.js": policy,
    "node:child_process": { execFileSync(executable, args, options) {
      assert.equal(executable, "git");
      return git(options.cwd, args, options.encoding, options.input);
    } }
  });
  return { root: repositoryRoot, fs: virtualFs, git, api, calls, faults };
}

module.exports = { createVirtualBoundary };
