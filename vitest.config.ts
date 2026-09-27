import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "jsdom",
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.{ts,tsx}"],
    testTimeout: 20_000,
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "components/**/*.tsx"],
      // Thin wrappers over browser wallets / live network, covered by the e2e smoke test.
      exclude: ["lib/wallet.ts", "lib/escrow.ts", "lib/horizon.ts", "lib/api/schema.d.ts"],
      thresholds: { lines: 80, functions: 75, branches: 70, statements: 80 },
    },
  },
});
