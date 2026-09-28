# Contributing to Zephyr Frontend

Thanks for helping build an open USD ⇄ USDC ramp on Stellar.

## Setup

Requirements: Node.js 20+.

```bash
git clone https://github.com/<you>/zephyr-frontend
cd zephyr-frontend
npm install
cp .env.example .env.local
npm test
```

Tests run **offline**: the backend is mocked with `fetch` stubs, and wallets are mocked with `vi.mock("@/lib/wallet")`. For the UI against a real anchor, run [zephyr-backend](https://github.com/zephyr-ramp/zephyr-backend) locally and `npm run dev`.

## Picking up an issue

1. Find an issue labelled `good first issue` or `help wanted`.
2. Comment on it, or apply through Drips Wave if it's a Wave issue, and **wait to be assigned before starting**.
3. One issue per PR. Ask in the thread if something is unclear.

### Drips Wave

| Label                 | Points | Typical scope                             |
| --------------------- | ------ | ----------------------------------------- |
| `complexity: trivial` | 100    | Copy, docs, a translation, a small UI fix |
| `complexity: medium`  | 150    | A component or feature, with tests        |
| `complexity: high`    | 200    | A new flow or integration                 |

Points are awarded when your PR is merged and the issue is resolved **during an active Wave**.

## Branches, commits and PRs

- Branch from `main`: `feat/…`, `fix/…`, `docs/…`, `test/…`.
- [Conventional Commits](https://www.conventionalcommits.org), with small, logical commits.
- Fill in the PR template, link the issue, and add light and dark screenshots at 360px for UI changes.

## Commands

| Command                                                 | What it does                                                       |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `npm run dev`                                           | Dev server on :3000                                                |
| `npm test` / `npm run test:coverage`                    | Vitest component and unit tests                                    |
| `npm run test:e2e`                                      | Playwright smoke test (run `npx playwright install chromium` once) |
| `npm run lint` / `npm run format` / `npm run typecheck` | Checks                                                             |
| `npm run api:types`                                     | Regenerate API types from `../zephyr-backend/openapi.yaml`         |
| `npm run bindings:update`                               | Re-vendor the escrow client from `../zephyr-contracts`             |

## Rules

- **Strings:** every user-facing string lives in `lib/i18n/en.ts`, and you read it with `t("key")`. To add a language, copy `en.ts`, translate it, and register it in `lib/i18n/index.tsx`.
- **Accessibility (WCAG 2.1 AA):** use real labels, keyboard-reachable controls, visible focus and ≥ 44px targets. Announce async changes. New components get a test with `expectNoA11yViolations`.
- **Mobile-first:** everything must work at 360px wide without horizontal scrolling.
- **Money:** use `lib/amount.ts` (BigInt), never floats. Fees must match the backend's formula.
- **Security:** never store the JWT (no localStorage, sessionStorage or cookies). Only sign what `lib/auth.ts` / `lib/escrow.ts` build. Never render HTML from the API.
- **API types** come from the backend's OpenAPI spec. Don't hand-edit `lib/api/schema.d.ts`.

## Maintainers

| Maintainer | GitHub                               |
| ---------- | ------------------------------------ |
| N-thnI     | [@N-thnI](https://github.com/N-thnI) |
| nixx       | [@N-i-xx](https://github.com/N-i-xx) |

Maintainers assign issues, review PRs (see `.github/CODEOWNERS`) and handle security and conduct reports sent to [niheanyi404@gmail.com](mailto:niheanyi404@gmail.com).

## Security

Never report vulnerabilities in public issues. See [SECURITY.md](SECURITY.md).

## Code of Conduct

This project follows the [Contributor Covenant 2.1](CODE_OF_CONDUCT.md).
