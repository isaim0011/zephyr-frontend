import AxeBuilder from "@axe-core/playwright";
import { expect, type Page, test } from "@playwright/test";

/**
 * Smoke test: the production build, a 360px-wide mobile viewport and a mocked
 * backend (no network). Runs the deposit interactive flow end to end and
 * checks accessibility, including colour contrast, in both themes.
 */

const baseTx = {
  id: "11111111-2222-3333-4444-555555555555",
  kind: "deposit",
  more_info_url: "http://anchor.test/sep24/transaction/more_info?id=x&token=y",
  started_at: "2026-09-27T10:00:00.000Z",
  refunded: false,
  amount_in: null,
  amount_out: null,
  amount_fee: null,
};

const view = (over: Record<string, unknown>, tx: Record<string, unknown>) => ({
  transaction: { ...baseTx, ...tx },
  editable: true,
  lang: "en",
  asset: { code: "USDC", issuer: "GISSUER" },
  limits: { min: "1", max: "10000" },
  fee: { fixed: "0.50", percent: "1" },
  deposit_instructions: null,
  escrow: { enabled: false },
  ...over,
});

async function mockBackend(page: Page) {
  const posts: unknown[] = [];
  await page.route("**/api/interactive/**", async (route) => {
    const req = route.request();
    if (req.method() === "POST") {
      posts.push(req.postDataJSON());
      return route.fulfill({
        json: view(
          {
            editable: false,
            deposit_instructions: {
              bank_name: "Sandbox Bank (not real)",
              account_number: "000123456789",
              reference: "ZEPHYR-11111111",
            },
          },
          { status: "pending_user_transfer_start", amount_in: "100.00", amount_fee: "1.50", amount_out: "98.50" },
        ),
      });
    }
    return route.fulfill({ json: view({}, { status: "incomplete" }) });
  });
  return posts;
}

async function expectAccessible(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"]).analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
}

async function expectNoHorizontalScroll(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}

test("deposit interactive flow works in a 360px webview and is accessible", async ({ page }) => {
  const posts = await mockBackend(page);
  await page.goto(`/sep24/interactive/deposit?transaction_id=${baseTx.id}&token=tok&lang=en`);

  const amount = page.getByLabel("Amount (USD)");
  await expect(amount).toBeVisible();
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);

  await amount.fill("100");
  await expect(page.getByTestId("fee")).toContainText("1.50 USD");
  await expect(page.getByTestId("receive")).toContainText("98.50 USDC");
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  await page.getByRole("button", { name: "Continue" }).click();

  await expect(page.getByRole("heading", { name: "Send your dollars" })).toBeVisible();
  await expect(page.getByText("ZEPHYR-11111111")).toBeVisible();
  await expect(page.getByRole("button", { name: /^Copy/ })).toHaveCount(3);
  expect(posts).toEqual([{ amount: "100", name: "Ada Lovelace", email: "ada@example.com" }]);
  await expectAccessible(page);
  await expectNoHorizontalScroll(page);
});

test("keyboard users can complete the form", async ({ page }) => {
  await mockBackend(page);
  await page.goto(`/sep24/interactive/deposit?transaction_id=${baseTx.id}&token=tok`);
  await page.getByLabel("Amount (USD)").focus();
  await page.keyboard.type("100");
  await page.keyboard.press("Tab");
  await page.keyboard.type("Ada");
  await page.keyboard.press("Tab");
  await page.keyboard.type("ada@example.com");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Send your dollars" })).toBeVisible();
});

test("dark theme and the wallet pages are accessible", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await mockBackend(page);
  await page.goto(`/sep24/interactive/deposit?transaction_id=${baseTx.id}&token=tok`);
  await expect(page.getByLabel("Amount (USD)")).toBeVisible();
  await expectAccessible(page);

  for (const path of ["/", "/app", "/app/history"]) {
    await page.goto(path);
    await expect(page.getByRole("main")).toBeVisible();
    await expectAccessible(page);
    await expectNoHorizontalScroll(page);
  }
});

test("an expired link shows a clear error", async ({ page }) => {
  await page.route("**/api/interactive/**", (route) =>
    route.fulfill({ status: 403, json: { error: "interactive session expired or invalid" } }),
  );
  await page.goto(`/sep24/interactive/withdraw?transaction_id=x&token=old`);
  // Scoped to <main>: Next.js adds its own (empty) route-announcer alert.
  await expect(page.getByRole("main").getByRole("alert")).toContainText("This link has expired");
});
