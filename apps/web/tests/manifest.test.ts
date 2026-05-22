import { describe, expect, it } from "vitest";

import {
  assertSupportedSchema,
  SUPPORTED_SCHEMA_MAJOR,
  UnsupportedSchemaError,
} from "@/lib/data/manifest";
import type { Manifest } from "@/lib/data/types";

function buildManifest(version: string): Manifest {
  return {
    schema_version: version,
    generated_at: "2026-05-21T00:00:00Z",
    counts: { entities: 0, descriptors: 0, citations: 0, relations: 0 },
    entity_files: [],
  };
}

describe("assertSupportedSchema", () => {
  it("accepts the supported major version", () => {
    expect(() =>
      assertSupportedSchema(buildManifest(`${SUPPORTED_SCHEMA_MAJOR}.1.4`)),
    ).not.toThrow();
  });

  it("rejects a higher major version with UnsupportedSchemaError", () => {
    const nextMajor = SUPPORTED_SCHEMA_MAJOR + 1;
    expect(() =>
      assertSupportedSchema(buildManifest(`${nextMajor}.0.0`)),
    ).toThrow(UnsupportedSchemaError);
  });

  it("rejects a malformed version string with UnsupportedSchemaError", () => {
    expect(() => assertSupportedSchema(buildManifest("not-a-version"))).toThrow(
      UnsupportedSchemaError,
    );
  });

  it("exposes the offending version on the error", () => {
    try {
      assertSupportedSchema(buildManifest("9.9.9"));
      throw new Error("should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(UnsupportedSchemaError);
      expect((err as UnsupportedSchemaError).manifestVersion).toBe("9.9.9");
      expect((err as UnsupportedSchemaError).supportedMajor).toBe(
        SUPPORTED_SCHEMA_MAJOR,
      );
    }
  });
});
