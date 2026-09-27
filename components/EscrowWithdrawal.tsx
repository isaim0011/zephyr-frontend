"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getTransaction, type Transaction } from "@/lib/api/client";
import { appConfig } from "@/lib/config";
import { type EscrowState, getEscrowState, latestLedger, lockFunds, refundEscrow } from "@/lib/escrow";
import { useI18n } from "@/lib/i18n";
import { EscrowPanel } from "./EscrowPanel";
import { useSession } from "./SessionProvider";
import { Alert, Spinner } from "./ui";

/** /app/escrow?id=<transaction id>: lock, follow and (if needed) refund an escrow withdrawal. */
export function EscrowWithdrawal() {
  const { t } = useI18n();
  const id = useSearchParams().get("id");
  const session = useSession();
  const [tx, setTx] = useState<Transaction | null>(null);
  const [escrow, setEscrow] = useState<EscrowState | null>(null);
  const [ledger, setLedger] = useState<number | null>(null);
  const [busy, setBusy] = useState<"lock" | "refund" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  /** Reads the anchor's transaction and the on-chain escrow; no state changes. */
  const fetchState = useCallback(async () => {
    if (!id || !session.jwt || !session.address) return null;
    const next = await getTransaction(appConfig.anchorUrl, session.jwt, id);
    if (!next.escrow) return { tx: next, escrow: null, ledger: null };
    const [state, current] = await Promise.all([
      getEscrowState(next.escrow.contract_id, next.escrow.tx_id, session.address),
      latestLedger(),
    ]);
    return { tx: next, escrow: state, ledger: current };
  }, [id, session.jwt, session.address]);

  const refresh = useCallback(
    (reportErrors = true) =>
      fetchState().then(
        (s) => {
          if (!s) return;
          setTx(s.tx);
          setEscrow(s.escrow);
          setLedger(s.ledger);
        },
        (err: unknown) => {
          if (reportErrors) setError(err instanceof Error ? err.message : t("common.unknownError"));
        },
      ),
    [fetchState, t],
  );

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(false), 5_000);
    return () => clearInterval(timer);
  }, [refresh]);

  if (!session.jwt || !session.address) {
    return (
      <Alert kind="info">
        {t("history.signInFirst")}{" "}
        <Link className="underline" href="/app">
          {t("app.nav.wallet")}
        </Link>
      </Alert>
    );
  }
  if (!tx) return error ? <Alert>{error}</Alert> : <Spinner />;

  async function act(kind: "lock" | "refund") {
    const details = tx!.escrow!;
    // Only ever lock into the escrow this app was built for.
    if (appConfig.escrowContractId && details.contract_id !== appConfig.escrowContractId) {
      setError(t("escrow.notConfigured"));
      return;
    }
    setBusy(kind);
    setError(null);
    setNotice(null);
    try {
      const common = {
        contractId: details.contract_id,
        address: session.address!,
        sign: session.signer!,
        txIdHex: details.tx_id,
      };
      const hash =
        kind === "lock"
          ? await lockFunds({
              ...common,
              amount: details.amount ?? tx!.amount_in!,
              timeoutLedgers: details.timeout_ledgers,
            })
          : await refundEscrow(common);
      setNotice(kind === "lock" ? t("escrow.lockDone", { hash }) : t("escrow.refundDone", { hash }));
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("common.unknownError"));
    } finally {
      setBusy(null);
    }
  }

  return (
    <EscrowPanel
      tx={tx}
      escrow={escrow}
      latestLedger={ledger}
      busy={busy}
      error={error}
      notice={notice}
      onLock={() => void act("lock")}
      onRefund={() => void act("refund")}
    />
  );
}
