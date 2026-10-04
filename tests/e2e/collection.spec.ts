import { expect, test } from "@playwright/test";
import {
  cardNames,
  cardsIn,
  column,
  createCollection,
  drag,
  search,
  waitForSave,
} from "./helpers";

test("build a collection: add, reorder, move, edit, and persist across reload", async ({
  page,
}) => {
  await createCollection(page, "E2E Campaign");

  // Add cards with the + button.
  await search(page, "fireball");
  await page.getByRole("button", { name: /^Add Fireball/ }).click();
  await search(page, "goblin warrior");
  await page.getByRole("button", { name: /^Add Goblin Warrior/ }).click();
  await page.getByRole("button", { name: /^Add Goblin Warrior/ }).click(); // merges into ×2
  await expect
    .poll(() => cardNames(page, "Stack 1"))
    .toEqual(["Fireball", "Goblin Warrior"]);
  await expect(cardsIn(page, "Stack 1").nth(1)).toContainText("×2");

  // Drag an entry from the browser into the stack, above Fireball.
  await search(page, "magic missile");
  const result = page.getByRole("button", { name: /^Magic Missile/ }).first();
  await drag(page, result, cardsIn(page, "Stack 1").first(), { offsetY: 5 });
  await expect
    .poll(() => cardNames(page, "Stack 1"))
    .toEqual(["Magic Missile", "Fireball", "Goblin Warrior"]);

  // Reorder within the stack: drag Goblin Warrior to the top.
  await drag(
    page,
    cardsIn(page, "Stack 1").nth(2).locator("button").first(),
    cardsIn(page, "Stack 1").first(),
    { offsetY: 5 },
  );
  await expect
    .poll(() => cardNames(page, "Stack 1"))
    .toEqual(["Goblin Warrior", "Magic Missile", "Fireball"]);

  // Add a second stack and move Fireball into it.
  await page.getByRole("button", { name: "Add stack" }).click();
  await expect(column(page, "Stack 2")).toBeVisible();
  await drag(
    page,
    cardsIn(page, "Stack 1").nth(2).locator("button").first(),
    column(page, "Stack 2"),
  );
  await expect.poll(() => cardNames(page, "Stack 2")).toEqual(["Fireball"]);
  await expect
    .poll(() => cardNames(page, "Stack 1"))
    .toEqual(["Goblin Warrior", "Magic Missile"]);

  // Expand a monster card, set a quantity and a note.
  const goblin = cardsIn(page, "Stack 1").first();
  await goblin.getByRole("button", { name: "Expand card" }).click();
  await expect(goblin.getByText("Initiative")).toBeVisible();
  await goblin.getByRole("button", { name: "Increase quantity" }).click();
  await goblin.getByLabel("Card notes").fill("Hiding behind the cart");
  await waitForSave(page);

  // Reload: everything is still there.
  await page.reload();
  await expect
    .poll(() => cardNames(page, "Stack 1"))
    .toEqual(["Goblin Warrior", "Magic Missile"]);
  await expect.poll(() => cardNames(page, "Stack 2")).toEqual(["Fireball"]);
  await expect(cardsIn(page, "Stack 1").first()).toContainText("×3");
  await expect(page.getByLabel("Card notes")).toHaveValue(
    "Hiding behind the cart",
  );
});

test("undo and redo a removal", async ({ page }) => {
  await createCollection(page, "Undo test");
  await search(page, "shield");
  await page
    .getByRole("button", { name: /^Add Shield/ })
    .first()
    .click();
  await expect(cardsIn(page, "Stack 1")).toHaveCount(1);
  await cardsIn(page, "Stack 1").first().hover();
  await page.getByRole("button", { name: /^Actions for Shield/ }).click();
  await page.getByRole("menuitem", { name: "Remove" }).click();
  await expect(cardsIn(page, "Stack 1")).toHaveCount(0);
  await page.getByRole("button", { name: "Undo (⌘Z)" }).click();
  await expect(cardsIn(page, "Stack 1")).toHaveCount(1);
  await page.getByRole("button", { name: "Redo (⇧⌘Z)" }).click();
  await expect(cardsIn(page, "Stack 1")).toHaveCount(0);
});

test("custom cards render markdown", async ({ page }) => {
  await createCollection(page, "Homebrew");
  await page.getByRole("button", { name: "Custom card" }).click();
  await page.getByLabel("Title", { exact: true }).fill("Barkeep Mira");
  await page.getByLabel("Card text").fill("**Knows** the *secret* door.");
  await page.getByRole("button", { name: "Add card" }).click();
  const card = cardsIn(page, "Stack 1").first();
  await expect(card).toHaveAttribute("aria-label", "Barkeep Mira");
  await expect(card.locator("strong", { hasText: "Knows" })).toBeVisible();
});
