/**
 * Sandbox demo: drives a deposit, an escrow withdrawal and a standard withdrawal
 * through a locally running zephyr-backend (ENABLE_SANDBOX=true, FRONTEND_URL set)
 * and this app (next start on :3000), and saves screenshots to docs/images/.
 *
 * Usage: node scripts/demo-sandbox.mjs   (needs `npx playwright install chromium`)
 */
import { chromium } from "@playwright/test";
import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

const A = "http://localhost:8080";
import { fileURLToPath } from "node:url";
const shotsDir = fileURLToPath(new URL("../docs/images/", import.meta.url));
const shot = (name) => shotsDir + name;
const kp = Keypair.random();

async function jwt() {
  const c = await (await fetch(`${A}/auth?account=${kp.publicKey()}`)).json();
  const tx = TransactionBuilder.fromXDR(c.transaction, c.network_passphrase);
  tx.sign(kp);
  const r = await fetch(`${A}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: tx.toXDR() }),
  });
  return (await r.json()).token;
}
const token = await jwt();
const H = { authorization: `Bearer ${token}`, "content-type": "application/json" };
const start = async (kind, extra = {}) =>
  (
    await fetch(`${A}/sep24/transactions/${kind}/interactive`, {
      method: "POST",
      headers: H,
      body: JSON.stringify({ asset_code: "USDC", ...extra }),
    })
  ).json();
const status = async (id) =>
  (await (await fetch(`${A}/sep24/transaction?id=${id}`, { headers: H })).json()).transaction;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 360, height: 780 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();

async function fill(url, amount, escrow = false, shotName) {
  await page.goto(url);
  await page.getByLabel(/^Amount/).fill(amount);
  await page.getByLabel("Full name").fill("Ada Lovelace");
  await page.getByLabel("Email").fill("ada@example.com");
  if (escrow) await page.getByRole("radio", { name: /Escrow contract/ }).check();
  if (shotName) await page.screenshot({ path: shot(shotName), fullPage: true });
  await page.getByRole("button", { name: "Continue" }).click();
  await page.getByRole("heading", { name: /Transaction status/ }).waitFor();
}

// 1. Deposit through the proxied interactive page.
const dep = await start("deposit");
console.log("interactive URL host:", new URL(dep.url).host, new URL(dep.url).pathname);
await fill(dep.url, "100", false, "deposit-form.png");
await page
  .getByText(/ZEPHYR-/)
  .first()
  .waitFor();
await page.screenshot({ path: shot("deposit-instructions.png"), fullPage: true });
console.log("deposit after form:", (await status(dep.id)).status);
await fetch(`${A}/sandbox/deposits/${dep.id}/fiat-received`, { method: "POST" });
const depDone = await status(dep.id);
console.log("deposit after bank:", depDone.status, "-", depDone.message ?? "");

// 2. Escrow withdrawal through the proxied page + sandbox chain.
const wd = await start("withdraw", { withdraw_mode: "escrow" });
await fill(wd.url, "40", true, "withdraw-escrow-form.png");
await page.getByRole("heading", { name: "Lock your USDC in escrow" }).waitFor();
await page.screenshot({ path: shot("withdraw-escrow-lock.png"), fullPage: true });
await fetch(`${A}/sandbox/withdrawals/${wd.id}/escrow-lock`, { method: "POST" });
const wdDone = await status(wd.id);
console.log("escrow withdrawal:", wdDone.status, "claim:", wdDone.escrow?.claim_tx_hash?.slice(0, 20));

// 3. more_info page through the redirect + proxy.
await page.goto(wdDone.more_info_url);
await page.getByText("Completed").first().waitFor();
await page.screenshot({ path: shot("more-info-completed.png"), fullPage: true });
console.log("more_info final URL path:", new URL(page.url()).pathname);

// 4. Standard withdrawal.
const sw = await start("withdraw");
await fill(sw.url, "25");
await fetch(`${A}/sandbox/withdrawals/${sw.id}/stellar-payment`, { method: "POST" });
console.log("standard withdrawal:", (await status(sw.id)).status);

// 5. Dark theme screenshot of the landing + wallet.
const dark = await browser.newContext({
  viewport: { width: 360, height: 780 },
  deviceScaleFactor: 2,
  colorScheme: "dark",
});
const dp = await dark.newPage();
await dp.goto("http://127.0.0.1:3000/app");
await dp.getByRole("button", { name: "Connect wallet" }).waitFor();
await dp.screenshot({ path: shot("wallet-dark.png"), fullPage: true });

const audit = await (await fetch(`${A}/sandbox/transactions/${wd.id}/audit`)).json();
console.log("audit:", audit.audit.map((a) => `${a.toStatus}(${a.actor})`).join(" -> "));
await browser.close();
