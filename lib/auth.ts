import { TransactionBuilder } from "@stellar/stellar-sdk";
import { exchangeChallenge, getChallenge } from "./api/client";
import type { Signer } from "./wallet";

/**
 * SEP-10: fetch a challenge for `address`, check it is what the wallet is
 * about to sign, have the wallet sign it, and exchange it for a JWT.
 *
 * The JWT is returned to the caller, which keeps it in memory only (React
 * state), never in localStorage or cookies.
 */
export async function sep10Login(anchorUrl: string, address: string, sign: Signer): Promise<string> {
  const { transaction, network_passphrase } = await getChallenge(anchorUrl, address);

  // Defence in depth: a challenge must be a zero-sequence tx whose operations
  // are all manage_data. Never sign anything that could move funds.
  const tx = TransactionBuilder.fromXDR(transaction, network_passphrase);
  if ("innerTransaction" in tx) throw new Error("unexpected fee-bump challenge");
  if (tx.sequence !== "0" || tx.operations.some((op) => op.type !== "manageData")) {
    throw new Error("refusing to sign: this is not a SEP-10 challenge");
  }

  const signed = await sign(transaction);
  return exchangeChallenge(anchorUrl, signed);
}
