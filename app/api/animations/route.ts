import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

const VIDEO_EXT = [".mp4", ".webm", ".mov"];

function isVideo(name: string): boolean {
  const ext = path.extname(name).toLowerCase();
  return VIDEO_EXT.includes(ext);
}

function listVideosIn(dir: string): string[] {
  try {
    if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return [];
    return fs.readdirSync(dir).filter(isVideo).sort();
  } catch {
    return [];
  }
}

/**
 * Returns video filenames for each subdirectory of assets/animations (or public copy).
 * Subdirs are discovered dynamically (e.g. idle, jump, lean left, look, sleep, spin).
 * Fallbacks: idle uses root animations if empty; jump uses idle if empty.
 */
export async function GET() {
  const baseDirs = [
    path.join(process.cwd(), "public", "assets", "animations"),
    path.join(process.cwd(), "assets", "animations"),
  ];

  const byMode: Record<string, string[]> = {};
  let rootFiles: string[] = [];
  let baseUsed: string | null = null;

  for (const base of baseDirs) {
    if (!fs.existsSync(base) || !fs.statSync(base).isDirectory()) continue;
    baseUsed = base;
    rootFiles = listVideosIn(base);
    const entries = fs.readdirSync(base, { withFileTypes: true });
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const name = e.name;
      const list = listVideosIn(path.join(base, name));
      byMode[name] = list;
    }
    break;
  }

  if (baseUsed === null) {
    return NextResponse.json(byMode, {
      headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
    });
  }

  if (!byMode["idle"]?.length) byMode["idle"] = rootFiles;
  if (!byMode["jump"]?.length) byMode["jump"] = byMode["idle"] ?? rootFiles;

  return NextResponse.json(byMode, {
    headers: { "Cache-Control": "no-store, no-cache, must-revalidate", Pragma: "no-cache" },
  });
}
