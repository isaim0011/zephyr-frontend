"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { getTransaction, startInteractive, TERMINAL_STATUSES, type Transaction } from "@/lib/api/client";
import { appConfig } from "@/lib/config";
import { addUsdcTrustline, type AccountState, loadAccountState } from "@/lib/horizon";
import { useI18n } from "@/lib/i18n";
import { useSession } from "./SessionProvider";
import { Alert, Spinner, StatusBadge } from "./ui";

type Kind = "deposit" | "withdraw" | "escrow";

export function WalletHome() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const session = useSession();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [account, setAccount] = useState<AccountState | null>(null);
  const [active, setActive] = useState<{ tx: Transaction | null; id: string; url: string; kind: Kind } | null>(null);

  const run = useCallback(
    async (label: string, fn: () => Promise<void>) => {
      setBusy(label);
      setError(null);
      setNotice(null);
      try {
        await fn();
      } catch (err) {
        setError(err instanceof Error ? err.message : t("common.unknownError"));
      } finally {
        setBusy(null);
      }
    },
    [t],
  );

  const refreshAccount = useCallback(async () => {
    if (session.address) setAccount(await loadAccountState(session.address));
  }, [session.address]);

  useEffect(() => {
    if (!session.address) return;
    loadAccountState(session.address)
      .then(setAccount)
      .catch(() => setAccount(null));
  }, [session.address]);

  // Follow the transaction started from this page: popup messages + polling.
  const onUpdate = useCallback(
    (tx: Transaction) => {
      setActive((a) => (a && a.id === tx.id ? { ...a, tx } : a));
      if (tx.withdraw_mode === "escrow" && tx.status === "pending_user_transfer_start" && tx.escrow) {
        router.push(`/app/escrow?id=${encodeURIComponent(tx.id)}`);
      }
    },
    [router],
  );

  useEffect(() => {
    if (!active) return;
    const anchorOrigin = new URL(appConfig.anchorUrl).origin;
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== anchorOrigin) return;
      const tx = (event.data as { transaction?: Transaction })?.transaction;
      if (tx?.id === active.id) onUpdate(tx);
    };
    window.addEventListener("message", onMessage);
    const timer = setInterval(async () => {
      if (!session.jwt) return;
      const tx = await getTransaction(appConfig.anchorUrl, session.jwt, active.id).catch(() => null);
      if (tx) onUpdate(tx);
      if (tx && TERMINAL_STATUSES.includes(tx.status)) clearInterval(timer);
    }, 5_000);
    return () => {
      window.removeEventListener("message", onMessage);
      clearInterval(timer);
    };
  }, [active, session.jwt, onUpdate]);

  function start(kind: Kind) {
    return run(kind, async () => {
      const res = await startInteractive(
        appConfig.anchorUrl,
        session.jwt!,
        kind === "deposit" ? "deposit" : "withdraw",
        {
          asset_code: appConfig.usdc.code,
          account: session.address!,
          lang,
          ...(kind === "escrow" ? { withdraw_mode: "escrow" as const } : {}),
        },
      );
      const url = `${res.url}&callback=postMessage`;
      setActive({ id: res.id, url, kind, tx: null });
      const popup = window.open(url, "zephyr-sep24", "popup,width=420,height=760");
      if (!popup) setError(t("wallet.popupBlocked"));
    });
  }

  if (!session.address) {
    return (
      <Section title={t("wallet.title")}>
        <p>{t("wallet.intro")}</p>
        {error ? <Alert>{error}</Alert> : null}
        <button
          type="button"
          className="btn-primary"
          disabled={busy !== null}
          onClick={() => run("connect", session.connect)}
        >
          {busy === "connect" ? t("wallet.connecting") : t("wallet.connect")}
        </button>
      </Section>
    );
  }

  return (
    <Section title={t("wallet.title")}>
      <div className="card flex flex-wrap items-center justify-between gap-2">
        <span className="font-mono text-sm break-all">
          {t("wallet.connectedAs", { address: short(session.address) })}
        </span>
        <button
          type="button"
          className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold"
          onClick={() => void session.logout()}
        >
          {t("wallet.disconnect")}
        </button>
      </div>

      {error ? <Alert>{error}</Alert> : null}
      {notice ? <Alert kind="success">{notice}</Alert> : null}

      <div className="card space-y-2">
        <h2 className="font-semibold">{t("wallet.balance")}</h2>
        {account === null ? (
          <Spinner />
        ) : !account.exists ? (
          <p>{t("wallet.accountMissing")}</p>
        ) : account.hasTrustline ? (
          <p className="text-2xl font-bold" data-testid="balance">
            {account.usdcBalance} USDC
          </p>
        ) : (
          <>
            <p>{t("wallet.noTrustline")}</p>
            <button
              type="button"
              className="btn-secondary"
              disabled={busy !== null}
              onClick={() =>
                run("trust", async () => {
                  await addUsdcTrustline(session.address!, session.signer!);
                  await refreshAccount();
                  setNotice(t("wallet.trustlineAdded"));
                })
              }
            >
              {busy === "trust" ? t("wallet.addingTrustline") : t("wallet.addTrustline")}
            </button>
          </>
        )}
      </div>

      {!session.jwt ? (
        <div className="space-y-2">
          <button
            type="button"
            className="btn-primary"
            disabled={busy !== null}
            onClick={() => run("login", session.login)}
          >
            {busy === "login" ? t("wallet.loggingIn") : t("wallet.login")}
          </button>
          <p className="hint">{t("wallet.loginHint")}</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-3">
          <button
            type="button"
            className="btn-primary"
            disabled={busy !== null || !account?.hasTrustline}
            onClick={() => void start("deposit")}
          >
            {t("wallet.deposit")}
          </button>
          <button
            type="button"
            className="btn-secondary"
            disabled={busy !== null}
            onClick={() => void start("withdraw")}
          >
            {t("wallet.withdraw")}
          </button>
          {appConfig.escrowContractId ? (
            <button
              type="button"
              className="btn-secondary"
              disabled={busy !== null}
              onClick={() => void start("escrow")}
            >
              {t("wallet.withdrawEscrow")}
            </button>
          ) : null}
        </div>
      )}

      {active ? (
        <div className="card space-y-2" aria-live="polite">
          {active.tx ? <StatusBadge status={active.tx.status} /> : <p>{t("wallet.waitingForForm")}</p>}
          <a className="underline" href={active.url} target="zephyr-sep24" rel="noopener">
            {t("wallet.openForm")}
          </a>
        </div>
      ) : null}

      {session.jwt ? (
        <Link className="underline" href="/app/history">
          {t("wallet.history")}
        </Link>
      ) : null}
    </Section>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold">{title}</h1>
      {children}
    </section>
  );
}

function short(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-6)}`;
}
