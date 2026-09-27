import { Client } from "@zephyr-ramp/escrow-client";
import { rpc } from "@stellar/stellar-sdk";
import { Buffer } from "buffer";
import { toStroops } from "./amount";
import { appConfig } from "./config";
import type { Signer } from "./wallet";

/** Escrow state as the wallet shows it. `none` = no escrow for this tx_id yet. */
export type EscrowState =
  | { status: "none" }
  | { status: "Locked" | "Claimed" | "Refunded"; amount: bigint; expiresLedger: number; user: string };

/** About 5 seconds per ledger on Stellar. */
export const SECONDS_PER_LEDGER = 5;

function client(contractId: string, address?: string, sign?: Signer) {
  return new Client({
    contractId,
    networkPassphrase: appConfig.networkPassphrase,
    rpcUrl: appConfig.sorobanRpcUrl,
    ...(address ? { publicKey: address } : {}),
    ...(sign
      ? { signTransaction: async (xdr: string) => ({ signedTxXdr: await sign(xdr), signerAddress: address }) }
      : {}),
  });
}

/** Hex `tx_id` (sha256 of the Zephyr transaction id) as the 32 bytes the contract expects. */
function txIdBytes(txIdHex: string) {
  if (!/^[0-9a-f]{64}$/i.test(txIdHex)) throw new Error("invalid escrow tx_id");
  return Buffer.from(txIdHex, "hex");
}

/** Contract error code for "NotFound" (see zephyr-contracts README). */
const NOT_FOUND = 6;

export async function getEscrowState(contractId: string, txIdHex: string, readAs: string): Promise<EscrowState> {
  const tx = await client(contractId, readAs).get_escrow({ tx_id: txIdBytes(txIdHex) });
  if (tx.result.isErr()) {
    const err = tx.result.unwrapErr() as { code?: number };
    if (err?.code === NOT_FOUND) return { status: "none" };
    throw new Error(`get_escrow failed: ${JSON.stringify(err)}`);
  }
  const e = tx.result.unwrap();
  return { status: e.status.tag, amount: e.amount, expiresLedger: e.expires_ledger, user: e.user };
}

/**
 * Locks `amount` USDC for `txIdHex`: builds the escrow `deposit` call with the
 * generated bindings, has the wallet sign it and submits it. Returns the tx hash.
 */
export async function lockFunds(input: {
  contractId: string;
  address: string;
  sign: Signer;
  txIdHex: string;
  amount: string;
  timeoutLedgers: number;
}): Promise<string> {
  const tx = await client(input.contractId, input.address, input.sign).deposit({
    user: input.address,
    tx_id: txIdBytes(input.txIdHex),
    amount: toStroops(input.amount),
    timeout_ledgers: input.timeoutLedgers,
  });
  return send(tx, "deposit");
}

/** Refunds an expired escrow to its user. Anyone may call it; the user's wallet signs as fee payer. */
export async function refundEscrow(input: {
  contractId: string;
  address: string;
  sign: Signer;
  txIdHex: string;
}): Promise<string> {
  const tx = await client(input.contractId, input.address, input.sign).refund({ tx_id: txIdBytes(input.txIdHex) });
  return send(tx, "refund");
}

export async function latestLedger(): Promise<number> {
  const server = new rpc.Server(appConfig.sorobanRpcUrl);
  return (await server.getLatestLedger()).sequence;
}

type Assembled = Awaited<ReturnType<ReturnType<typeof client>["refund"]>>;

async function send(tx: Assembled, fn: string): Promise<string> {
  if (tx.result.isErr()) throw new Error(`${fn} would fail: ${JSON.stringify(tx.result.unwrapErr())}`);
  const sent = await tx.signAndSend();
  const hash = sent.getTransactionResponse?.txHash ?? sent.sendTransactionResponse?.hash;
  if (!hash) throw new Error(`${fn}: no transaction hash`);
  return hash;
}

/** Rough wall-clock time until `ledger`, for display only. */
export function ledgerEta(ledger: number, current: number, now = new Date()): Date {
  return new Date(now.getTime() + (ledger - current) * SECONDS_PER_LEDGER * 1000);
}
