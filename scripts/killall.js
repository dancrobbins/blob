#!/usr/bin/env node
"use strict";

const { execSync } = require("child_process");

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

const PORTS = [3000, 3001, 3002, 3003];
console.log("Stopping dev servers (ports 3000, 3001, 3002, 3003)...");
for (const port of PORTS) {
  killPort(port);
}
console.log("Done.");
