import type { NextConfig } from "next";
import { PHASE_PRODUCTION_BUILD } from "next/constants";
import { ogHash } from "./src/lib/og/hash";
import { srdDataHash } from "./src/lib/srd/data-hash";

export default function nextConfig(phase: string): NextConfig {
  return {
    reactCompiler: true,
    // Production servers (Cloudflare Workers) have no src/ to hash at request
    // time, so bake the hashes in; dev hashes live to pick up `pnpm srd:import`.
    env:
      phase === PHASE_PRODUCTION_BUILD
        ? { SRD_DATA_HASH: srdDataHash(), OG_HASH: ogHash() }
        : {},
    async headers() {
      return [
        ...["/srd/:path*", "/og/:path*"].map((source) => ({
          source,
          headers: [
            {
              key: "Cache-Control",
              value: "public, max-age=31536000, immutable",
            },
          ],
        })),
      ];
    },
  };
}
