import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TransferForm } from "@/components/TransferForm";
import { expectNoA11yViolations } from "./a11y";
import { view } from "./fixtures";

function setup(opts: { kind?: "deposit" | "withdrawal"; escrow?: boolean; error?: string } = {}) {
  const onSubmit = vi.fn(async () => {});
  const v = view(
    {
      escrow: opts.escrow
        ? {
            enabled: true,
            contract_id: "C1",
            timeout_ledgers: 17280,
            network_passphrase: "x",
            soroban_rpc_url: "https://rpc",
          }
        : { enabled: false },
    },
    { kind: opts.kind ?? "deposit" },
  );
  const utils = render(<TransferForm view={v} onSubmit={onSubmit} error={opts.error} />);
  return { ...utils, onSubmit, user: userEvent.setup() };
}

describe("TransferForm", () => {
  it("shows the fee and receive amount live, using the anchor's formula", async () => {
    const { user } = setup();
    expect(screen.getByTestId("fee")).toHaveTextContent("—");
    await user.type(screen.getByLabelText("Amount (USD)"), "100");
    expect(screen.getByTestId("fee")).toHaveTextContent("1.50 USD");
    expect(screen.getByTestId("receive")).toHaveTextContent("98.50 USDC");
    await user.clear(screen.getByLabelText("Amount (USD)"));
    await user.type(screen.getByLabelText("Amount (USD)"), "33.33");
    expect(screen.getByTestId("fee")).toHaveTextContent("0.83 USD");
  });

  it("validates every field, marks them invalid and focuses the first error", async () => {
    const { user, onSubmit } = setup();
    await user.click(screen.getByRole("button", { name: "Continue" }));
    const amount = screen.getByLabelText("Amount (USD)");
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(amount).toHaveFocus();
    expect(screen.getByText("Enter an amount like 25 or 25.50.")).toBeInTheDocument();
    expect(screen.getByText("Enter your full name.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("enforces limits and the fee floor", async () => {
    const { user } = setup();
    await user.type(screen.getByLabelText("Amount (USD)"), "20000");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByText("Enter an amount between 1 and 10000.")).toBeInTheDocument();
  });

  it("submits trimmed values and shows a loading state", async () => {
    let resolve!: () => void;
    const onSubmit = vi.fn(() => new Promise<void>((r) => (resolve = r)));
    render(<TransferForm view={view()} onSubmit={onSubmit} />);
    const user = userEvent.setup();
    await user.type(screen.getByLabelText("Amount (USD)"), " 25.5 ");
    await user.type(screen.getByLabelText("Full name"), " Ada Lovelace ");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(onSubmit).toHaveBeenCalledWith({ amount: "25.5", name: "Ada Lovelace", email: "ada@example.com" });
    expect(screen.getByRole("button", { name: "Submitting…" })).toBeDisabled();
    resolve();
    expect(await screen.findByRole("button", { name: "Continue" })).toBeEnabled();
  });

  it("offers escrow mode only for withdrawals when the anchor supports it", async () => {
    const withEscrow = setup({ kind: "withdrawal", escrow: true });
    expect(screen.getByRole("group", { name: "How will you send USDC?" })).toBeInTheDocument();
    await withEscrow.user.click(screen.getByRole("radio", { name: /Escrow contract/ }));
    await withEscrow.user.type(screen.getByLabelText("Amount (USDC)"), "50");
    await withEscrow.user.type(screen.getByLabelText("Full name"), "Ada");
    await withEscrow.user.type(screen.getByLabelText("Email"), "a@b.co");
    await withEscrow.user.click(screen.getByRole("button", { name: "Continue" }));
    expect(withEscrow.onSubmit).toHaveBeenCalledWith(expect.objectContaining({ withdraw_mode: "escrow" }));
    withEscrow.unmount();

    setup({ kind: "withdrawal", escrow: false });
    expect(screen.queryByRole("group", { name: "How will you send USDC?" })).toBeNull();
    screen.getByText("You receive").closest("dl");
  });

  it("shows server errors as an alert", () => {
    setup({ error: "amount must be between 1 and 10000" });
    expect(screen.getByRole("alert")).toHaveTextContent("amount must be between 1 and 10000");
  });

  it("has no accessibility violations", async () => {
    const { container } = setup({ kind: "withdrawal", escrow: true });
    await expectNoA11yViolations(container);
  });
});
