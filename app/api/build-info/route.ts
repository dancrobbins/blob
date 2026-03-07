import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

export async function GET() {
  const filePath = path.join(process.cwd(), "public", "build-info.json");
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && "buildTime" in data) {
      return NextResponse.json(data);
    }
  } catch {
    // File missing or invalid; fallback
  }
  return NextResponse.json({
    buildNumber: 0,
    buildTime: new Date().toISOString(),
    version: "1.0.0",
    updates: [] as string[],
  });
}
