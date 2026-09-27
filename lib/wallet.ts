"use client";

import { appConfig } from "./config";

/** Signs a transaction envelope (base64 XDR) and returns the signed XDR. */
export type Signer = (xdr: string) => Promise<string>;

type Kit = typeof import("@creit.tech/stellar-wallets-kit/sdk").StellarWalletsKit;
let kitPromise: Promise<Kit> | undefined;

/**
 * Stellar Wallets Kit, loaded lazily in the browser only (it touches `window`).
 * Supported wallets: Freighter, xBull, Lobstr and Albedo.
 */
function loadKit(): Promise<Kit> {
  kitPromise ??= (async () => {
    const [{ StellarWalletsKit }, { FreighterModule }, { xBullModule }, { LobstrModule }, { AlbedoModule }, types] =
      await Promise.all([
        import("@creit.tech/stellar-wallets-kit/sdk"),
        import("@creit.tech/stellar-wallets-kit/modules/freighter"),
        import("@creit.tech/stellar-wallets-kit/modules/xbull"),
        import("@creit.tech/stellar-wallets-kit/modules/lobstr"),
        import("@creit.tech/stellar-wallets-kit/modules/albedo"),
        import("@creit.tech/stellar-wallets-kit/types"),
      ]);
    StellarWalletsKit.init({
      modules: [new FreighterModule(), new xBullModule(), new LobstrModule(), new AlbedoModule()],
      network: appConfig.network === "public" ? types.Networks.PUBLIC : types.Networks.TESTNET,
    });
    return StellarWalletsKit;
  })();
  return kitPromise;
}

/** Opens the wallet picker and returns the chosen account. */
export async function connectWallet(): Promise<string> {
  const kit = await loadKit();
  const { address } = await kit.authModal();
  return address;
}

export async function disconnectWallet(): Promise<void> {
  const kit = await loadKit();
  await kit.disconnect();
}

/** A `Signer` bound to `address` on the configured network. */
export function walletSigner(address: string): Signer {
  return async (xdr) => {
    const kit = await loadKit();
    const { signedTxXdr } = await kit.signTransaction(xdr, {
      address,
      networkPassphrase: appConfig.networkPassphrase,
    });
    return signedTxXdr;
  };
}
