"use client";

import type { InteractiveView } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";
import { CopyField } from "./CopyField";
import { Alert, Row, StatusBadge } from "./ui";

/** Status of a deposit or withdrawal, with the next step the user has to take. */
export function StatusView({
  transaction: tx,
  depositInstructions,
  polling,
}: {
  transaction: InteractiveView["transaction"];
  depositInstructions: InteractiveView["deposit_instructions"];
  polling?: boolean;
}) {
  const { t } = useI18n();
  const deposit = tx.kind === "deposit";
  const unitIn = deposit ? t("common.usd") : t("common.usdc");
  const unitOut = deposit ? t("common.usdc") : t("common.usd");
  const waiting = tx.status === "pending_user_transfer_start";

  return (
    <section aria-labelledby="status-heading" className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 id="status-heading" className="text-xl font-bold">
          {t("status.title")}
        </h1>
        <StatusBadge status={tx.status} />
      </div>

      <dl className="card">
        {tx.amount_in ? <Row label={t("status.youSend")}>{`${tx.amount_in} ${unitIn}`}</Row> : null}
        {tx.amount_fee ? <Row label={t("status.fee")}>{`${tx.amount_fee} ${unitIn}`}</Row> : null}
        {tx.amount_out ? <Row label={t("status.youReceive")}>{`${tx.amount_out} ${unitOut}`}</Row> : null}
      </dl>

      {waiting && deposit && depositInstructions ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("status.depositHeading")}</h2>
          <p>{t("status.depositBody")}</p>
          <div className="card">
            {Object.entries(depositInstructions).map(([key, value]) => (
              <CopyField key={key} label={humanize(key)} value={value} />
            ))}
          </div>
        </div>
      ) : null}

      {waiting && !deposit && tx.withdraw_mode === "escrow" && tx.escrow ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("status.escrowHeading")}</h2>
          <p>{t("status.escrowBody", { amount: tx.amount_in ?? "" })}</p>
          <div className="card">
            <CopyField label={t("status.escrowContract")} value={tx.escrow.contract_id} />
            <CopyField label={t("status.escrowTxId")} value={tx.escrow.tx_id} />
          </div>
        </div>
      ) : null}

      {waiting && !deposit && tx.withdraw_mode !== "escrow" && tx.withdraw_anchor_account ? (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{t("status.withdrawHeading")}</h2>
          <p>{t("status.withdrawBody", { amount: tx.amount_in ?? "" })}</p>
          <div className="card">
            <CopyField label={t("status.anchorAccount")} value={tx.withdraw_anchor_account} />
            {tx.withdraw_memo ? <CopyField label={t("status.memo")} value={tx.withdraw_memo} /> : null}
          </div>
        </div>
      ) : null}

      {tx.status === "completed" ? (
        <Alert kind="success">{deposit ? t("status.completedDeposit") : t("status.completedWithdraw")}</Alert>
      ) : null}
      {tx.status === "refunded" ? (
        <Alert kind="info">
          {t("status.refundedBody", { amount: tx.refunds?.amount_refunded ?? tx.amount_in ?? "" })}
        </Alert>
      ) : null}
      {tx.status === "error" ? <Alert>{t("status.errorBody")}</Alert> : null}
      {tx.message && tx.status !== "error" ? (
        <p>
          <span className="text-muted">{t("status.message")}: </span>
          {tx.message}
        </p>
      ) : null}

      {polling ? <p className="text-sm text-muted">{t("status.autoRefresh")}</p> : null}
      <p className="text-sm text-muted">
        {t("common.close")} {t("common.reference", { id: tx.id })}
      </p>
    </section>
  );
}

function humanize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}
