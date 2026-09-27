import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/en";
import { I18nProvider, pickLang, translate, useI18n } from "@/lib/i18n";
import { TRANSACTION_STATUSES } from "./statuses";

describe("i18n", () => {
  it("fills placeholders and falls back to English", () => {
    expect(translate("en", "form.amount", { unit: "USD" })).toBe("Amount (USD)");
    expect(translate("fr", "common.copy")).toBe("Copy");
    expect(pickLang("en-US")).toBe("en");
    expect(pickLang("de")).toBe("en");
    expect(pickLang(null)).toBe("en");
  });

  it("has a label for every SEP-24 status", () => {
    for (const s of TRANSACTION_STATUSES) expect(en.status.labels[s]).toBeTruthy();
  });

  it("provides t() through context", () => {
    function Probe() {
      const { t, lang } = useI18n();
      return <p>{`${lang}:${t("wallet.connect")}`}</p>;
    }
    render(
      <I18nProvider lang="xx">
        <Probe />
      </I18nProvider>,
    );
    expect(screen.getByText("en:Connect wallet")).toBeInTheDocument();
  });
});
