import { expect, test } from "@playwright/test";
import { cardNames, drag, cardsIn, column } from "./helpers";

test("examples are a sandbox: edits reset on reload until saved as a copy", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: /\(example\)/ })).toHaveCount(3);
  await page.getByRole("link", { name: "Examples", exact: true }).click();
  await page.getByRole("link", { name: /The Old Mine \(example\)/ }).click();
  await page.waitForURL("/examples/the-old-mine");
  await expect
    .poll(() => cardNames(page, "1. Mine entrance"))
    .toEqual(["Goblin Warrior", "Wolf"]);

  // Move a card: allowed, but not stored.
  await drag(
    page,
    cardsIn(page, "1. Mine entrance").first(),
    column(page, "2. Collapsed tunnel"),
  );
  await expect
    .poll(() => cardNames(page, "1. Mine entrance"))
    .toEqual(["Wolf"]);
  await page.reload();
  await expect
    .poll(() => cardNames(page, "1. Mine entrance"))
    .toEqual(["Goblin Warrior", "Wolf"]);
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).filter((k) => k.startsWith("srdcards")),
    ),
  ).toEqual([]);

  // Save a copy: it becomes a regular collection, including the edit.
  await drag(
    page,
    cardsIn(page, "1. Mine entrance").first(),
    column(page, "2. Collapsed tunnel"),
  );
  await page.getByRole("button", { name: /Save a copy/ }).click();
  await page.waitForURL(/\/collections\//);
  await expect
    .poll(() => cardNames(page, "1. Mine entrance"))
    .toEqual(["Wolf"]);
  await expect(page.getByTestId("save-state")).toBeVisible();

  await page.goto("/");
  await expect(
    page.getByRole("link", { name: /The Old Mine \(example\)/ }),
  ).toHaveCount(1);
  await expect(page.getByText("See the example collections")).toBeVisible();
  await expect(page.getByText("See more examples")).toHaveCount(0);
});

test("examples index lists every example", async ({ page }) => {
  await page.goto("/examples");
  await expect(
    page.getByRole("heading", { name: "Example collections" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /Dungeon Crawl Rules/ }).click();
  await expect
    .poll(() => cardNames(page, "Resting"))
    .toEqual(["Short Rest", "Long Rest"]);
});

test("the home intro and the header link to the examples", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See examples" }).click();
  await page.waitForURL("/examples");
  await page.goto("/about");
  await page.getByRole("link", { name: "Examples", exact: true }).click();
  await page.waitForURL("/examples");
});

test("the header fits a 360px screen without horizontal scroll", async ({
  page,
}) => {
  await page.setViewportSize({ width: 360, height: 700 });
  // "/magic-items" shows the longest label in the Browse SRD menu.
  for (const path of ["/", "/magic-items", "/examples"]) {
    await page.goto(path);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(360);
  }
});

test("the search panel starts closed on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 800 });
  await page.goto("/examples/adventuring-party");
  await expect(
    page.getByRole("button", { name: "Show browser" }),
  ).toBeVisible();
  await expect(page.getByLabel("SRD browser")).toHaveCount(0);

  await page.setViewportSize({ width: 1280, height: 800 });
  await page.reload();
  await expect(page.getByLabel("SRD browser")).toBeVisible();
});
