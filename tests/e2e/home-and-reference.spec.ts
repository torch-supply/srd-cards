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
  await page.getByLabel("Search", { exact: true }).fill("wish");
  await page.getByRole("link", { name: /^Wish/ }).click();
  await expect(page.getByRole("heading", { name: "Wish" })).toBeVisible();
  await expect(
    page.getByText("Wish is the mightiest spell a mortal can cast."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Add to collection" }).click();
  await page.getByRole("button", { name: "From the reference" }).click();
  await page.getByRole("button", { name: /^Stack 1/ }).click();
  await expect(
    page.getByText(/Added Wish to From the reference/),
  ).toBeVisible();
});

test("reference list search and filters persist in the URL", async ({
  page,
}) => {
  await page.goto("/spells");
  await page.getByRole("combobox", { name: "Level" }).click();
  await page.getByRole("option", { name: "Level 1" }).click();
  await page.getByLabel("Search", { exact: true }).fill("bolt");
  // Clicking a result flushes the debounced query before navigating.
  await page.getByRole("link", { name: /^Guiding Bolt/ }).click();
  await expect(
    page.getByRole("heading", { name: "Guiding Bolt" }),
  ).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/\/spells\?q=bolt&level=1$/);
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("bolt");
  await expect(page.getByRole("combobox", { name: "Level" })).toHaveText(
    "Level 1",
  );

  // A shared link restores the same view.
  await page.goto("/spells?q=bolt&level=1");
  await expect(page.getByLabel("Search", { exact: true })).toHaveValue("bolt");
  await expect(page.getByRole("link", { name: /^Guiding Bolt/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^Fire Bolt/ })).toHaveCount(0);

  // "/" focuses the search; the clear button empties it (filters stay).
  const searchBox = page.getByLabel("Search", { exact: true });
  await searchBox.blur();
  await page.keyboard.press("/");
  await expect(searchBox).toBeFocused();
  await expect(searchBox).toHaveValue("bolt");
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(searchBox).toHaveValue("");
  await expect(searchBox).toBeFocused();
  await expect(page).toHaveURL(/\/spells\?level=1$/);

  // Escape clears the text, then leaves the field.
  await searchBox.fill("magic");
  await searchBox.press("Escape");
  await expect(searchBox).toHaveValue("");
  await expect(searchBox).toBeFocused();
  await searchBox.press("Escape");
  await expect(searchBox).not.toBeFocused();
});

test("monster stat blocks show SRD 5.2.1 values", async ({ page }) => {
  await page.goto("/monsters/aboleth");
  await expect(page.getByText("Large Aberration, Lawful Evil")).toBeVisible();
  await expect(page.getByText("+7 (17)")).toBeVisible();
  await expect(
    page.getByText("XP 5,900, or 7,200 in lair; PB +4"),
  ).toBeVisible();
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

test("pages have SEO metadata, and robots, sitemap, and llms.txt are served", async ({
  page,
  request,
}) => {
  await page.goto("/spells/fireball");
  await expect(page).toHaveTitle("Fireball (Spell) — SRD 5.2.1 · srd.cards");
  const meta = (selector: string) =>
    page.locator(selector).first().getAttribute("content");
  expect(await meta('meta[name="description"]')).toMatch(
    /^Level 3 Evocation spell/,
  );
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    "https://srd.cards/spells/fireball",
  );
  expect(await meta('meta[property="og:url"]')).toBe(
    "https://srd.cards/spells/fireball",
  );
  expect(await meta('meta[property="og:site_name"]')).toBe("srd.cards");
  const image = await meta('meta[property="og:image"]');
  expect(image).toMatch(
    /^https:\/\/srd\.cards\/og\/[0-9a-f]{12}\/spells\/fireball\.png$/,
  );
  const imageResponse = await request.get(new URL(image!).pathname);
  expect(imageResponse.headers()["content-type"]).toBe("image/png");
  const jsonLd = JSON.parse(
    (await page
      .locator('script[type="application/ld+json"]')
      .textContent()) as string,
  );
  expect(jsonLd["@type"]).toBe("BreadcrumbList");
  expect(jsonLd.itemListElement.map((i: { name: string }) => i.name)).toEqual([
    "srd.cards",
    "Spells",
    "Fireball",
  ]);

  expect(await (await request.get("/robots.txt")).text()).toContain(
    "Sitemap: https://srd.cards/sitemap.xml",
  );
  const sitemap = await (await request.get("/sitemap.xml")).text();
  expect(sitemap).toContain("<loc>https://srd.cards/spells/fireball</loc>");
  expect(sitemap).not.toContain("/collections/");
  expect(await (await request.get("/llms.txt")).text()).toContain(
    "[Spells](https://srd.cards/spells)",
  );

  // Collections are private to the browser: keep them out of search results.
  await page.goto("/collections/missing");
  expect(await meta('meta[name="robots"]')).toContain("noindex");
});
