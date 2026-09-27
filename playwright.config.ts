import { defineConfig, devices } from "@playwright/test";

// Smoke test against the production build with a mocked backend (page.route).
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: "http://127.0.0.1:3100", trace: "retain-on-failure" },
  projects: [{ name: "mobile-360", use: { ...devices["Pixel 5"], viewport: { width: 360, height: 740 } } }],
  webServer: {
    command: "npm run build && npx next start -p 3100 -H 127.0.0.1",
    url: "http://127.0.0.1:3100",
    timeout: 300_000,
    reuseExistingServer: !process.env.CI,
    env: { NEXT_PUBLIC_ANCHOR_URL: "http://127.0.0.1:9", NEXT_PUBLIC_NETWORK: "testnet" },
  },
});
