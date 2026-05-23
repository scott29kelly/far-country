/**
 * Tests for inline citation marker parsing.
 *
 * `parseMarkers` is a pure function over the model output text. The chat
 * UI uses it to interleave plain text with clickable citation pills.
 * `markerOrdinals` numbers cited descriptors in first-appearance order so
 * the same descriptor cited twice shares one number.
 *
 * Markers whose IDs are not in the cited set must be hidden — the
 * orchestrator already strips phantoms, but the renderer's defense in
 * depth needs explicit coverage too.
 */

import { describe, expect, it } from "vitest";

import { markerOrdinals, parseMarkers } from "@/lib/ui/ask/marker";

describe("parseMarkers", () => {
  it("returns a single text segment when there are no markers", () => {
    expect(parseMarkers("Heaven is described as a city.")).toEqual([
      { kind: "text", text: "Heaven is described as a city." },
    ]);
  });

  it("returns a single marker segment when the text is just a marker", () => {
    expect(parseMarkers("[descriptor:desc-x]")).toEqual([
      { kind: "marker", descriptorId: "desc-x" },
    ]);
  });

  it("interleaves text and markers", () => {
    const segments = parseMarkers(
      "Streets of gold [descriptor:desc-gold] symbolize purity [descriptor:desc-purity].",
    );
    expect(segments).toEqual([
      { kind: "text", text: "Streets of gold " },
      { kind: "marker", descriptorId: "desc-gold" },
      { kind: "text", text: " symbolize purity " },
      { kind: "marker", descriptorId: "desc-purity" },
      { kind: "text", text: "." },
    ]);
  });

  it("accepts dashes and underscores in IDs", () => {
    const segments = parseMarkers("Cite [descriptor:desc_with-mixed].");
    expect(segments).toEqual([
      { kind: "text", text: "Cite " },
      { kind: "marker", descriptorId: "desc_with-mixed" },
      { kind: "text", text: "." },
    ]);
  });

  it("rejects malformed markers (no closing bracket)", () => {
    const segments = parseMarkers("Cite [descriptor:desc-x oops");
    expect(segments).toEqual([
      { kind: "text", text: "Cite [descriptor:desc-x oops" },
    ]);
  });

  it("is callable repeatedly without leaking regex state", () => {
    const text = "A [descriptor:a] B [descriptor:b].";
    const first = parseMarkers(text);
    const second = parseMarkers(text);
    expect(first).toEqual(second);
  });
});

describe("markerOrdinals", () => {
  it("numbers descriptors in first-appearance order", () => {
    const text =
      "First [descriptor:desc-b] then [descriptor:desc-a] then again [descriptor:desc-b].";
    const known = new Set(["desc-a", "desc-b"]);
    const ord = markerOrdinals(text, known);
    expect(ord.get("desc-b")).toBe(1);
    expect(ord.get("desc-a")).toBe(2);
    expect(ord.size).toBe(2);
  });

  it("skips IDs not in the known set", () => {
    const text = "[descriptor:phantom] [descriptor:real]";
    const ord = markerOrdinals(text, new Set(["real"]));
    expect(ord.has("phantom")).toBe(false);
    expect(ord.get("real")).toBe(1);
  });

  it("returns an empty map when no markers are present", () => {
    const ord = markerOrdinals("Plain text.", new Set(["desc-a"]));
    expect(ord.size).toBe(0);
  });
});
