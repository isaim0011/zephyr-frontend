/**
 * Exact decimal arithmetic for amounts (7 decimal places), backed by BigInt.
 * Mirrors zephyr-backend's src/lib/amount.ts so the fee shown in the form is
 * exactly the fee the anchor charges. Never use JavaScript floats for money.
 */
const SCALE = 7;
const FACTOR = 10n ** BigInt(SCALE);
const AMOUNT_RE = /^\d+(\.\d{1,7})?$/;

export function isValidAmount(value: string): boolean {
  return AMOUNT_RE.test(value);
}

/** Parse a decimal string into integer stroops. Throws on invalid input. */
export function toStroops(value: string): bigint {
  if (!isValidAmount(value)) throw new Error(`Invalid amount: ${value}`);
  const [whole, frac = ""] = value.split(".");
  return BigInt(whole!) * FACTOR + BigInt(frac.padEnd(SCALE, "0"));
}

/** Format stroops as a decimal string, trailing zeros trimmed (at least 2 dp). */
export function fromStroops(stroops: bigint): string {
  const negative = stroops < 0n;
  const abs = negative ? -stroops : stroops;
  const whole = abs / FACTOR;
  let frac = (abs % FACTOR).toString().padStart(SCALE, "0").replace(/0+$/, "");
  if (frac.length < 2) frac = frac.padEnd(2, "0");
  return `${negative ? "-" : ""}${whole}.${frac}`;
}

function roundTo(stroops: bigint, decimals: number): bigint {
  const unit = 10n ** BigInt(SCALE - decimals);
  return ((stroops + unit / 2n) / unit) * unit;
}

/** A percentage string ("1", "0.3725") as an integer scaled by 10^4. */
function percentScaled(percent: string): bigint {
  if (!/^\d+(\.\d{1,4})?$/.test(percent)) throw new Error(`Invalid percent: ${percent}`);
  const [whole, frac = ""] = percent.split(".");
  return BigInt(whole!) * 10_000n + BigInt(frac.padEnd(4, "0"));
}

/** fee = fixed + amount * percent / 100, rounded half-up to cents (same as the backend). */
export function calculateFee(amount: string, fixed: string, percent: string): string {
  const variable = (toStroops(amount) * percentScaled(percent)) / 1_000_000n;
  return fromStroops(roundTo(toStroops(fixed) + variable, 2));
}

/** The fee and what the user receives, or null if `amount` isn't a valid amount yet. */
export function quote(amount: string, fee: { fixed: string; percent: string }) {
  if (!isValidAmount(amount)) return null;
  const amountFee = calculateFee(amount, fee.fixed, fee.percent);
  const receive = toStroops(amount) - toStroops(amountFee);
  return { fee: amountFee, receive: fromStroops(receive > 0n ? receive : 0n), coversFee: receive > 0n };
}

export function compare(a: string, b: string): -1 | 0 | 1 {
  const x = toStroops(a);
  const y = toStroops(b);
  return x < y ? -1 : x > y ? 1 : 0;
}
