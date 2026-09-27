import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { InteractiveFlow } from "@/components/InteractiveFlow";
import { view } from "./fixtures";

let search = new URLSearchParams();
vi.mock("next/navigation", () => ({ useSearchParams: () => search }));

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

describe("InteractiveFlow", () => {
  let fetchMock: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    search = new URLSearchParams({ transaction_id: "tx1", token: "tok", lang: "en" });
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("loads, submits the form and shows deposit instructions", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, view()))
      .mockResolvedValueOnce(
        json(
          200,
          view(
            { editable: false, deposit_instructions: { reference: "ZEPHYR-TX1" } },
            { status: "pending_user_transfer_start", amount_in: "100.00", amount_fee: "1.50", amount_out: "98.50" },
          ),
        ),
      );
    render(<InteractiveFlow />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading…");

    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (USD)"), "100");
    await user.type(screen.getByLabelText("Full name"), "Ada");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));

    expect(await screen.findByText("ZEPHYR-TX1")).toBeInTheDocument();
    const [url, init] = fetchMock.mock.calls[1]!;
    expect(url).toBe("/api/interactive/tx1");
    expect(init.method).toBe("POST");
    expect(init.headers.authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body)).toEqual({ amount: "100", name: "Ada", email: "ada@example.com" });
  });

  it("shows server validation errors without leaving the form", async () => {
    fetchMock
      .mockResolvedValueOnce(json(200, view()))
      .mockResolvedValueOnce(json(400, { error: "amount does not cover the fee" }));
    render(<InteractiveFlow />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (USD)"), "5");
    await user.type(screen.getByLabelText("Full name"), "Ada");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("amount does not cover the fee");
    expect(screen.getByLabelText("Amount (USD)")).toBeInTheDocument();
  });

  it("explains an expired session and a missing token", async () => {
    fetchMock.mockResolvedValueOnce(json(403, { error: "interactive session expired or invalid" }));
    render(<InteractiveFlow />);
    expect(await screen.findByRole("alert")).toHaveTextContent("This link has expired");

    search = new URLSearchParams();
    render(<InteractiveFlow />);
    expect((await screen.findAllByRole("alert"))[1]).toHaveTextContent("This link has expired");
  });

  it("offers a retry after a network error", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(json(200, view()));
    render(<InteractiveFlow />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach the anchor");
    await userEvent.setup().click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Amount (USD)")).toBeInTheDocument();
  });

  it("posts the transaction to the wallet on status change (callback=postMessage)", async () => {
    search = new URLSearchParams({ transaction_id: "tx1", token: "tok", callback: "postMessage" });
    const opener = { postMessage: vi.fn() };
    vi.stubGlobal("opener", opener);
    const done = view({ editable: false }, { status: "pending_user_transfer_start" });
    fetchMock.mockResolvedValueOnce(json(200, view())).mockResolvedValueOnce(json(200, done));
    render(<InteractiveFlow />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText("Amount (USD)"), "10");
    await user.type(screen.getByLabelText("Full name"), "Ada");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Continue" }));
    await screen.findByRole("heading", { name: "Transaction status" });
    expect(opener.postMessage).toHaveBeenCalledWith({ transaction: done.transaction }, "*");
  });

  it("renders the read-only more_info view even when editable", async () => {
    fetchMock.mockResolvedValueOnce(json(200, view()));
    render(<InteractiveFlow readOnly />);
    expect(await screen.findByRole("heading", { name: "Transaction status" })).toBeInTheDocument();
    expect(screen.queryByLabelText("Amount (USD)")).toBeNull();
  });
});
