# Security Policy

Zephyr moves money, and this app asks users to sign Stellar transactions. We take reports seriously.

> **Status:** testnet only and **not audited**. Do not use it with real funds.

## Reporting a vulnerability

**Never open a public issue, discussion or pull request for a vulnerability.**

1. **GitHub Security Advisories (preferred):** [open a private advisory](https://github.com/zephyr-ramp/zephyr-frontend/security/advisories/new).
2. **Email:** the security contact listed on the [zephyr-ramp organization profile](https://github.com/zephyr-ramp).

Include the affected page or module, the commit, what an attacker could do, and steps to reproduce.

## What to expect

| Step                                           | Target          |
| ---------------------------------------------- | --------------- |
| Acknowledge your report                        | 3 business days |
| Initial assessment and severity                | 7 days          |
| Fix, or a mitigation plan, for critical issues | 30 days         |

## Scope

In scope:

- tricking a user into signing something other than a SEP-10 challenge, an escrow `deposit`/`refund` or a USDC trustline;
- locking funds into a contract other than the configured escrow;
- leaking the SEP-10 JWT or the interactive token (storage, logs, referrers, third-party requests);
- cross-site scripting in the interactive pages;
- `postMessage` handling that trusts the wrong origin.

Out of scope: vulnerabilities in wallets themselves, and testnet availability.
