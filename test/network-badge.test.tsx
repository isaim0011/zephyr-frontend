import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { I18nProvider } from "@/lib/i18n";
import { appConfig } from "@/lib/config";
import { expectNoA11yViolations } from "./a11y";

/**
 * Renders the badge that appears next to the logo in the site header.
 * The badge shows "Testnet" or "Mainnet" based on appConfig.network.
 */
function renderBadge() {
  const { container } = render(
    <I18nProvider lang="en">
      <span
        data-testid="network-badge"
        className={`rounded px-2 py-0.5 text-xs font-medium ${
          appConfig.network === "testnet"
            ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
            : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100"
        }`}
      >
        {appConfig.network === "testnet" ? "Testnet" : "Mainnet"}
      </span>
    </I18nProvider>,
  );
  return container;
}

describe("NetworkBadge", () => {
  it("shows the correct network label", async () => {
    const container = renderBadge();
    const expected = appConfig.network === "testnet" ? "Testnet" : "Mainnet";
    expect(screen.getByTestId("network-badge")).toHaveTextContent(expected);
    await expectNoA11yViolations(container);
  });

  it("has an accessible name", () => {
    renderBadge();
    const badge = screen.getByTestId("network-badge");
    expect(badge).toHaveTextContent(/Testnet|Mainnet/);
    expect(badge.tagName).toBe("SPAN");
  });
});
