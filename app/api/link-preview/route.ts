import { NextRequest, NextResponse } from "next/server";

const HOVER_PREVIEW_TIMEOUT_MS = 8000;
const MAX_HTML_LENGTH = 256 * 1024;

function getMetaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["'](?:og:)?${escaped}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  if (m) return m[1].trim();
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["'](?:og:)?${escaped}["']`,
    "i"
  );
  const m2 = html.match(re2);
  return m2 ? m2[1].trim() : null;
}

export async function GET(request: NextRequest) {
  const urlParam = request.nextUrl.searchParams.get("url");
  if (!urlParam || typeof urlParam !== "string") {
    return NextResponse.json({ error: "Missing url" }, { status: 400 });
  }
  let parsed: URL;
  try {
    parsed = new URL(urlParam);
  } catch {
    return NextResponse.json({ error: "Invalid url" }, { status: 400 });
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    return NextResponse.json({ error: "Only http(s) allowed" }, { status: 400 });
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), HOVER_PREVIEW_TIMEOUT_MS);
  try {
    const res = await fetch(parsed.href, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BlobLinkPreview/1.0; +https://github.com/blob)",
      },
      redirect: "follow",
    });
    clearTimeout(timeout);
    if (!res.ok) {
      return NextResponse.json(
        { error: `Fetch failed: ${res.status}` },
        { status: 502 }
      );
    }
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.toLowerCase().includes("text/html")) {
      return NextResponse.json(
        { imageUrl: null, title: null },
        { headers: { "Cache-Control": "public, max-age=300" } }
      );
    }
    const raw = await res.text();
    const html = raw.slice(0, MAX_HTML_LENGTH);
    const imageUrl =
      getMetaContent(html, "image") ?? getMetaContent(html, "twitter:image");
    const title =
      getMetaContent(html, "title") ??
      getMetaContent(html, "site_name") ??
      getMetaContent(html, "twitter:title");
    const resolvedImage =
      imageUrl && !imageUrl.startsWith("http")
        ? new URL(imageUrl, parsed.origin).href
        : imageUrl;
    return NextResponse.json(
      { imageUrl: resolvedImage || null, title: title || null },
      { headers: { "Cache-Control": "public, max-age=300" } }
    );
  } catch (e) {
    clearTimeout(timeout);
    if (e instanceof Error && e.name === "AbortError") {
      return NextResponse.json({ error: "Timeout" }, { status: 504 });
    }
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Fetch failed" },
      { status: 502 }
    );
  }
}
