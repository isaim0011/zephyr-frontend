"use client";

import { useId, useState } from "react";
import { useI18n } from "@/lib/i18n";

/** A labelled value with a copy-to-clipboard button. Announces success to screen readers. */
export function CopyField({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const id = useId();

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="flex items-center gap-2 border-b border-line py-2 last:border-b-0">
      <div className="min-w-0 flex-1">
        <div id={`${id}-label`} className="text-sm text-muted">
          {label}
        </div>
        <div id={`${id}-value`} className="font-mono text-sm break-all">
          {value}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`${t("common.copy")} ${label}`}
        className="min-h-11 shrink-0 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent"
      >
        {t("common.copy")}
      </button>
      <span aria-live="polite" className="sr-only">
        {copied ? t("common.copied", { label }) : ""}
      </span>
    </div>
  );
}
