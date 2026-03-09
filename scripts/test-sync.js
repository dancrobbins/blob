#!/usr/bin/env node
"use strict";

const { execSync, spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const root = path.join(__dirname, "..");
const resultsPath = path.join(root, "test-results", "sync-results.json");

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

function printPlainEnglishSummary(exitCode, resultsPath) {
  console.log("\n--- Test result (plain English) ---\n");
  let summary = "";
  let fixes = [];

  if (exitCode !== 0) {
    summary = "The sync test run did not complete successfully.";
  } else {
    summary = "The sync test run completed successfully. Cross-tab sync for text edits, blob create/delete, theme, lock/unlock, and hide/show is working.";
  }

  if (fs.existsSync(resultsPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(resultsPath, "utf8"));
      const config = data.config ?? {};
      const suites = data.suites ?? [];
      const failed = (data.stats?.failures ?? 0) > 0;
      const expectedFailures = data.stats?.expectedFailures ?? 0;
      const unexpectedFailures = data.stats?.unexpectedFailures ?? 0;

      if (failed) {
        summary = "The sync test run failed.";
        const specs = suites.flatMap((s) => s.specs ?? []);
        for (const spec of specs) {
          const tests = spec.tests ?? [];
          for (const t of tests) {
            const results = t.results ?? [];
            const failedResult = results.find((r) => r.status === "failed" || r.status === "timedOut");
            if (failedResult) {
              const err = failedResult.error?.message ?? failedResult.error ?? "Unknown error";
              if (err.includes("Timeout") || err.includes("waiting")) {
                fixes.push("Sync may be slower than the test timeout. Increase CLOUD_POLL_INTERVAL_MS or the test expect timeout.");
              }
              if (err.includes("selector") || err.includes("TestId")) {
                fixes.push("A UI element may have changed. Ensure data-testid attributes match the selectors in the test.");
              }
              if (err.includes("auth") || err.includes("login") || err.includes("toast")) {
                fixes.push("Log in to Google in both tabs before the test continues, or provide a valid storageState for CI.");
              }
              if (err.includes("Connect") || err.includes("connectOverCDP") || err.includes("9222")) {
                fixes.push("The test uses only the Cursor Browser (no new window). Ensure the browser is open with remote debugging on port 9222, or set PLAYWRIGHT_CDP_URL.");
              }
            }
          }
        }
        if (fixes.length === 0) fixes.push("Check the test output above for the failing assertion and fix the app or test accordingly.");
      }
    } catch (_) {
      // ignore parse errors
    }
  } else if (exitCode !== 0) {
    fixes.push("Build or dev server may have failed. Check the log above.");
  }

  console.log(summary);
  if (fixes.length > 0) {
    console.log("\nRecommended next steps:");
    fixes.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log("");
}

// The test runs its own dev server on port 3001 so it never disturbs
// the normal dev tab at localhost:3000.
const TEST_PORT = 3001;

// Kill any stale process on port 3001 BEFORE clearing .next,
// so no locked files cause the clean to fail.
if (isPortInUse(TEST_PORT)) {
  console.log(`Stopping existing dev server on port ${TEST_PORT}...`);
  killPort(TEST_PORT);
  execSync(`node -e "setTimeout(()=>{},1500)"`, { cwd: root, stdio: "ignore", windowsHide: true });
}

console.log("Building app (clearing Next.js cache first)...");
try {
  // Clear the Next.js incremental build cache to avoid stale type errors.
  // Do this after killing the dev server so files are not locked.
  const nextDir = path.join(root, ".next");
  if (fs.existsSync(nextDir)) {
    fs.rmSync(nextDir, { recursive: true, force: true });
    // Short pause to ensure the OS releases any file handles
    execSync(`node -e "setTimeout(()=>{},500)"`, { cwd: root, stdio: "ignore", windowsHide: true });
  }
  execSync("npm run build", { cwd: root, stdio: "inherit" });
} catch (e) {
  console.error("Build failed. Aborting test run.");
  printPlainEnglishSummary(1, resultsPath);
  process.exit(1);
}

const dev = spawn("npm", ["run", "dev", "--", "--port", String(TEST_PORT)], {
  cwd: root,
  stdio: "ignore",
  detached: true,
  shell: true,
});
dev.unref();
console.log(`Test dev server starting on port ${TEST_PORT}. Waiting 6s for it to be ready...`);
execSync(`node -e "setTimeout(()=>{},6000)"`, { cwd: root, stdio: "ignore", windowsHide: true });

// Point Playwright at the test server
process.env.PLAYWRIGHT_BASE_URL = `http://localhost:${TEST_PORT}`;

if (!process.env.PLAYWRIGHT_CDP_URL) {
  process.env.PLAYWRIGHT_CDP_URL = "http://127.0.0.1:9222";
  console.log("Using Cursor Browser / CDP at " + process.env.PLAYWRIGHT_CDP_URL + " (set PLAYWRIGHT_CDP_URL to override).\n");
}
console.log("Ensuring Playwright Chromium is installed (for fallback when CDP is not available)...");
try {
  execSync("npx playwright install chromium", { cwd: root, stdio: "pipe", windowsHide: true });
} catch (_) {}
console.log("Running two-tab sync tests...\n");
let testExitCode = 0;
try {
  execSync("npx playwright test tests/e2e/google-sync-two-tab.spec.ts --project=default", {
    cwd: root,
    stdio: "inherit",
    env: { ...process.env, PLAYWRIGHT_CDP_URL: process.env.PLAYWRIGHT_CDP_URL },
  });
} catch (e) {
  testExitCode = e.status ?? 1;
}

printPlainEnglishSummary(testExitCode, resultsPath);
process.exit(testExitCode);
