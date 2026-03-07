#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const versionPath = path.join(root, "version.json");
const statePath = path.join(root, ".build-state.json");
const outPath = path.join(root, "public", "build-info.json");

// Increment build number on every run (any build, not just explicit user runapp)
let buildNumber = 1;
try {
  const state = JSON.parse(fs.readFileSync(statePath, "utf8"));
  buildNumber = Math.max(0, Number(state.buildNumber) || 0) + 1;
} catch (_) {}
fs.writeFileSync(statePath, JSON.stringify({ buildNumber }, null, 2), "utf8");

let version = { version: "1.0.0", updates: [] };
try {
  version = JSON.parse(fs.readFileSync(versionPath, "utf8"));
} catch (_) {}

const updates = Array.isArray(version.updates)
  ? version.updates.filter((x) => typeof x === "string")
  : [];

const buildInfo = {
  buildNumber,
  buildTime: new Date().toISOString(),
  version: version.version ?? "1.0.0",
  updates,
};

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(buildInfo, null, 2), "utf8");
