#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");

// Next.js emits server chunks to .next/server/chunks/ but webpack-runtime requires them
// as ./<id>.js from .next/server/, so Node looks for .next/server/<id>.js. Copy chunk
// files into server/ so production and deployed builds can load them.
const serverDir = path.join(root, ".next", "server");
const chunksDir = path.join(serverDir, "chunks");
try {
  if (fs.existsSync(chunksDir)) {
    for (const name of fs.readdirSync(chunksDir)) {
      if (name.endsWith(".js")) {
        fs.copyFileSync(path.join(chunksDir, name), path.join(serverDir, name));
      }
    }
  }
} catch (_) {
  // Non-fatal; build continues
}
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

// Build number increments on every build (every time this script runs), not just on git commits.
// State is persisted in .build-state.json so the number keeps going up across runs.
let state = { buildNumber: 0, lastCommitSha: null };
try {
  state = JSON.parse(fs.readFileSync(statePath, "utf8"));
} catch (_) {}
// If state file was missing, try to continue from last written build-info so we don't reset to 1
if (state.buildNumber == null || state.buildNumber === 0) {
  try {
    const prev = JSON.parse(fs.readFileSync(outPath, "utf8"));
    if (prev && typeof prev.buildNumber === "number" && prev.buildNumber > 0) {
      state.buildNumber = prev.buildNumber;
    }
  } catch (_) {}
}
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
