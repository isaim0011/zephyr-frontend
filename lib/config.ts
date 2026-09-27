/**
 * Public runtime configuration. `NEXT_PUBLIC_*` values are inlined at build
 * time, so each one must be referenced literally here.
 */
const network = process.env.NEXT_PUBLIC_NETWORK === "public" ? "public" : "testnet";

export const appConfig = {
  anchorUrl: (process.env.NEXT_PUBLIC_ANCHOR_URL ?? "http://localhost:8080").replace(/\/+$/, ""),
  network,
  networkPassphrase:
    network === "public" ? "Public Global Stellar Network ; September 2015" : "Test SDF Network ; September 2015",
  horizonUrl: network === "public" ? "https://horizon.stellar.org" : "https://horizon-testnet.stellar.org",
  sorobanRpcUrl: process.env.NEXT_PUBLIC_SOROBAN_RPC_URL ?? "https://soroban-testnet.stellar.org",
  escrowContractId: process.env.NEXT_PUBLIC_ESCROW_CONTRACT_ID || undefined,
  usdc: {
    code: "USDC",
    issuer: process.env.NEXT_PUBLIC_USDC_ISSUER ?? "GBBD47IF6LWK7P7MDEVSCWR7DPUWV3NY3DTQEVFL4NAT4AQH3ZLLFLA5",
  },
} as const;

export type AppConfig = typeof appConfig;
