#!/usr/bin/env node
"use strict";

/**
 * Regenerates blobby graphics from the assets folder and syncs them to public/assets
 * so the Next.js app serves the latest character sprites, color schemes, blob, and icons.
 *
 * 1. Runs generate-icons.js to regenerate icons from assets/blob.png
 * 2. Copies assets/ → public/assets/ for blob, character color schemes, expressions, icons
 */

const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

const root = path.join(__dirname, "..");
const ASSETS = path.join(root, "assets");
const PUBLIC_ASSETS = path.join(root, "public", "assets");

function mkdirRecursive(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function copyFile(src, dest) {
  if (!fs.existsSync(src)) {
    console.warn("Skip (missing):", src);
    return;
  }
  mkdirRecursive(path.dirname(dest));
  fs.copyFileSync(src, dest);
  console.log("Copied:", path.relative(root, src), "→", path.relative(root, dest));
}

function copyDirRecursive(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) {
    console.warn("Skip (missing dir):", srcDir);
    return;
  }
  const entries = fs.readdirSync(srcDir, { withFileTypes: true });
  for (const e of entries) {
    const srcPath = path.join(srcDir, e.name);
    const destPath = path.join(destDir, e.name);
    if (e.isDirectory()) {
      mkdirRecursive(destPath);
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log("Copied:", path.relative(root, srcPath), "→", path.relative(root, destPath));
    }
  }
}

function main() {
  console.log("Regenerating blobby graphics from assets/...\n");

  // 1. Regenerate icons from assets/blob.png
  console.log("1. Regenerating icons from assets/blob.png");
  execSync("node scripts/generate-icons.js", { cwd: root, stdio: "inherit" });
  console.log("");

  // 2. Sync assets → public/assets
  console.log("2. Syncing assets/ → public/assets/");
  mkdirRecursive(PUBLIC_ASSETS);

  copyFile(
    path.join(ASSETS, "blob.png"),
    path.join(PUBLIC_ASSETS, "blob.png")
  );
  copyFile(
    path.join(ASSETS, "character color schemes.png"),
    path.join(PUBLIC_ASSETS, "character color schemes.png")
  );

  const expressionsDir = path.join(ASSETS, "character expressions");
  const publicExpressions = path.join(PUBLIC_ASSETS, "character expressions");
  if (fs.existsSync(expressionsDir)) {
    mkdirRecursive(publicExpressions);
    copyDirRecursive(expressionsDir, publicExpressions);
  }

  const iconsDir = path.join(ASSETS, "icons");
  const publicIcons = path.join(PUBLIC_ASSETS, "icons");
  if (fs.existsSync(iconsDir)) {
    copyDirRecursive(iconsDir, publicIcons);
  }

  // Root-level pink.png if used
  const pinkSrc = path.join(ASSETS, "pink.png");
  if (fs.existsSync(pinkSrc)) {
    copyFile(pinkSrc, path.join(PUBLIC_ASSETS, "pink.png"));
  }

  console.log("\nDone. public/assets/ is up to date with assets/.");
}

main();
