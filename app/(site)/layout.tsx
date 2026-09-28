"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { SessionProvider } from "@/components/SessionProvider";
import { ThemeToggle } from "@/components/ThemeToggle";
import { appConfig } from "@/lib/config";
import { I18nProvider, useI18n } from "@/lib/i18n";

function Chrome({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  return (
    <>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:rounded focus:bg-surface focus:p-2"
      >
        {t("app.skipToContent")}
      </a>
      {appConfig.network === "testnet" ? (
        <p className="bg-surface px-4 py-2 text-center text-sm text-warn">{t("app.testnetBanner")}</p>
      ) : null}
      <header className="border-b border-line">
        <nav aria-label="Main" className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link href="/" className="mr-auto text-lg font-bold">
            {t("app.name")}
          </Link>
          <span
            data-testid="network-badge"
            aria-label={appConfig.network === "testnet" ? "Testnet" : "Mainnet"}
            className={`rounded px-2 py-0.5 text-xs font-medium ${
              appConfig.network === "testnet"
                ? "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                : "bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-amber-100"
            }`}
          >
            {t(`app.networkBadge.${appConfig.network}`)}
          </span>
          <Link href="/app" className="underline-offset-4 hover:underline">
            {t("app.nav.wallet")}
          </Link>
          <Link href="/app/history" className="underline-offset-4 hover:underline">
            {t("app.nav.history")}
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-3xl px-4 py-8">
        {children}
      </main>
    </>
  );
}

export default function SiteLayout({ children }: { children: ReactNode }) {
  return (
    <I18nProvider lang="en">
      <SessionProvider>
        <Chrome>{children}</Chrome>
      </SessionProvider>
    </I18nProvider>
  );
}