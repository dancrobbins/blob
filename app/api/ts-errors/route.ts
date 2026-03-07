import { NextResponse } from "next/server";
import { execSync } from "child_process";
import path from "path";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export interface TsErrorItem {
  file: string;
  line: number;
  column: number;
  code: string;
  message: string;
  raw: string;
}

const TSC_ERROR_LINE =
  /^(.+?)\((\d+),(\d+)\): error (TS\d+): (.+)$/;

function parseTscOutput(output: string): TsErrorItem[] {
  const items: TsErrorItem[] = [];
  const lines = output.trim().split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(TSC_ERROR_LINE);
    if (m) {
      items.push({
        file: m[1].trim(),
        line: parseInt(m[2], 10),
        column: parseInt(m[3], 10),
        code: m[4],
        message: m[5].trim(),
        raw: line,
      });
    } else if (line.trim()) {
      items.push({
        file: "",
        line: 0,
        column: 0,
        code: "",
        message: line.trim(),
        raw: line,
      });
    }
  }
  return items;
}

export async function GET() {
  try {
    const cwd = process.cwd();
    execSync("npx tsc --noEmit --pretty false 2>&1", {
      encoding: "utf-8",
      cwd,
      maxBuffer: 2 * 1024 * 1024,
    });
    return NextResponse.json({ errors: [] });
  } catch (err: unknown) {
    const e = err as { stderr?: string; stdout?: string; message?: string };
    const stderr = (e.stderr ?? "").trim();
    const stdout = (e.stdout ?? "").trim();
    const combined = [stderr, stdout].filter(Boolean).join("\n") || (e.message ?? "Unknown error");
    const errors = parseTscOutput(combined);
    return NextResponse.json({ errors });
  }
}
