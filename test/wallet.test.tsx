import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { EscrowPanel, type EscrowPanelProps } from "@/components/EscrowPanel";
import { History } from "@/components/History";
import { SessionProvider, useSession } from "@/components/SessionProvider";
import { notifyWallet } from "@/lib/callback";
import { ledgerEta } from "@/lib/escrow";
import { expectNoA11yViolations } from "./a11y";
import { tx } from "./fixtures";

afterEach(() => vi.unstubAllGlobals());

vi.mock("@/lib/wallet", () => ({
  connectWallet: vi.fn(async () => "GCLIENT"),
  disconnectWallet: vi.fn(async () => {}),
  walletSigner: () => async (xdr: string) => xdr,
}));
vi.mock("@/lib/auth", async (orig) => ({
  ...(await orig<typeof import("@/lib/auth")>()),
  sep10Login: vi.fn(async () => "in-memory-jwt"),
}));

describe("session", () => {
  it("keeps the JWT in memory only", async () => {
    let session!: ReturnType<typeof useSession>;
    function Probe() {
      session = useSession();
      return <p>{session.jwt ?? "no-jwt"}</p>;
    }
    const setItem = vi.spyOn(Storage.prototype, "setItem");
    render(
      <SessionProvider>
        <Probe />
      </SessionProvider>,
    );
    await act(() => session.connect());
    await act(() => session.login());
    expect(screen.getByText("in-memory-jwt")).toBeInTheDocument();
    expect(setItem).not.toHaveBeenCalled();
    expect(document.cookie).toBe("");
    await act(() => session.logout());
    expect(screen.getByText("no-jwt")).toBeInTheDocument();
  });
});

describe("wallet callbacks", () => {
  it("posts to the opener, then the parent frame", () => {
    const opener = { postMessage: vi.fn() };
    const transaction = tx({ status: "completed" });
    notifyWallet("postMessage", transaction, { opener, parent: null } as unknown as Window);
    expect(opener.postMessage).toHaveBeenCalledWith({ transaction }, "*");

    const parent = { postMessage: vi.fn() };
    notifyWallet("postMessage", transaction, { opener: null, parent } as unknown as Window);
    expect(parent.postMessage).toHaveBeenCalled();
  });

  it("POSTs to https callbacks only", () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response());
    vi.stubGlobal("fetch", fetchMock);
    notifyWallet("https://wallet.example/cb", tx());
    notifyWallet("http://wallet.example/cb", tx());
    notifyWallet("not a url", tx());
    notifyWallet(null, tx());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0]![0])).toBe("https://wallet.example/cb");
  });
});

describe("EscrowPanel", () => {
  const escrowTx = tx({
    kind: "withdrawal",
    status: "pending_user_transfer_start",
    amount_in: "50.00",
    amount_out: "49.00",
    withdraw_mode: "escrow",
    escrow: { contract_id: "CESCROW", tx_id: "ab".repeat(32), amount: "50.00", timeout_ledgers: 17280 },
  });
  const props = (over: Partial<EscrowPanelProps> = {}): EscrowPanelProps => ({
    tx: escrowTx,
    escrow: { status: "none" },
    latestLedger: 1000,
    busy: null,
    error: null,
    notice: null,
    onLock: vi.fn(),
    onRefund: vi.fn(),
    now: new Date("2026-09-27T12:00:00Z"),
    ...over,
  });

  it("offers to lock funds before the escrow exists", async () => {
    const p = props();
    const { container } = render(<EscrowPanel {...p} />);
    expect(screen.getByTestId("escrow-state")).toHaveTextContent("Not locked yet");
    await userEvent.setup().click(screen.getByRole("button", { name: "Sign and lock" }));
    expect(p.onLock).toHaveBeenCalled();
    await expectNoA11yViolations(container);
  });

  it("shows locked status and the refund deadline", () => {
    render(
      <EscrowPanel
        {...props({ escrow: { status: "Locked", amount: 500_000_000n, expiresLedger: 1720, user: "G" } })}
      />,
    );
    expect(screen.getByTestId("escrow-state")).toHaveTextContent("Locked");
    expect(screen.getByText(/Ledger 1720/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Refund my USDC" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Sign and lock" })).toBeNull();
  });

  it("offers a refund once the escrow has expired unclaimed", async () => {
    const p = props({ latestLedger: 1720, escrow: { status: "Locked", amount: 1n, expiresLedger: 1720, user: "G" } });
    render(<EscrowPanel {...p} />);
    expect(screen.getByText("Passed. You can refund now.")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole("button", { name: "Refund my USDC" }));
    expect(p.onRefund).toHaveBeenCalled();
  });

  it.each([
    ["Claimed", "Claimed by the anchor after payout"],
    ["Refunded", "Refunded to you"],
  ] as const)("shows the %s state", (status, label) => {
    render(<EscrowPanel {...props({ escrow: { status, amount: 1n, expiresLedger: 1720, user: "G" } })} />);
    expect(screen.getByTestId("escrow-state")).toHaveTextContent(label);
  });

  it("estimates the deadline at 5 s per ledger", () => {
    expect(ledgerEta(1720, 1000, new Date("2026-09-27T12:00:00Z")).toISOString()).toBe("2026-09-27T13:00:00.000Z");
  });
});

describe("History", () => {
  it("lists transactions and pages with paging_id", async () => {
    const page1 = Array.from({ length: 20 }, (_, i) => tx({ id: `t${i}`, status: "completed", amount_in: `${i}.00` }));
    const page2 = [tx({ id: "t20", kind: "withdrawal", status: "refunded", withdraw_mode: "escrow" })];
    const load = vi.fn().mockResolvedValueOnce(page1).mockResolvedValueOnce(page2);
    let session!: ReturnType<typeof useSession>;
    function Grab() {
      session = useSession();
      return null;
    }
    render(
      <SessionProvider>
        <Grab />
        <History load={load} />
      </SessionProvider>,
    );
    expect(screen.getByText(/Sign in from the wallet page/)).toBeInTheDocument();
    await act(() => session.connect());
    await act(() => session.login());
    expect(await screen.findAllByText("Deposit")).toHaveLength(20);
    await userEvent.setup().click(screen.getByRole("button", { name: "Load more" }));
    expect(load).toHaveBeenLastCalledWith(expect.any(String), "in-memory-jwt", { limit: 20, pagingId: "t19" });
    expect(await screen.findByRole("link", { name: "Escrow withdrawal" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });
});
