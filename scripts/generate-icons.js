const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const pngToIco = require("png-to-ico");

const ASSETS = path.join(__dirname, "..", "assets");
const SRC = path.join(ASSETS, "blob.png");
const OUT = path.join(ASSETS, "icons");

const SIZES = {
  web: [16, 32, 180, 192, 512],
  android: [48, 72, 96, 144, 192, 512],
  ios: [1024],
  all: [16, 32, 48, 64, 72, 96, 128, 144, 180, 192, 256, 512, 1024],
};

async function main() {
  const uniqueSizes = [...new Set(SIZES.all)].sort((a, b) => a - b);

  for (const dir of ["web", "android", "ios", "windows"]) {
    fs.mkdirSync(path.join(OUT, dir), { recursive: true });
  }

  const source = sharp(SRC);
  const meta = await source.metadata();
  const size = Math.min(meta.width, meta.height) || 1024;

  for (const px of uniqueSizes) {
    const buffer = await source
      .clone()
      .resize(px, px)
      .png()
      .toBuffer();

    const baseName = `icon-${px}.png`;

    if (SIZES.web.includes(px)) {
      fs.writeFileSync(path.join(OUT, "web", baseName), buffer);
    }
    if (SIZES.android.includes(px)) {
      fs.writeFileSync(path.join(OUT, "android", baseName), buffer);
    }
    if (SIZES.ios.includes(px)) {
      fs.writeFileSync(path.join(OUT, "ios", baseName), buffer);
    }

    fs.writeFileSync(path.join(OUT, `icon-${px}.png`), buffer);
  }

  const icoSizes = [16, 32, 48, 256];
  const icoBuffers = await Promise.all(
    icoSizes.map((px) =>
      source
        .clone()
        .resize(px, px)
        .png()
        .toBuffer()
    )
  );

  const ico = await pngToIco(icoBuffers);
  fs.writeFileSync(path.join(OUT, "windows", "favicon.ico"), ico);

  console.log("Generated icons in assets/icons/");
  console.log("  web:     ", SIZES.web.map((s) => `icon-${s}.png`).join(", "));
  console.log("  android: ", SIZES.android.map((s) => `icon-${s}.png`).join(", "));
  console.log("  ios:     ", SIZES.ios.map((s) => `icon-${s}.png`).join(", "));
  console.log("  windows: favicon.ico (16, 32, 48, 256)");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
