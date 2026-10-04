import { SCHEMA_VERSION } from "@/lib/model/core";

type Migration = (data: Record<string, unknown>) => Record<string, unknown>;

/** MIGRATIONS[n] upgrades a document from schemaVersion n to n + 1. */
const MIGRATIONS: Record<number, Migration> = {};

export type MigrateResult =
  | { status: "ok"; data: Record<string, unknown> }
  | { status: "newer"; data: Record<string, unknown> };

export function migrate(input: unknown): MigrateResult {
  if (typeof input !== "object" || input === null)
    throw new Error("Not an object");
  let data = input as Record<string, unknown>;
  let version = typeof data.schemaVersion === "number" ? data.schemaVersion : 1;
  if (version > SCHEMA_VERSION) return { status: "newer", data };
  while (version < SCHEMA_VERSION) {
    const step = MIGRATIONS[version];
    if (!step) throw new Error(`No migration from schema version ${version}`);
    data = { ...step(data), schemaVersion: version + 1 };
    version++;
  }
  return { status: "ok", data };
}
