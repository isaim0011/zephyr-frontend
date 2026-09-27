import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CopyField } from "@/components/CopyField";
import { StatusView } from "@/components/StatusView";
import { expectNoA11yViolations } from "./a11y";
import { tx } from "./fixtures";

describe("StatusView", () => {
  it("shows deposit bank instructions with a copy button per field", async () => {
    const { container } = render(
      <StatusView
        transaction={tx({
          status: "pending_user_transfer_start",
          amount_in: "100.00",
          amount_fee: "1.50",
          amount_out: "98.50",
        })}
        depositInstructions={{ bank_name: "Sandbox Bank", account_number: "000123", reference: "ZEPHYR-ABC" }}
        polling
      />,
    );
    expect(screen.getByRole("heading", { name: "Send your dollars" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: /^Copy/ })).toHaveLength(3);
    expect(screen.getByText("ZEPHYR-ABC")).toBeInTheDocument();
    expect(screen.getByText("100.00 USD")).toBeInTheDocument();
    expect(screen.getByText("98.50 USDC")).toBeInTheDocument();
    expect(screen.getByText("This page updates automatically.")).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("shows the destination and memo for a standard withdrawal", () => {
    render(
      <StatusView
        transaction={tx({
          kind: "withdrawal",
          status: "pending_user_transfer_start",
          amount_in: "50.00",
          withdraw_mode: "standard",
          withdraw_anchor_account: "GANCHOR",
          withdraw_memo: "abc123",
        })}
        depositInstructions={null}
      />,
    );
    expect(screen.getByText("GANCHOR")).toBeInTheDocument();
    expect(screen.getByText("abc123")).toBeInTheDocument();
  });

  it("shows escrow details for an escrow withdrawal", () => {
    render(
      <StatusView
        transaction={tx({
          kind: "withdrawal",
          status: "pending_user_transfer_start",
          amount_in: "50.00",
          withdraw_mode: "escrow",
          escrow: { contract_id: "CESCROW", tx_id: "ab".repeat(32), amount: "50.00", timeout_ledgers: 17280 },
        })}
        depositInstructions={null}
      />,
    );
    expect(screen.getByRole("heading", { name: "Lock your USDC in escrow" })).toBeInTheDocument();
    expect(screen.getByText("CESCROW")).toBeInTheDocument();
  });

  it.each([
    ["completed", "USDC has been sent to your Stellar account."],
    ["error", "Our team is reviewing this transaction."],
  ] as const)("explains the %s status", (status, text) => {
    render(<StatusView transaction={tx({ status })} depositInstructions={null} />);
    expect(screen.getByText(new RegExp(text))).toBeInTheDocument();
  });

  it("shows refunds", () => {
    render(
      <StatusView
        transaction={tx({
          kind: "withdrawal",
          status: "refunded",
          refunded: true,
          refunds: { amount_refunded: "50.00", amount_fee: "0.00", payments: [] },
          message: "fiat payout failed; your USDC was returned",
        })}
        depositInstructions={null}
      />,
    );
    expect(screen.getByText("50.00 USDC was returned to your Stellar account.")).toBeInTheDocument();
    expect(screen.getByText(/fiat payout failed/)).toBeInTheDocument();
    expect(screen.getByText("Refunded")).toBeInTheDocument();
  });
});

describe("CopyField", () => {
  it("copies the value and announces it", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<CopyField label="Reference" value="ZEPHYR-1" />);
    await user.click(screen.getByRole("button", { name: "Copy Reference" }));
    expect(writeText).toHaveBeenCalledWith("ZEPHYR-1");
    expect(await screen.findByText("Copied Reference")).toBeInTheDocument();
  });
});
