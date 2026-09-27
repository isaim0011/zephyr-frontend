import type { InteractiveView, Transaction } from "@/lib/api/client";

export function tx(over: Partial<Transaction> = {}): Transaction {
  return {
    id: "11111111-2222-3333-4444-555555555555",
    kind: "deposit",
    status: "incomplete",
    more_info_url: "http://localhost:8080/sep24/transaction/more_info?id=x&token=y",
    started_at: "2026-09-27T10:00:00.000Z",
    refunded: false,
    amount_in: null,
    amount_out: null,
    amount_fee: null,
    ...over,
  } as Transaction;
}

export function view(over: Partial<InteractiveView> = {}, txOver: Partial<Transaction> = {}): InteractiveView {
  return {
    transaction: tx(txOver),
    editable: true,
    lang: "en",
    asset: { code: "USDC", issuer: "GISSUER" },
    limits: { min: "1", max: "10000" },
    fee: { fixed: "0.50", percent: "1" },
    deposit_instructions: null,
    escrow: { enabled: false },
    ...over,
  } as InteractiveView;
}
