#!/usr/bin/env node
"use strict";

const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const authDir = path.join(root, ".auth");
const outputPath = path.join(authDir, "user.json");

const envVar = process.env.PLAYWRIGHT_STORAGE_STATE_BASE64 || process.env.E2E_STORAGE_STATE_BASE64;
if (!envVar) {
  console.warn("No PLAYWRIGHT_STORAGE_STATE_BASE64 or E2E_STORAGE_STATE_BASE64 set. CI auth will be skipped.");
  if (!fs.existsSync(outputPath)) {
    try {
      fs.mkdirSync(authDir, { recursive: true });
      fs.writeFileSync(outputPath, JSON.stringify({ cookies: [], origins: [] }), "utf8");
    } catch (_) {}
  }
  process.exit(0);
}

try {
  const decoded = Buffer.from(envVar, "base64").toString("utf8");
  const parsed = JSON.parse(decoded);
  if (!fs.existsSync(authDir)) fs.mkdirSync(authDir, { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify(parsed, null, 0), "utf8");
  console.log("Wrote Playwright storage state to .auth/user.json");
} catch (e) {
  console.error("Failed to write auth state:", e.message);
  process.exit(1);
}
