"use client";

import type { ReactNode } from "react";
import type { TransactionStatus } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";

export function Alert({ kind = "error", children }: { kind?: "error" | "info" | "success"; children: ReactNode }) {
  const color = kind === "error" ? "border-err text-err" : kind === "success" ? "border-ok text-ok" : "border-line";
  return (
    <div role={kind === "error" ? "alert" : "status"} className={`rounded-lg border-l-4 bg-surface p-3 ${color}`}>
      {children}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  const { t } = useI18n();
  return (
    <div role="status" aria-live="polite" className="flex items-center gap-3 py-6 text-muted">
      <span
        aria-hidden="true"
        className="h-5 w-5 animate-spin rounded-full border-2 border-line border-t-[var(--accent)]"
      />
      <span>{label ?? t("common.loading")}</span>
    </div>
  );
}

const TONE: Partial<Record<TransactionStatus, string>> = {
  completed: "text-ok border-ok",
  refunded: "text-warn border-warn",
  error: "text-err border-err",
  expired: "text-muted border-line",
};

export function StatusBadge({ status }: { status: TransactionStatus }) {
  const { t } = useI18n();
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-sm font-semibold ${TONE[status] ?? "border-accent text-accent"}`}
      data-status={status}
    >
      {t(`status.labels.${status}`)}
    </span>
  );
}

/** A definition list row: label + value. */
export function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap justify-between gap-x-4 gap-y-1 border-b border-line py-2 last:border-b-0">
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium break-all">{children}</dd>
    </div>
  );
}
