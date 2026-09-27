import type { components } from "./schema";

/** Types generated from zephyr-backend's openapi.yaml (`npm run api:types`). */
export type Transaction = components["schemas"]["Transaction"];
export type TransactionStatus = components["schemas"]["TransactionStatus"];
export type InteractiveView = components["schemas"]["InteractiveView"];
export type InteractiveSubmit = components["schemas"]["InteractiveSubmit"];

export const TERMINAL_STATUSES: readonly TransactionStatus[] = ["completed", "refunded", "expired", "error"];

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init: RequestInit = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, init);
  } catch {
    throw new ApiError(0, "network");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new ApiError(res.status, body.error ?? `HTTP ${res.status}`);
  return body as T;
}

/**
 * JSON API behind the interactive pages. Same-origin: in production the pages
 * are served through the anchor's proxy, so `/api/...` reaches the backend.
 */
export function getInteractive(id: string, token: string, base = ""): Promise<InteractiveView> {
  return request(`${base}/api/interactive/${encodeURIComponent(id)}`, {
    headers: { authorization: `Bearer ${token}` },
    cache: "no-store",
  });
}

export function submitInteractive(
  id: string,
  token: string,
  body: InteractiveSubmit,
  base = "",
): Promise<InteractiveView> {
  return request(`${base}/api/interactive/${encodeURIComponent(id)}`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ---- SEP-10 / SEP-24 (used by the reference wallet, against the anchor URL) ----

export async function getChallenge(anchorUrl: string, account: string) {
  return request<{ transaction: string; network_passphrase: string }>(
    `${anchorUrl}/auth?account=${encodeURIComponent(account)}`,
  );
}

export async function exchangeChallenge(anchorUrl: string, signedXdr: string): Promise<string> {
  const { token } = await request<{ token: string }>(`${anchorUrl}/auth`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ transaction: signedXdr }),
  });
  return token;
}

export async function startInteractive(
  anchorUrl: string,
  jwt: string,
  kind: "deposit" | "withdraw",
  body: { asset_code: string; account?: string; lang?: string; withdraw_mode?: "standard" | "escrow" },
) {
  return request<{ type: string; url: string; id: string }>(`${anchorUrl}/sep24/transactions/${kind}/interactive`, {
    method: "POST",
    headers: { authorization: `Bearer ${jwt}`, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

export async function getTransaction(anchorUrl: string, jwt: string, id: string): Promise<Transaction> {
  const { transaction } = await request<{ transaction: Transaction }>(
    `${anchorUrl}/sep24/transaction?id=${encodeURIComponent(id)}`,
    { headers: { authorization: `Bearer ${jwt}` }, cache: "no-store" },
  );
  return transaction;
}

export async function listTransactions(
  anchorUrl: string,
  jwt: string,
  opts: { limit?: number; pagingId?: string } = {},
): Promise<Transaction[]> {
  const q = new URLSearchParams({ asset_code: "USDC", limit: String(opts.limit ?? 20) });
  if (opts.pagingId) q.set("paging_id", opts.pagingId);
  const { transactions } = await request<{ transactions: Transaction[] }>(`${anchorUrl}/sep24/transactions?${q}`, {
    headers: { authorization: `Bearer ${jwt}` },
    cache: "no-store",
  });
  return transactions;
}
