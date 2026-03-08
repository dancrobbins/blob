import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const SUMMARY_PROMPT = `Summarize the following notes in 2–4 short sentences of plain prose. Capture the main themes and ideas. Do not use bullet points or labels.`;

type Body = { text?: string };

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "Summaries are not configured. Add GEMINI_API_KEY to .env.local." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const raw = body?.text;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length === 0) {
    return NextResponse.json(
      { error: "Missing or empty text." },
      { status: 400 }
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(`${SUMMARY_PROMPT}\n\n---\n\n${text}`);
    const response = result.response;
    const summary = response.text()?.trim() ?? "";

    if (!summary) {
      return NextResponse.json(
        { error: "No summary returned." },
        { status: 502 }
      );
    }

    return NextResponse.json({ summary });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Summarization failed.";
    const isRateLimit =
      message.includes("429") ||
      message.includes("RESOURCE_EXHAUSTED") ||
      message.includes("quota") ||
      message.toLowerCase().includes("rate limit");
    if (isRateLimit) {
      return NextResponse.json(
        { error: "RATE_LIMIT" },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { error: message },
      { status: 502 }
    );
  }
}
