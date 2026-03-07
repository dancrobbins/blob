#!/usr/bin/env node
"use strict";

/**
 * Generates assets/character color schemes.png from the 9 character expression sprites
 * in the same order as BLOBBY_COLOR_NAMES (lib/types.ts), so the menu grid matches selection.
 * Each cell is the top-left frame (first expression) of each color's sprite.
 */

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const root = path.join(__dirname, "..");
const ASSETS = path.join(root, "assets");
const EXPRESSIONS_DIR = path.join(ASSETS, "character expressions");
const OUT_FILE = path.join(ASSETS, "character color schemes.png");

// Must match lib/types.ts BLOBBY_COLOR_NAMES (grid order: left-to-right, top-to-bottom).
const BLOBBY_COLOR_NAMES = [
  "pink",
  "green",
  "light brown",
  "seafoam",
  "purple",
  "yellow",
  "dark brown",
  "rainbow",
  "grey",
];

const GRID = 3;
const SPRITE_SIZE = 2048; // each expression PNG is 2048x2048, 3x3 grid
const CELL_SIZE = Math.floor(SPRITE_SIZE / GRID); // 682
const OUT_SIZE = CELL_SIZE * GRID; // 2046

async function main() {
  const composites = [];

  for (let i = 0; i < BLOBBY_COLOR_NAMES.length; i++) {
    const name = BLOBBY_COLOR_NAMES[i];
    const srcPath = path.join(EXPRESSIONS_DIR, `${name}.png`);
    if (!fs.existsSync(srcPath)) {
      console.warn("Skip (missing):", srcPath);
      continue;
    }
    const row = Math.floor(i / GRID);
    const col = i % GRID;
    const left = col * CELL_SIZE;
    const top = row * CELL_SIZE;

    const cellBuffer = await sharp(srcPath)
      .extract({
        left: 0,
        top: 0,
        width: CELL_SIZE,
        height: CELL_SIZE,
      })
      .png()
      .toBuffer();

    composites.push({
      input: cellBuffer,
      left,
      top,
    });
  }

  if (composites.length !== BLOBBY_COLOR_NAMES.length) {
    console.error("Missing some expression files; aborting.");
    process.exit(1);
  }

  await sharp({
    create: {
      width: OUT_SIZE,
      height: OUT_SIZE,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite(composites)
    .png()
    .toFile(OUT_FILE);

  console.log("Generated", path.relative(root, OUT_FILE), `(${OUT_SIZE}x${OUT_SIZE}, 3x3 grid in BLOBBY_COLOR_NAMES order)`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
