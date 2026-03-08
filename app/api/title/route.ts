import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

export const dynamic = "force-dynamic";

const MODEL = "gemini-2.5-flash";
const TITLE_PROMPT = `Suggest a short title (a few words, no quotation marks) for the following text. Reply with only the title, nothing else.`;

type Body = { text?: string };

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured." },
      { status: 503 }
    );
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const raw = body?.text;
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text.length === 0) {
    return NextResponse.json({ error: "Missing or empty text." }, { status: 400 });
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: MODEL });
    const result = await model.generateContent(`${TITLE_PROMPT}\n\n---\n\n${text}`);
    const response = result.response;
    const title = response.text()?.trim() ?? "";

    if (!title) {
      return NextResponse.json({ error: "No title returned." }, { status: 502 });
    }

    return NextResponse.json({ title });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Title generation failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
