/**
 * ESV passage proxy.
 *
 * The browser never sees the ESV API key (ADR 0006, spec §3.3). Citation
 * popovers fetch this route with a citation shape and we proxy to
 * api.esv.org server-side, cache the response in memory with a TTL, and
 * rate-limit per IP. Mutable state lives in src/lib/esv/state.ts so this
 * route module only exposes the HTTP method exports Next allows.
 *
 * Contract:
 *   GET /api/esv?book=Revelation&chapter=21&verse_start=21
 *   GET /api/esv?book=Revelation&chapter=21&verse_start=12&verse_end=14
 *
 * Responses:
 *   200 { reference: "Revelation 21:21", text: "...", cached: boolean }
 *   400 { error: "..." }   bad/missing params
 *   401 { error: "..." }   no ESV_API_KEY on the server
 *   429 { error: "..." }   per-IP rate limit hit
 *   502 { error: "..." }   ESV API upstream error
 */

import { NextRequest, NextResponse } from "next/server";

import {
  CACHE_TTL_MS,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  cache,
  rateBuckets,
} from "@/lib/esv/state";

const ESV_API_URL = "https://api.esv.org/v3/passage/text/";

const ESV_TEXT_PARAMS: Record<string, string> = {
  "include-verse-numbers": "true",
  "include-headings": "false",
  "include-footnotes": "false",
  "include-passage-references": "false",
  "include-short-copyright": "false",
  "include-first-verse-numbers": "true",
};

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "anonymous";
}

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(ip) ?? [];
  const recent = bucket.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateBuckets.set(ip, recent);
    return false;
  }
  recent.push(now);
  rateBuckets.set(ip, recent);
  return true;
}

const BOOK_PATTERN = /^[1-3]?\s?[A-Za-z][A-Za-z ]+$/;

type ParsedQuery =
  | {
      ok: true;
      book: string;
      chapter: number;
      verseStart: number;
      verseEnd?: number;
    }
  | { ok: false; status: number; error: string };

function parseQuery(req: NextRequest): ParsedQuery {
  const url = new URL(req.url);
  const book = url.searchParams.get("book")?.trim();
  const chapterRaw = url.searchParams.get("chapter");
  const verseStartRaw = url.searchParams.get("verse_start");
  const verseEndRaw = url.searchParams.get("verse_end");

  if (!book || !BOOK_PATTERN.test(book)) {
    return { ok: false, status: 400, error: "Missing or invalid 'book'." };
  }
  const chapter = Number(chapterRaw);
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 200) {
    return { ok: false, status: 400, error: "Missing or invalid 'chapter'." };
  }
  const verseStart = Number(verseStartRaw);
  if (!Number.isInteger(verseStart) || verseStart < 1 || verseStart > 200) {
    return { ok: false, status: 400, error: "Missing or invalid 'verse_start'." };
  }
  let verseEnd: number | undefined;
  if (verseEndRaw != null && verseEndRaw !== "") {
    const ve = Number(verseEndRaw);
    if (!Number.isInteger(ve) || ve < verseStart || ve > 200) {
      return { ok: false, status: 400, error: "Invalid 'verse_end'." };
    }
    verseEnd = ve;
  }
  return { ok: true, book, chapter, verseStart, verseEnd };
}

function formatReference(q: {
  book: string;
  chapter: number;
  verseStart: number;
  verseEnd?: number;
}): string {
  const base = `${q.book} ${q.chapter}:${q.verseStart}`;
  return q.verseEnd && q.verseEnd !== q.verseStart
    ? `${base}-${q.verseEnd}`
    : base;
}

function cacheKey(reference: string): string {
  return reference.toLowerCase();
}

type EsvApiResponse = {
  canonical?: string;
  passages?: string[];
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const apiKey = process.env.ESV_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ESV proxy not configured (ESV_API_KEY missing)." },
      { status: 401 },
    );
  }

  const parsed = parseQuery(req);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: parsed.status });
  }

  const reference = formatReference(parsed);
  const key = cacheKey(reference);

  const hit = cache.get(key);
  if (hit && hit.expiresAt > Date.now()) {
    return NextResponse.json({
      reference: hit.reference,
      text: hit.text,
      cached: true,
    });
  }

  const ip = clientIp(req);
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      {
        error:
          "Too many requests. Wait a moment and try again — the ESV proxy is rate-limited.",
      },
      { status: 429 },
    );
  }

  const upstreamParams = new URLSearchParams({
    q: reference,
    ...ESV_TEXT_PARAMS,
  });

  let upstream: Response;
  try {
    upstream = await fetch(`${ESV_API_URL}?${upstreamParams.toString()}`, {
      headers: { Authorization: `Token ${apiKey}` },
      cache: "no-store",
    });
  } catch {
    return NextResponse.json(
      { error: "Could not reach the ESV API." },
      { status: 502 },
    );
  }

  if (!upstream.ok) {
    return NextResponse.json(
      { error: `ESV API responded with ${upstream.status}.` },
      { status: 502 },
    );
  }

  let json: EsvApiResponse;
  try {
    json = (await upstream.json()) as EsvApiResponse;
  } catch {
    return NextResponse.json(
      { error: "Malformed response from ESV API." },
      { status: 502 },
    );
  }

  const text = (json.passages ?? []).join("\n").trim();
  if (!text) {
    return NextResponse.json(
      { error: "ESV API returned no passage text for that reference." },
      { status: 502 },
    );
  }

  const canonicalRef = json.canonical?.trim() || reference;
  cache.set(key, {
    reference: canonicalRef,
    text,
    expiresAt: Date.now() + CACHE_TTL_MS,
  });

  return NextResponse.json({
    reference: canonicalRef,
    text,
    cached: false,
  });
}
