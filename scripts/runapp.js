#!/usr/bin/env node
"use strict";

const { execSync, spawn } = require("child_process");
const path = require("path");

const root = path.join(__dirname, "..");

function isPortInUse(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, {
      encoding: "utf8",
      windowsHide: true,
    });
    return out.trim().length > 0;
  } catch {
    return false;
  }
}

function getDevServerPort() {
  if (isPortInUse(3000)) return 3000;
  if (isPortInUse(3001)) return 3001;
  return null;
}

console.log("Building app...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

// Recheck after build: reuse existing dev server if either port is in use (avoids Next.js "port 3000 was in use, trying 3001" message).
const existingPort = getDevServerPort();
if (existingPort !== null) {
  console.log("Using existing dev server.");
  process.exit(0);
}

const dev = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "ignore",
  detached: true,
  shell: true,
});
dev.unref();
console.log("Dev server starting.");
