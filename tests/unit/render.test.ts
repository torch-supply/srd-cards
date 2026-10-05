import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { srdDataHash } from "@/lib/srd/data-hash";
import { renderSrdMarkdown } from "@/lib/srd/render";

describe("renderSrdMarkdown", () => {
  it("lays out lists of short terms in columns", () => {
    const html = renderSrdMarkdown(
      "These actions are defined elsewhere in this glossary:\n\n- Attack\n- Dash\n- Disengage",
    );
    expect(html).toContain('<ul class="srd-terms">');
  });

  it("leaves other lists alone", () => {
    expect(renderSrdMarkdown("- Attack\n- Dash")).not.toContain("srd-terms");
    expect(
      renderSrdMarkdown(
        "- A creature that isn’t Tiny or your ally\n- Heavy snow, ice, rubble, or undergrowth\n- A slope of 20 degrees or more",
      ),
    ).not.toContain("srd-terms");
    expect(
      renderSrdMarkdown("- **Attack**\n- Dash\n- Disengage"),
    ).not.toContain("srd-terms");
  });
});

describe("srdDataHash", () => {
  // public/srd/<hash>/ holds rendered HTML cached forever, so a renderer
  // change must change the hash even when the data doesn't.
  it("covers the renderer as well as the data", () => {
    const empty = fs.mkdtempSync(path.join(os.tmpdir(), "srd-hash-"));
    const renderer = fs.readFileSync(
      path.join(process.cwd(), "src", "lib", "srd", "render.ts"),
    );
    const rendererOnly = createHash("sha256")
      .update(renderer)
      .digest("hex")
      .slice(0, 12);
    expect(srdDataHash(empty)).toBe(rendererOnly);
    fs.rmSync(empty, { recursive: true });
  });
});
