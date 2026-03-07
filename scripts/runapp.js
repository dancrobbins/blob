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

console.log("Building app...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

const devServerAlreadyRunning = isPortInUse(3000) || isPortInUse(3001);
if (devServerAlreadyRunning) {
  console.log("Using existing dev server (port 3000 or 3001 already in use).");
} else {
  console.log("Starting dev server...");
  const dev = spawn("npm", ["run", "dev"], {
    cwd: root,
    stdio: "ignore",
    detached: true,
    shell: true,
  });
  dev.unref();
  console.log("Dev server starting.");
}

console.log("Use Cursor Browser to open or refresh the app (e.g. http://localhost:3000 or :3001).");
