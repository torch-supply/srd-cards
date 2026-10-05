import { expect, type Locator, type Page } from "@playwright/test";

/** Creates a collection from the home page and lands on its board (with one empty stack). */
export async function createCollection(page: Page, name: string) {
  await page.goto("/");
  await page.getByRole("button", { name: "New collection" }).first().click();
  await page.getByLabel("Name").fill(name);
  await page.getByRole("button", { name: "Create" }).click();
  await page.waitForURL(/\/collections\//);
  await expect(
    page.getByRole("button", { name: "Collection name" }),
  ).toHaveText(name);
}

export async function search(page: Page, query: string) {
  await page.getByPlaceholder(/Search the SRD/).fill(query);
  await expect(page.getByText(/result/).first()).toBeVisible();
}

export function column(page: Page, name: string): Locator {
  return page.getByRole("region", { name });
}

export function cardsIn(page: Page, stackName: string): Locator {
  return column(page, stackName).locator("article");
}

export async function cardNames(page: Page, stackName: string) {
  return cardsIn(page, stackName).evaluateAll((els) =>
    els.map((e) => e.getAttribute("aria-label")),
  );
}

/**
 * Drags with real pointer moves (dnd-kit needs intermediate events; Playwright's
 * dragTo is unreliable with it).
 */
export async function drag(
  page: Page,
  from: Locator,
  /** A drop target, or a page point (e.g. empty board space). */
  to: Locator | { x: number; y: number },
  opts: { offsetY?: number } = {},
) {
  const a = (await from.boundingBox())!;
  let target = to as { x: number; y: number };
  if ("boundingBox" in to) {
    const b = (await to.boundingBox())!;
    target = { x: b.x + b.width / 2, y: b.y + (opts.offsetY ?? b.height / 2) };
  }
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(a.x + a.width / 2 + 10, a.y + a.height / 2 + 10, {
    steps: 5,
  });
  await page.mouse.move(target.x, target.y, { steps: 15 });
  await page.waitForTimeout(150);
  await page.mouse.up();
  await page.waitForTimeout(150);
}

/** Waits until the autosave indicator says "Saved". */
export async function waitForSave(page: Page) {
  await expect(page.getByTestId("save-state")).toHaveText("Saved", {
    timeout: 5000,
  });
}
