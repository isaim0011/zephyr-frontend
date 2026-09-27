import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EscrowWithdrawal } from "@/components/EscrowWithdrawal";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { WalletHome } from "@/components/WalletHome";
import { getTransaction, listTransactions, startInteractive } from "@/lib/api/client";
import { expectNoA11yViolations } from "./a11y";
import { tx } from "./fixtures";

const push = vi.fn();
let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }), useSearchParams: () => search }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));
vi.mock("@/lib/wallet", () => ({
  connectWallet: vi.fn(async () => "GUSER"),
  disconnectWallet: vi.fn(async () => {}),
  walletSigner: () => async (xdr: string) => xdr,
}));
vi.mock("@/lib/auth", () => ({ sep10Login: vi.fn(async () => "jwt") }));
const horizon = vi.hoisted(() => ({
  loadAccountState: vi.fn(),
  addUsdcTrustline: vi.fn(async () => "trusthash"),
}));
vi.mock("@/lib/horizon", () => horizon);
const escrow = vi.hoisted(() => ({
  getEscrowState: vi.fn(),
  latestLedger: vi.fn(async () => 1000),
  lockFunds: vi.fn(async () => "lockhash"),
  refundEscrow: vi.fn(async () => "refundhash"),
  ledgerEta: (ledger: number, current: number) => new Date(Date.UTC(2026, 8, 27) + (ledger - current) * 5000),
}));
vi.mock("@/lib/escrow", () => escrow);
vi.mock("@/lib/config", () => ({
  appConfig: {
    anchorUrl: "http://anchor.test",
    network: "testnet",
    networkPassphrase: "Test SDF Network ; September 2015",
    escrowContractId: "CESCROW",
    usdc: { code: "USDC", issuer: "GISSUER" },
  },
}));

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
/** A fetch mock that returns a fresh Response on every call (a body can only be read once). */
const respond = (body: unknown, status = 200) => vi.fn(async () => json(body, status));

/** Renders `ui` inside a session that is already connected and signed in. */
async function signedIn(ui: ReactNode) {
  let session!: ReturnType<typeof useSession>;
  function Grab() {
    session = useSession();
    return null;
  }
  const utils = render(
    <SessionProvider>
      <Grab />
      {ui}
    </SessionProvider>,
  );
  await act(() => session.connect());
  await act(() => session.login());
  return { ...utils, session };
}

function postMessageFrom(origin: string, data: unknown) {
  act(() => {
    window.dispatchEvent(new MessageEvent("message", { origin, data }));
  });
}

beforeEach(() => {
  horizon.loadAccountState.mockResolvedValue({ exists: true, hasTrustline: true, usdcBalance: "25.0000000" });
  escrow.latestLedger.mockResolvedValue(1000);
  push.mockReset();
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("WalletHome", () => {
  it("connects, signs in and shows the USDC balance", async () => {
    const user = userEvent.setup();
    const { container } = render(
      <SessionProvider>
        <WalletHome />
      </SessionProvider>,
    );
    await user.click(screen.getByRole("button", { name: "Connect wallet" }));
    expect(await screen.findByTestId("balance")).toHaveTextContent("25.0000000 USDC");
    await user.click(screen.getByRole("button", { name: "Sign in to Zephyr" }));
    expect(await screen.findByRole("button", { name: "Deposit USD" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Withdraw with escrow" })).toBeInTheDocument();
    await expectNoA11yViolations(container);
  });

  it("offers a trustline when USDC can't be held yet", async () => {
    horizon.loadAccountState
      .mockResolvedValueOnce({ exists: true, hasTrustline: false, usdcBalance: null })
      .mockResolvedValueOnce({ exists: true, hasTrustline: true, usdcBalance: "0.0000000" });
    await signedIn(<WalletHome />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Add USDC trustline" }));
    expect(horizon.addUsdcTrustline).toHaveBeenCalledWith("GUSER", expect.any(Function));
    expect(await screen.findByText("USDC trustline added.")).toBeInTheDocument();
    expect(screen.getByTestId("balance")).toHaveTextContent("0.0000000 USDC");
  });

  it("explains an unfunded account", async () => {
    horizon.loadAccountState.mockResolvedValue({ exists: false, hasTrustline: false, usdcBalance: null });
    await signedIn(<WalletHome />);
    expect(await screen.findByText(/isn't funded yet/)).toBeInTheDocument();
  });

  it("starts an escrow withdrawal in a popup and follows it via postMessage from the anchor only", async () => {
    const fetchMock = respond({
      type: "interactive_customer_info_needed",
      url: "http://anchor.test/sep24/interactive/withdraw?transaction_id=t1&token=x",
      id: "t1",
    });
    vi.stubGlobal("fetch", fetchMock);
    const open = vi.fn(() => ({}) as Window);
    vi.stubGlobal("open", open);
    await signedIn(<WalletHome />);

    await userEvent.setup().click(await screen.findByRole("button", { name: "Withdraw with escrow" }));
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body).toMatchObject({ asset_code: "USDC", account: "GUSER", withdraw_mode: "escrow" });
    expect(open).toHaveBeenCalledWith(
      expect.stringContaining("&callback=postMessage"),
      "zephyr-sep24",
      expect.any(String),
    );
    expect(await screen.findByText("Complete the form in the popup window…")).toBeInTheDocument();

    const ready = tx({
      id: "t1",
      kind: "withdrawal",
      status: "pending_user_transfer_start",
      withdraw_mode: "escrow",
      escrow: { contract_id: "CESCROW", tx_id: "ab".repeat(32), amount: "5.00", timeout_ledgers: 720 },
    });
    postMessageFrom("https://evil.example", { transaction: ready });
    expect(push).not.toHaveBeenCalled();
    postMessageFrom("http://anchor.test", { transaction: ready });
    expect(push).toHaveBeenCalledWith("/app/escrow?id=t1");
  });

  it("tells the user when the popup is blocked", async () => {
    vi.stubGlobal("fetch", respond({ url: "http://anchor.test/x?y=1", id: "t2" }));
    vi.stubGlobal(
      "open",
      vi.fn(() => null),
    );
    await signedIn(<WalletHome />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Deposit USD" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("blocked the popup");
    expect(screen.getByRole("link", { name: "Open the form" })).toHaveAttribute(
      "href",
      "http://anchor.test/x?y=1&callback=postMessage",
    );
  });

  it("surfaces anchor errors", async () => {
    vi.stubGlobal("fetch", respond({ error: "unsupported asset_code" }, 400));
    await signedIn(<WalletHome />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Withdraw to bank" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("unsupported asset_code");
  });
});

describe("EscrowWithdrawal", () => {
  const escrowTx = tx({
    id: "t1",
    kind: "withdrawal",
    status: "pending_user_transfer_start",
    amount_in: "5.00",
    withdraw_mode: "escrow",
    escrow: { contract_id: "CESCROW", tx_id: "ab".repeat(32), amount: "5.00", timeout_ledgers: 720 },
  });

  beforeEach(() => {
    search = new URLSearchParams({ id: "t1" });
  });

  it("asks to sign in first", () => {
    render(
      <SessionProvider>
        <EscrowWithdrawal />
      </SessionProvider>,
    );
    expect(screen.getByText(/Sign in from the wallet page/)).toBeInTheDocument();
  });

  it("locks funds with the anchor's escrow details", async () => {
    vi.stubGlobal("fetch", respond({ transaction: escrowTx }));
    escrow.getEscrowState
      .mockResolvedValueOnce({ status: "none" })
      .mockResolvedValue({ status: "Locked", amount: 50_000_000n, expiresLedger: 1720, user: "GUSER" });
    await signedIn(<EscrowWithdrawal />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Sign and lock" }));
    expect(escrow.lockFunds).toHaveBeenCalledWith(
      expect.objectContaining({
        contractId: "CESCROW",
        address: "GUSER",
        txIdHex: "ab".repeat(32),
        amount: "5.00",
        timeoutLedgers: 720,
      }),
    );
    expect(await screen.findByText("Locked in transaction lockhash")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByTestId("escrow-state")).toHaveTextContent("Locked"));
  });

  it("refuses to lock into a contract other than the configured escrow", async () => {
    const phishing = { ...escrowTx, escrow: { ...escrowTx.escrow!, contract_id: "CEVIL" } };
    vi.stubGlobal("fetch", respond({ transaction: phishing }));
    escrow.getEscrowState.mockResolvedValue({ status: "none" });
    await signedIn(<EscrowWithdrawal />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Sign and lock" }));
    expect(escrow.lockFunds).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("Escrow isn't configured");
  });

  it("refunds an expired escrow", async () => {
    vi.stubGlobal("fetch", respond({ transaction: escrowTx }));
    escrow.latestLedger.mockResolvedValue(2000);
    escrow.getEscrowState.mockResolvedValue({ status: "Locked", amount: 1n, expiresLedger: 1720, user: "GUSER" });
    await signedIn(<EscrowWithdrawal />);
    await userEvent.setup().click(await screen.findByRole("button", { name: "Refund my USDC" }));
    expect(escrow.refundEscrow).toHaveBeenCalledWith(
      expect.objectContaining({ contractId: "CESCROW", txIdHex: "ab".repeat(32) }),
    );
    expect(await screen.findByText("Refund sent: refundhash")).toBeInTheDocument();
  });

  it("shows load errors", async () => {
    vi.stubGlobal("fetch", respond({ error: "transaction not found" }, 404));
    await signedIn(<EscrowWithdrawal />);
    expect(await screen.findByRole("alert")).toHaveTextContent("transaction not found");
  });
});

describe("ThemeToggle", () => {
  it("switches theme, persists it and exposes the state", async () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    const user = userEvent.setup();
    render(<ThemeToggle />);
    const button = screen.getByRole("button", { name: /Switch theme/ });
    expect(button).toHaveAttribute("aria-pressed", "false");
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("zephyr-theme")).toBe("dark");
    expect(button).toHaveAttribute("aria-pressed", "true");
    await user.click(button);
    expect(document.documentElement.dataset.theme).toBe("light");
  });
});

describe("anchor API client", () => {
  it("sends the JWT and paging params", async () => {
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(async () => json({ transactions: [tx()] }))
      .mockImplementationOnce(async () => json({ transaction: tx({ id: "t9" }) }))
      .mockImplementationOnce(async () => json({ url: "u", id: "t9", type: "interactive_customer_info_needed" }));
    vi.stubGlobal("fetch", fetchMock);
    await listTransactions("http://a", "jwt", { limit: 5, pagingId: "p1" });
    expect(fetchMock.mock.calls[0]![0]).toBe("http://a/sep24/transactions?asset_code=USDC&limit=5&paging_id=p1");
    expect(fetchMock.mock.calls[0]![1].headers.authorization).toBe("Bearer jwt");
    expect((await getTransaction("http://a", "jwt", "t9")).id).toBe("t9");
    await startInteractive("http://a", "jwt", "deposit", { asset_code: "USDC" });
    expect(fetchMock.mock.calls[2]![0]).toBe("http://a/sep24/transactions/deposit/interactive");
  });

  it("maps network failures to status 0", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("offline")));
    await expect(getTransaction("http://a", "jwt", "t")).rejects.toMatchObject({ status: 0 });
  });
});
