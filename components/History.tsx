"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listTransactions, type Transaction } from "@/lib/api/client";
import { appConfig } from "@/lib/config";
import { useI18n } from "@/lib/i18n";
import { useSession } from "./SessionProvider";
import { Alert, Spinner, StatusBadge } from "./ui";

const PAGE = 20;

/** Transaction history backed by SEP-24 `GET /transactions`, paged with `paging_id`. */
export function History({ load = listTransactions }: { load?: typeof listTransactions }) {
  const { t } = useI18n();
  const { jwt } = useSession();
  const [items, setItems] = useState<Transaction[] | null>(null);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetches a page and applies it once the request settles.
  const fetchPage = useCallback(
    (pagingId?: string) => {
      if (!jwt) return;
      load(appConfig.anchorUrl, jwt, { limit: PAGE, pagingId }).then(
        (page) => {
          setItems((prev) => (pagingId ? [...(prev ?? []), ...page] : page));
          setMore(page.length === PAGE);
        },
        (err: unknown) => setError(err instanceof Error ? err.message : t("common.unknownError")),
      );
    },
    [jwt, load, t],
  );

  useEffect(() => {
    fetchPage();
  }, [fetchPage]);

  if (!jwt) {
    return (
      <Alert kind="info">
        {t("history.signInFirst")}{" "}
        <Link className="underline" href="/app">
          {t("app.nav.wallet")}
        </Link>
      </Alert>
    );
  }

  return (
    <section aria-labelledby="history-heading" className="space-y-4">
      <h1 id="history-heading" className="text-2xl font-bold">
        {t("history.title")}
      </h1>
      {error ? <Alert>{error}</Alert> : null}
      {items === null ? (
        <Spinner />
      ) : items.length === 0 ? (
        <p>{t("history.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((tx) => (
            <li key={tx.id} className="card flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-semibold">{t(`history.kind.${tx.kind}`)}</div>
                <div className="text-sm text-muted">
                  <time dateTime={tx.started_at}>{new Date(tx.started_at).toLocaleString()}</time>
                </div>
              </div>
              <div className="text-right">
                <div className="font-mono">{tx.amount_in ?? "—"}</div>
                <StatusBadge status={tx.status} />
              </div>
              {tx.withdraw_mode === "escrow" ? (
                <Link className="w-full text-sm underline" href={`/app/escrow?id=${encodeURIComponent(tx.id)}`}>
                  {t("escrow.title")}
                </Link>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {more && items ? (
        <button type="button" className="btn-secondary" onClick={() => fetchPage(items[items.length - 1]!.id)}>
          {t("history.loadMore")}
        </button>
      ) : null}
    </section>
  );
}
