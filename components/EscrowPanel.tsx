"use client";

import { fromStroops } from "@/lib/amount";
import type { Transaction } from "@/lib/api/client";
import { type EscrowState, ledgerEta } from "@/lib/escrow";
import { useI18n } from "@/lib/i18n";
import { Alert, Row, Spinner, StatusBadge } from "./ui";

export interface EscrowPanelProps {
  tx: Transaction;
  escrow: EscrowState | null;
  latestLedger: number | null;
  busy: "lock" | "refund" | null;
  error: string | null;
  notice: string | null;
  onLock(): void;
  onRefund(): void;
  now?: Date;
}

/** Escrow withdrawal: lock funds, then follow locked → claimed / refunded, with the refund deadline. */
export function EscrowPanel({
  tx,
  escrow,
  latestLedger,
  busy,
  error,
  notice,
  onLock,
  onRefund,
  now,
}: EscrowPanelProps) {
  const { t } = useI18n();
  const details = tx.escrow;
  if (!details) return <Alert>{t("escrow.notConfigured")}</Alert>;

  const locked = escrow?.status === "Locked";
  const expired = locked && latestLedger !== null && latestLedger >= escrow.expiresLedger;
  const canLock = escrow?.status === "none" && tx.status === "pending_user_transfer_start";
  const stateLabel =
    escrow === null
      ? null
      : escrow.status === "none"
        ? t("escrow.notLocked")
        : escrow.status === "Locked"
          ? t("escrow.locked")
          : escrow.status === "Claimed"
            ? t("escrow.claimed")
            : t("escrow.refundedState");

  return (
    <section aria-labelledby="escrow-heading" className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="escrow-heading" className="text-2xl font-bold">
          {t("escrow.title")}
        </h1>
        <StatusBadge status={tx.status} />
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <dl className="card">
        <Row label={t("status.youSend")}>{`${tx.amount_in ?? "—"} USDC`}</Row>
        <Row label={t("status.youReceive")}>{`${tx.amount_out ?? "—"} USD`}</Row>
        <Row label={t("escrow.statusLabel")}>
          <span data-testid="escrow-state">{stateLabel ?? t("common.loading")}</span>
        </Row>
        {escrow && escrow.status !== "none" ? (
          <Row label={t("escrow.deadline")}>
            {expired
              ? t("escrow.deadlinePassed")
              : t("escrow.deadlineValue", {
                  ledger: escrow.expiresLedger,
                  time:
                    latestLedger === null
                      ? "…"
                      : ledgerEta(escrow.expiresLedger, latestLedger, now).toLocaleString(undefined, {
                          dateStyle: "medium",
                          timeStyle: "short",
                        }),
                })}
          </Row>
        ) : null}
      </dl>

      {escrow === null ? <Spinner /> : null}

      {canLock ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">
            {t("escrow.lockHeading", { amount: details.amount ?? tx.amount_in ?? "" })}
          </h2>
          <p>{t("escrow.lockBody")}</p>
          <button type="button" className="btn-primary" disabled={busy !== null} onClick={onLock}>
            {busy === "lock" ? t("escrow.locking") : t("escrow.lock")}
          </button>
        </div>
      ) : null}

      {expired ? (
        <button type="button" className="btn-primary" disabled={busy !== null} onClick={onRefund}>
          {busy === "refund" ? t("escrow.refunding") : t("escrow.refund")}
        </button>
      ) : null}

      {escrow && escrow.status !== "none" ? (
        <p className="text-sm text-muted">{`${fromStroops(escrow.amount)} USDC · ${details.contract_id}`}</p>
      ) : null}
    </section>
  );
}
