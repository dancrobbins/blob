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

function killPort(port) {
  try {
    const out = execSync(`netstat -ano | findstr :${port}`, {
      encoding: "utf8",
      windowsHide: true,
    });
    const pids = new Set();
    for (const line of out.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || !trimmed.includes("LISTENING")) continue;
      const parts = trimmed.split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && /^\d+$/.test(pid)) pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: "ignore", windowsHide: true });
        console.log(`Stopped process on port ${port} (PID ${pid}).`);
      } catch (_) {}
    }
  } catch (e) {
    if (e.status !== 1) throw e;
  }
}

// Kill ANY existing dev servers on common Next.js ports before building.
// This is critical: reusing a running dev server after a new build produces
// mismatched asset hashes — the HTML references new ?v= timestamps but the
// old server doesn't know about them, causing CSS/JS 404s.
const NEXT_PORTS = [3000, 3001, 3002, 3003];
for (const port of NEXT_PORTS) {
  if (isPortInUse(port)) {
    console.log(`Stopping existing dev server on port ${port}...`);
    killPort(port);
  }
}

// Short wait to ensure ports are fully released before the build.
execSync(`node -e "setTimeout(()=>{},1200)"`, {
  cwd: root,
  stdio: "ignore",
  windowsHide: true,
});

console.log("Building app...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

// Start a fresh dev server on port 3000.
const dev = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "ignore",
  detached: true,
  shell: true,
});
dev.unref();
console.log("Dev server starting on port 3000.");
