"use client";

import { type FormEvent, useId, useMemo, useRef, useState } from "react";
import { compare, isValidAmount, quote } from "@/lib/amount";
import type { InteractiveSubmit, InteractiveView } from "@/lib/api/client";
import { useI18n } from "@/lib/i18n";
import { Alert } from "./ui";

type Mode = "standard" | "escrow";
type Errors = Partial<Record<"amount" | "name" | "email", string>>;

export interface TransferFormProps {
  view: Pick<InteractiveView, "limits" | "fee" | "escrow"> & {
    transaction: Pick<InteractiveView["transaction"], "kind" | "amount_in">;
  };
  defaultMode?: Mode;
  onSubmit: (values: InteractiveSubmit) => Promise<void>;
  /** Server-side error to show above the form. */
  error?: string | null;
}

/**
 * Deposit / withdraw form. Shows the fee and the amount received live, using
 * the anchor's formula and values from the API (exact decimal math).
 */
export function TransferForm({ view, defaultMode = "standard", onSubmit, error }: TransferFormProps) {
  const { t } = useI18n();
  const ids = { amount: useId(), name: useId(), email: useId(), quote: useId() };
  const kind = view.transaction.kind;
  const unitIn = kind === "deposit" ? t("common.usd") : t("common.usdc");
  const unitOut = kind === "deposit" ? t("common.usdc") : t("common.usd");
  const escrowAvailable = kind === "withdrawal" && view.escrow.enabled;

  const [amount, setAmount] = useState(view.transaction.amount_in ?? "");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [mode, setMode] = useState<Mode>(escrowAvailable ? defaultMode : "standard");
  const [errors, setErrors] = useState<Errors>({});
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  const normalized = amount.trim();
  const q = useMemo(() => quote(normalized, view.fee), [normalized, view.fee]);

  function validate(): Errors {
    const e: Errors = {};
    const { min, max } = view.limits;
    if (!isValidAmount(normalized)) e.amount = t("form.errors.amountInvalid");
    else if (compare(normalized, min) < 0 || compare(normalized, max) > 0)
      e.amount = t("form.errors.amountRange", { min, max });
    else if (q && !q.coversFee) e.amount = t("form.errors.amountFee");
    if (!name.trim()) e.name = t("form.errors.nameRequired");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) e.email = t("form.errors.emailInvalid");
    return e;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const e = validate();
    setErrors(e);
    const first = (["amount", "name", "email"] as const).find((k) => e[k]);
    if (first) {
      ({ amount: amountRef, name: nameRef, email: emailRef })[first].current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await onSubmit({
        amount: normalized,
        name: name.trim(),
        email: email.trim(),
        ...(kind === "withdrawal" ? { withdraw_mode: mode } : {}),
      });
    } finally {
      setSubmitting(false);
    }
  }

  const field = (key: keyof Errors) => ({
    "aria-invalid": errors[key] ? true : undefined,
    "aria-describedby": errors[key] ? `${ids[key]}-error` : undefined,
  });

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-5" aria-busy={submitting}>
      <h1 className="text-xl font-bold">{kind === "deposit" ? t("form.depositTitle") : t("form.withdrawTitle")}</h1>
      {error ? <Alert>{error}</Alert> : null}

      <div>
        <label htmlFor={ids.amount} className="label">
          {t("form.amount", { unit: unitIn })}
        </label>
        <input
          ref={amountRef}
          id={ids.amount}
          name="amount"
          inputMode="decimal"
          autoComplete="off"
          className="input"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          {...field("amount")}
          aria-describedby={[errors.amount ? `${ids.amount}-error` : "", `${ids.amount}-hint`, ids.quote]
            .filter(Boolean)
            .join(" ")}
        />
        <p id={`${ids.amount}-hint`} className="hint">
          {t("form.amountHint", { min: view.limits.min, max: view.limits.max, unit: unitIn })}
        </p>
        {errors.amount ? (
          <p id={`${ids.amount}-error`} className="field-error">
            {errors.amount}
          </p>
        ) : null}
      </div>

      <dl id={ids.quote} className="card space-y-1 text-sm" aria-live="polite">
        <div className="flex justify-between">
          <dt className="text-muted">{t("form.fee")}</dt>
          <dd data-testid="fee">
            {q ? `${q.fee} ${unitIn}` : "—"}{" "}
            <span className="text-muted">
              ({t("form.feeFormula", { fixed: view.fee.fixed, unit: unitIn, percent: view.fee.percent })})
            </span>
          </dd>
        </div>
        <div className="flex justify-between font-semibold">
          <dt>{t("form.youReceive")}</dt>
          <dd data-testid="receive">{q ? `${q.receive} ${unitOut}` : "—"}</dd>
        </div>
      </dl>

      <div>
        <label htmlFor={ids.name} className="label">
          {t("form.name")}
        </label>
        <input
          ref={nameRef}
          id={ids.name}
          name="name"
          autoComplete="name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          {...field("name")}
        />
        {errors.name ? (
          <p id={`${ids.name}-error`} className="field-error">
            {errors.name}
          </p>
        ) : null}
      </div>

      <div>
        <label htmlFor={ids.email} className="label">
          {t("form.email")}
        </label>
        <input
          ref={emailRef}
          id={ids.email}
          name="email"
          type="email"
          autoComplete="email"
          className="input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          {...field("email")}
        />
        {errors.email ? (
          <p id={`${ids.email}-error`} className="field-error">
            {errors.email}
          </p>
        ) : null}
      </div>

      {escrowAvailable ? (
        <fieldset className="space-y-2">
          <legend className="label">{t("form.modeLegend")}</legend>
          {(["standard", "escrow"] as const).map((m) => (
            <label key={m} className="card flex cursor-pointer items-start gap-3 has-[:checked]:border-accent">
              <input
                type="radio"
                name="withdraw_mode"
                value={m}
                checked={mode === m}
                onChange={() => setMode(m)}
                className="mt-1 h-5 w-5 accent-[var(--accent)]"
              />
              <span>
                <span className="block font-semibold">
                  {m === "escrow" ? t("form.modeEscrow") : t("form.modeStandard")}
                </span>
                <span className="block text-sm text-muted">
                  {m === "escrow" ? t("form.modeEscrowHint") : t("form.modeStandardHint")}
                </span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}

      <button type="submit" className="btn-primary" disabled={submitting}>
        {submitting ? t("form.submitting") : t("form.submit")}
      </button>
    </form>
  );
}
