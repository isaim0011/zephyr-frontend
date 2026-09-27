import type { TransactionStatus } from "@/lib/api/client";

/** Must match TransactionStatus in zephyr-backend/openapi.yaml (the type is generated from it). */
export const TRANSACTION_STATUSES: TransactionStatus[] = [
  "incomplete",
  "pending_user_transfer_start",
  "pending_user_transfer_complete",
  "pending_external",
  "pending_anchor",
  "pending_stellar",
  "pending_trust",
  "pending_user",
  "completed",
  "refunded",
  "expired",
  "no_market",
  "too_small",
  "too_large",
  "error",
];
