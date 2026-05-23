/**
 * Tests for prompt assembly + citation marker extraction.
 */

import { describe, expect, it } from "vitest";

import { assemblePrompt, extractCitedIds } from "@/lib/qa";
import type { GroundedDescriptor } from "@/lib/qa";

const descriptor: GroundedDescriptor = {
  id: "desc-x",
  tier: "symbolic",
  temporal_phase: "final",
  statement: "The gates are pearls.",
  symbolic_referent: "value & purity",
  citations: [
    {
      id: "cit-x",
      source_type: "scripture",
      book: "Revelation",
      chapter: 21,
      verse_start: 21,
      verse_end: null,
    },
  ],
};

describe("assemblePrompt", () => {
  it("includes the system body verbatim", () => {
    const result = assemblePrompt({
      systemBody: "SYSTEM BODY",
      question: "what are the gates?",
      retrieved: [descriptor],
    });
    expect(result.system).toBe("SYSTEM BODY");
  });

  it("emits a refusal hint when retrieved is empty", () => {
    const result = assemblePrompt({
      systemBody: "SYS",
      question: "anything",
      retrieved: [],
    });
    expect(result.messages[0].content).toContain("refuse per the grounding contract");
  });

  it("serializes the descriptor id, tier, statement, and citation", () => {
    const result = assemblePrompt({
      systemBody: "SYS",
      question: "Q",
      retrieved: [descriptor],
    });
    const content = result.messages[0].content;
    expect(content).toContain("id: desc-x");
    expect(content).toContain("tier: symbolic");
    expect(content).toContain("The gates are pearls.");
    expect(content).toContain("symbolic_referent: value & purity");
    expect(content).toContain("Scripture Revelation 21:21");
  });
});

describe("extractCitedIds", () => {
  it("returns IDs from inline markers", () => {
    expect(
      extractCitedIds("Plain prose [descriptor:abc-1] more [descriptor:def-2]."),
    ).toEqual(["abc-1", "def-2"]);
  });

  it("deduplicates repeated IDs", () => {
    expect(
      extractCitedIds("[descriptor:x] and again [descriptor:x]"),
    ).toEqual(["x"]);
  });

  it("returns an empty list when no markers are present", () => {
    expect(extractCitedIds("Just prose, no markers.")).toEqual([]);
  });

  it("does not match malformed markers", () => {
    expect(extractCitedIds("[descriptor:] [descriptor:bad space]")).toEqual([]);
  });
});
