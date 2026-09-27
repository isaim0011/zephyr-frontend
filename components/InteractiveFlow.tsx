"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ApiError,
  getInteractive,
  type InteractiveSubmit,
  type InteractiveView,
  submitInteractive,
  TERMINAL_STATUSES,
} from "@/lib/api/client";
import { notifyWallet } from "@/lib/callback";
import { I18nProvider, useI18n } from "@/lib/i18n";
import { StatusView } from "./StatusView";
import { TransferForm } from "./TransferForm";
import { Alert, Spinner } from "./ui";

const POLL_MS = 5_000;

/**
 * The SEP-24 interactive flow, opened by a wallet in a popup or webview:
 * `?transaction_id=&token=&lang=&callback=&withdraw_mode=`.
 * `readOnly` is the more_info page (status only).
 */
export function InteractiveFlow({ readOnly = false }: { readOnly?: boolean }) {
  const params = useSearchParams();
  return (
    <I18nProvider lang={params.get("lang")}>
      <Flow
        id={params.get("transaction_id")}
        token={params.get("token")}
        callback={params.get("callback")}
        defaultMode={params.get("withdraw_mode") === "escrow" ? "escrow" : "standard"}
        readOnly={readOnly}
      />
    </I18nProvider>
  );
}

function Flow({
  id,
  token,
  callback,
  defaultMode,
  readOnly,
}: {
  id: string | null;
  token: string | null;
  callback: string | null;
  defaultMode: "standard" | "escrow";
  readOnly: boolean;
}) {
  const { t } = useI18n();
  const [view, setView] = useState<InteractiveView | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const lastStatus = useRef<string | null>(null);

  const describe = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError) {
        if (err.status === 0) return t("common.networkError");
        if (err.status === 401 || err.status === 403) return t("status.sessionExpired");
        return err.message;
      }
      return t("common.unknownError");
    },
    [t],
  );

  const apply = useCallback(
    (next: InteractiveView) => {
      setView(next);
      // Tell the wallet whenever the status changes (SEP-24 `callback`).
      if (next.transaction.status !== lastStatus.current) {
        if (lastStatus.current !== null) notifyWallet(callback, next.transaction);
        lastStatus.current = next.transaction.status;
      }
    },
    [callback],
  );

  const missingParams = !id || !token;

  // State is only set once the request settles (never synchronously in the effect).
  const load = useCallback(() => {
    if (!id || !token) return;
    getInteractive(id, token).then(
      (next) => {
        setLoadError(null);
        apply(next);
      },
      (err: unknown) => setLoadError(describe(err)),
    );
  }, [id, token, apply, describe]);

  useEffect(() => {
    load();
  }, [load]);

  // Keep the status fresh until it's final.
  const status = view?.transaction.status;
  const polling = Boolean(view && !view.editable && status && !TERMINAL_STATUSES.includes(status));
  useEffect(() => {
    if (!polling) return;
    const timer = setInterval(load, POLL_MS);
    return () => clearInterval(timer);
  }, [polling, load]);

  async function submit(values: InteractiveSubmit) {
    setSubmitError(null);
    try {
      apply(await submitInteractive(id!, token!, values));
    } catch (err) {
      setSubmitError(describe(err));
    }
  }

  if (missingParams) return <Alert>{t("status.sessionExpired")}</Alert>;
  if (loadError && !view) {
    return (
      <div className="space-y-4">
        <Alert>{loadError}</Alert>
        {id && token ? (
          <button type="button" className="btn-secondary" onClick={load}>
            {t("common.retry")}
          </button>
        ) : null}
      </div>
    );
  }
  if (!view) return <Spinner />;
  if (view.editable && !readOnly) {
    return <TransferForm view={view} defaultMode={defaultMode} onSubmit={submit} error={submitError} />;
  }
  return (
    <StatusView transaction={view.transaction} depositInstructions={view.deposit_instructions} polling={polling} />
  );
}
