import fs from "node:fs";
import { expect, test } from "@playwright/test";
import { cardNames, createCollection, search, waitForSave } from "./helpers";

test("export, delete, and re-import a collection", async ({ page }) => {
  await createCollection(page, "Backup me");
  await search(page, "aboleth");
  await page.getByRole("button", { name: /^Add Aboleth/ }).click();
  await waitForSave(page);

  await page.getByRole("button", { name: "Collection actions" }).click();
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("menuitem", { name: "Export JSON" }).click();
  const file = await (await downloadPromise).path();
  const json = JSON.parse(fs.readFileSync(file, "utf8"));
  expect(json).toMatchObject({ app: "srd.cards", format: 1 });

  await page.getByRole("button", { name: "Collection actions" }).click();
  await page.getByRole("menuitem", { name: /Delete collection/ }).click();
  await page.getByRole("button", { name: "Delete" }).click();
  await page.waitForURL("/");
  await expect(page.getByRole("link", { name: /Backup me/ })).toHaveCount(0);

  await page.getByRole("button", { name: "Import or export" }).click();
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("menuitem", { name: /Import from file/ }).click();
  await (await chooser).setFiles(file);
  await page.getByRole("link", { name: /Backup me/ }).click();
  await expect.poll(() => cardNames(page, "Stack 1")).toEqual(["Aboleth"]);
});

test("reference pages render and add to a collection", async ({ page }) => {
  await createCollection(page, "From the reference");
  await page.goto("/spells");
  await page.getByLabel("Search").fill("wish");
  await page.getByRole("link", { name: /^Wish/ }).click();
  await expect(page.getByRole("heading", { name: "Wish" })).toBeVisible();
  await expect(page.getByText("Wish is the mightiest spell a mortal can cast.")).toBeVisible();

  await page.getByRole("button", { name: "Add to collection" }).click();
  await page.getByRole("button", { name: "From the reference" }).click();
  await page.getByRole("button", { name: /^Stack 1/ }).click();
  await expect(page.getByText(/Added Wish to From the reference/)).toBeVisible();
});

test("monster stat blocks show SRD 5.2.1 values", async ({ page }) => {
  await page.goto("/monsters/aboleth");
  await expect(page.getByText("Large Aberration, Lawful Evil")).toBeVisible();
  await expect(page.getByText("+7 (17)")).toBeVisible();
  await expect(page.getByText("XP 5,900, or 7,200 in lair; PB +4")).toBeVisible();
});

test("dark mode toggle", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Theme" }).click();
  await page.getByRole("menuitemradio", { name: "Dark" }).click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("footer shows the SRD 5.2.1 attribution", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("footer")).toContainText(
    "This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC",
  );
});
