#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");
const message = process.argv[2] || "Update";

function git(args, opts = {}) {
  return execSync(`git ${args}`, {
    cwd: root,
    encoding: "utf8",
    ...opts,
  }).trim();
}

// Current branch; use "main" if detached or no branch
let branch;
try {
  branch = git("rev-parse --abbrev-ref HEAD");
  if (branch === "HEAD") branch = "main";
} catch {
  branch = "main";
}

// Stage all changes
git("add -A");

// Commit only if there are changes
const status = git("status --porcelain");
if (status) {
  execSync(`git commit -m ${JSON.stringify(message)}`, { cwd: root, stdio: "inherit" });
} else {
  console.log("No changes to commit.");
}

// Push current branch
execSync(`git push -u origin ${branch}`, { cwd: root, stdio: "inherit" });
