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

test("dropping outside a stack returns the item", async ({ page }) => {
  await createCollection(page, "E2E Cancel");
  await search(page, "fireball");
  await page.getByRole("button", { name: /^Add Fireball/ }).click();
  await page.getByRole("button", { name: "Add stack" }).click();
  await expect(column(page, "Stack 2")).toBeVisible();
  const board = (await page.getByTestId("board").boundingBox())!;
  const empty = {
    x: board.x + board.width - 40,
    y: board.y + board.height - 40,
  };

  // A browser entry dropped on empty board space isn't added.
  await search(page, "magic missile");
  await drag(
    page,
    page.getByRole("button", { name: /^Magic Missile/ }).first(),
    empty,
  );
  await expect.poll(() => cardNames(page, "Stack 1")).toEqual(["Fireball"]);
  await expect.poll(() => cardNames(page, "Stack 2")).toEqual([]);

  // A card dragged over another stack, then dropped outside, goes back to its stack.
  const handle = cardsIn(page, "Stack 1").first().locator("button").first();
  const a = (await handle.boundingBox())!;
  const s2 = (await column(page, "Stack 2").boundingBox())!;
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  await page.mouse.move(s2.x + s2.width / 2, s2.y + s2.height / 2, {
    steps: 15,
  });
  await expect.poll(() => cardNames(page, "Stack 2")).toEqual(["Fireball"]);
  await page.mouse.move(empty.x, empty.y, { steps: 15 });
  await page.mouse.up();
  await expect.poll(() => cardNames(page, "Stack 1")).toEqual(["Fireball"]);
  await expect.poll(() => cardNames(page, "Stack 2")).toEqual([]);
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
