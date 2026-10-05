/**
 * Content hashes naming public/srd/<hash>/ and public/og/<hash>/, for app
 * code. Production builds bake them in (next.config.ts `env`). Dev hashes on
 * each call, so a running server picks up `pnpm srd:import`.
 *
 * The hash modules are required only in dev, so production bundles never see
 * them: their file reads make the build trace (and ship with the server) the
 * whole project, public/ included.
 */
import type * as DataHash from "./srd/data-hash";
import type * as OgHash from "./og/hash";

export function srdHash(): string {
  if (process.env.NODE_ENV === "production") return process.env.SRD_DATA_HASH!;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only, see above
  return (require("./srd/data-hash") as typeof DataHash).srdDataHash();
}

export function ogHash(): string {
  if (process.env.NODE_ENV === "production") return process.env.OG_HASH!;
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- dev-only, see above
  return (require("./og/hash") as typeof OgHash).ogHash();
}
