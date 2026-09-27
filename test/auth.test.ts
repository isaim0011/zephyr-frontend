// @vitest-environment node
// The Stellar SDK's XDR checks use Node's Uint8Array; jsdom's differs, so this file runs in node.
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder, WebAuth } from "@stellar/stellar-sdk";
import { afterEach, describe, expect, it, vi } from "vitest";
import { sep10Login } from "@/lib/auth";

const server = Keypair.random();
const client = Keypair.random();
const signerFor = (kp: Keypair) => async (xdr: string) => {
  const t = TransactionBuilder.fromXDR(xdr, Networks.TESTNET);
  t.sign(kp);
  return t.toXDR();
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => vi.unstubAllGlobals());

describe("SEP-10 login", () => {
  it("fetches the challenge, signs it and returns the JWT", async () => {
    const challenge = WebAuth.buildChallengeTx(
      server,
      client.publicKey(),
      "anchor.test",
      300,
      Networks.TESTNET,
      "anchor.test",
    );
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(json({ transaction: challenge, network_passphrase: Networks.TESTNET }))
      .mockResolvedValueOnce(json({ token: "jwt-123" }));
    vi.stubGlobal("fetch", fetchMock);

    const token = await sep10Login("https://anchor.test", client.publicKey(), signerFor(client));

    expect(token).toBe("jwt-123");
    expect(fetchMock.mock.calls[0]![0]).toBe(`https://anchor.test/auth?account=${client.publicKey()}`);
    const posted = JSON.parse(fetchMock.mock.calls[1]![1].body).transaction;
    // The server can verify our signature on what we posted.
    expect(
      WebAuth.verifyChallengeTxSigners(
        posted,
        server.publicKey(),
        Networks.TESTNET,
        [client.publicKey()],
        "anchor.test",
        "anchor.test",
      ),
    ).toEqual([client.publicKey()]);
  });

  it("refuses to sign something that isn't a challenge", async () => {
    const payment = new TransactionBuilder(new Account(server.publicKey(), "-1"), {
      fee: "100",
      networkPassphrase: Networks.TESTNET,
    })
      .addOperation(Operation.payment({ destination: server.publicKey(), asset: Asset.native(), amount: "1000" }))
      .setTimeout(300)
      .build()
      .toXDR();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValueOnce(json({ transaction: payment, network_passphrase: Networks.TESTNET })),
    );
    const sign = vi.fn();
    await expect(sep10Login("https://anchor.test", client.publicKey(), sign)).rejects.toThrow(/not a SEP-10 challenge/);
    expect(sign).not.toHaveBeenCalled();
  });
});
