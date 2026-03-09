#!/usr/bin/env node
"use strict";

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");

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
      } catch (_) {
        // Process may already be gone
      }
    }
  } catch (e) {
    if (e.status !== 1) throw e;
    // findstr exits 1 when no match - no process on port
  }
}

console.log("Stopping dev server (ports 3000, 3001)...");
killPort(3000);
killPort(3001);

try { fs.rmSync(nextDir, { recursive: true, force: true }); } catch (_) {}
console.log("Building app...");
execSync("npm run build", { cwd: root, stdio: "inherit" });

console.log("Starting dev server...");
const dev = spawn("npm", ["run", "dev"], {
  cwd: root,
  stdio: "ignore",
  detached: true,
  shell: true,
});
dev.unref();

console.log("Dev server starting on port 3000.");
console.log("(When run via runapp/restartall, the agent will open or refresh Cursor Browser to http://localhost:3000.)");
