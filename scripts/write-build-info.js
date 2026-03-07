#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const versionPath = path.join(root, "version.json");
const statePath = path.join(root, ".build-state.json");
const outPath = path.join(root, "public", "build-info.json");

function git(args) {
  try {
    return execSync(`git ${args}`, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

// Plain-English bullet from a commit subject (strip conventional prefixes, capitalize)
function toBullet(subject) {
  const s = subject.replace(/^(fix|feat|chore|docs|style|refactor|perf|test|ci|build)(\([^)]*\))?!?:\s*/i, "").trim();
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// Commits since last build (or last 15 if no previous build)
let state = { buildNumber: 0, lastCommitSha: null };
try {
  state = JSON.parse(fs.readFileSync(statePath, "utf8"));
} catch (_) {}
const buildNumber = Math.max(0, Number(state.buildNumber) || 0) + 1;
const headSha = git("rev-parse HEAD");
const range = state.lastCommitSha ? `${state.lastCommitSha}..HEAD` : "HEAD";
const logOut = git(`log ${range} --pretty=format:%s -15`);
const gitUpdates = logOut
  ? logOut.split("\n").map(toBullet).filter(Boolean)
  : [];

// Persist state for next build (so next run we only show commits since this build)
fs.writeFileSync(statePath, JSON.stringify({ buildNumber, lastCommitSha: headSha || state.lastCommitSha }, null, 2), "utf8");

let version = { version: "1.0.0", updates: [] };
try {
  version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
} catch (_) {}

const versionUpdates = Array.isArray(version.updates)
  ? version.updates.filter((x) => typeof x === "string")
  : [];
// Use version.json updates if provided; otherwise auto-fill from git so build info always updates
const updates = versionUpdates.length > 0 ? versionUpdates : gitUpdates;

const buildInfo = {
  buildNumber,
  buildTime: new Date().toISOString(),
  version: version.version ?? "1.0.0",
  updates,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(buildInfo, null, 2), "utf8");
