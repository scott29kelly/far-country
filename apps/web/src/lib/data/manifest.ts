/**
 * Manifest schema-version check.
 *
 * Per the Phase 2 spec §4 acceptance criterion 8: a schema-version
 * mismatch must REFUSE TO START THE APP (loud failure), not silently
 * render stale data. Consumers call `assertSupportedSchema(manifest)`
 * after loading the manifest.
 *
 * Semver: same major version means consumer-compatible; differing major
 * means breaking change and the app must refuse to render.
 */

import type { Manifest } from "./types";

/**
 * The canonical schema version this build was authored against. When the
 * pipeline bumps `SCHEMA_VERSION` in `pipeline/src/far_country/export/canonical.py`
 * in a breaking way, bump the major here in the same PR.
 */
export const SUPPORTED_SCHEMA_MAJOR = 0;

export class UnsupportedSchemaError extends Error {
  readonly manifestVersion: string;
  readonly supportedMajor: number;

  constructor(manifestVersion: string, supportedMajor: number) {
    super(
      `Canonical export schema_version ${manifestVersion} is not supported by ` +
        `this web build (expected major ${supportedMajor}.x.x). ` +
        `Re-deploy the web app or re-export the canonical dataset.`,
    );
    this.name = "UnsupportedSchemaError";
    this.manifestVersion = manifestVersion;
    this.supportedMajor = supportedMajor;
  }
}

function parseMajor(version: string): number {
  const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!match) {
    throw new UnsupportedSchemaError(version, SUPPORTED_SCHEMA_MAJOR);
  }
  return Number(match[1]);
}

/**
 * Throws `UnsupportedSchemaError` if the manifest's schema_version's major
 * doesn't match `SUPPORTED_SCHEMA_MAJOR`. Otherwise returns silently.
 */
export function assertSupportedSchema(manifest: Manifest): void {
  const major = parseMajor(manifest.schema_version);
  if (major !== SUPPORTED_SCHEMA_MAJOR) {
    throw new UnsupportedSchemaError(
      manifest.schema_version,
      SUPPORTED_SCHEMA_MAJOR,
    );
  }
}
