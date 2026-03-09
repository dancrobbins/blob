#!/usr/bin/env node
"use strict";

const { execSync, spawn } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const nextDir = path.join(root, ".next");
const buildClaimPath = path.join(root, ".cursor", "build-claim.txt");

function exitIfClaimInvalid() {
  const claimId = process.env.BUILD_CLAIM_ID;
  if (!claimId) return;
  try {
    const current = fs.readFileSync(buildClaimPath, "utf8").trim();
    if (current !== claimId) {
      console.log("Build claim invalidated by a newer run; exiting.");
      process.exit(0);
    }
  } catch (_) {
    // No file or unreadable: treat as invalid
    console.log("Build claim missing or unreadable; exiting.");
    process.exit(0);
  }
}

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

const PORT = 3000;
exitIfClaimInvalid();

const devAlreadyRunning = isPortInUse(PORT);

if (devAlreadyRunning) {
  // Dev server already on 3000: clear .next, build, then restart server so it serves the new build.
  // (If we only built and left the server running, it would keep serving the old build and the app would look broken.)
  console.log(`Dev server already running on port ${PORT}. Clearing cache, building, then restarting server.`);
  try {
    fs.rmSync(nextDir, { recursive: true, force: true });
  } catch (_) {}
  console.log("Building app...");
  exitIfClaimInvalid();
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  killPort(PORT);
  execSync(`node -e "setTimeout(()=>{},1200)"`, { cwd: root, stdio: "ignore", windowsHide: true });
  const dev = spawn("npm", ["run", "dev"], { cwd: root, stdio: "ignore", detached: true, shell: true });
  dev.unref();
  console.log("Dev server restarted on port 3000.");
} else {
  // No server on 3000: kill anything on 3000–3003, build, then start.
  const NEXT_PORTS = [3000, 3001, 3002, 3003];
  for (const port of NEXT_PORTS) {
    if (isPortInUse(port)) {
      console.log(`Stopping existing process on port ${port}...`);
      killPort(port);
    }
  }
  execSync(`node -e "setTimeout(()=>{},1200)"`, {
    cwd: root,
    stdio: "ignore",
    windowsHide: true,
  });
  console.log("Building app...");
  exitIfClaimInvalid();
  execSync("npm run build", { cwd: root, stdio: "inherit" });
  const dev = spawn("npm", ["run", "dev"], {
    cwd: root,
    stdio: "ignore",
    detached: true,
    shell: true,
  });
  dev.unref();
  console.log("Dev server starting on port 3000.");
}

console.log("(When run via runapp/restartall, the agent will open or refresh Cursor Browser to http://localhost:3000.)");
