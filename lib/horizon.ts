import { Asset, BASE_FEE, Horizon, NotFoundError, Operation, TransactionBuilder } from "@stellar/stellar-sdk";
import { appConfig } from "./config";
import type { Signer } from "./wallet";

export interface AccountState {
  exists: boolean;
  hasTrustline: boolean;
  /** Decimal string, e.g. "12.5000000". */
  usdcBalance: string | null;
}

const server = () => new Horizon.Server(appConfig.horizonUrl);
const usdc = () => new Asset(appConfig.usdc.code, appConfig.usdc.issuer);

export async function loadAccountState(address: string): Promise<AccountState> {
  try {
    const account = await server().loadAccount(address);
    const line = account.balances.find(
      (b) =>
        (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") &&
        b.asset_code === appConfig.usdc.code &&
        b.asset_issuer === appConfig.usdc.issuer,
    );
    return { exists: true, hasTrustline: Boolean(line), usdcBalance: line ? line.balance : null };
  } catch (err) {
    if (err instanceof NotFoundError) return { exists: false, hasTrustline: false, usdcBalance: null };
    throw err;
  }
}

/** Builds, signs (in the wallet) and submits a `changeTrust` for USDC. Returns the tx hash. */
export async function addUsdcTrustline(address: string, sign: Signer): Promise<string> {
  const s = server();
  const account = await s.loadAccount(address);
  const tx = new TransactionBuilder(account, { fee: BASE_FEE, networkPassphrase: appConfig.networkPassphrase })
    .addOperation(Operation.changeTrust({ asset: usdc() }))
    .setTimeout(180)
    .build();
  const signed = TransactionBuilder.fromXDR(await sign(tx.toXDR()), appConfig.networkPassphrase);
  const result = await s.submitTransaction(signed);
  return result.hash;
}
