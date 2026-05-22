/**
 * /api/esv route tests.
 *
 * Mocks global fetch so we never hit api.esv.org. Covers:
 *   - missing API key → 401
 *   - bad params → 400
 *   - happy path → 200 with reference + text + cached:false
 *   - second call hits cache → cached:true (no upstream fetch)
 *   - rate limit triggers 429 after RATE_LIMIT_MAX hits
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { GET } from "../app/api/esv/route";
import { resetEsvProxyState as _resetEsvProxyStateForTests } from "@/lib/esv/state";

type FetchInit = Parameters<typeof fetch>[1];

function makeReq(query: string, headers: Record<string, string> = {}) {
  const url = `http://localhost/api/esv${query}`;
  // NextRequest is a thin wrapper over Request; the route handler only uses
  // url + headers. A regular Request satisfies the shape we need.
  return new Request(url, {
    headers: { "x-forwarded-for": "10.0.0.1", ...headers },
  }) as unknown as Parameters<typeof GET>[0];
}

function mockEsvFetch(body: object, init: { ok?: boolean; status?: number } = {}) {
  const fn = vi.fn(async (_input: string, _opts?: FetchInit) => {
    return new Response(JSON.stringify(body), {
      status: init.status ?? (init.ok === false ? 502 : 200),
      headers: { "content-type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return fn;
}

beforeEach(() => {
  _resetEsvProxyStateForTests();
  process.env.ESV_API_KEY = "test-key";
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  delete process.env.ESV_API_KEY;
  _resetEsvProxyStateForTests();
});

describe("GET /api/esv", () => {
  it("returns 401 when ESV_API_KEY is missing", async () => {
    delete process.env.ESV_API_KEY;
    const res = await GET(makeReq("?book=Revelation&chapter=21&verse_start=21"));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error).toMatch(/ESV_API_KEY/);
  });

  it("returns 400 when required params are missing", async () => {
    const res = await GET(makeReq("?book=Revelation"));
    expect(res.status).toBe(400);
  });

  it("returns 400 on an invalid book name", async () => {
    const res = await GET(makeReq("?book=%21%21%21&chapter=21&verse_start=21"));
    expect(res.status).toBe(400);
  });

  it("returns 200 with reference + text on the happy path", async () => {
    const fetchMock = mockEsvFetch({
      canonical: "Revelation 21:21",
      passages: ["[21] The twelve gates were twelve pearls..."],
    });
    const res = await GET(
      makeReq("?book=Revelation&chapter=21&verse_start=21"),
    );
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.reference).toBe("Revelation 21:21");
    expect(json.text).toContain("pearls");
    expect(json.cached).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("second call to the same reference hits the cache (no upstream fetch)", async () => {
    const fetchMock = mockEsvFetch({
      canonical: "Revelation 21:21",
      passages: ["[21] ..."],
    });
    await GET(makeReq("?book=Revelation&chapter=21&verse_start=21"));
    const res = await GET(
      makeReq("?book=Revelation&chapter=21&verse_start=21"),
    );
    const json = await res.json();
    expect(json.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns 502 if upstream returns no passage text", async () => {
    mockEsvFetch({ canonical: "Nowhere 1:1", passages: [] });
    const res = await GET(makeReq("?book=Revelation&chapter=21&verse_start=21"));
    expect(res.status).toBe(502);
  });

  it("rate-limits the same IP after the configured threshold", async () => {
    mockEsvFetch({
      canonical: "Revelation 21:21",
      passages: ["[21] ..."],
    });
    // RATE_LIMIT_MAX is 30; vary verse_start so each request misses the cache.
    let lastStatus = 0;
    for (let i = 0; i < 31; i++) {
      const res = await GET(
        makeReq(`?book=Revelation&chapter=21&verse_start=${i + 1}`),
      );
      lastStatus = res.status;
    }
    expect(lastStatus).toBe(429);
  });
});
