"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function Landing() {
  const { t } = useI18n();
  return (
    <section className="space-y-6">
      <h1 className="text-3xl font-bold">{t("landing.title")}</h1>
      <p className="text-lg text-muted">{t("app.tagline")}</p>
      <p>{t("landing.body")}</p>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link href="/app" className="btn-primary sm:w-auto">
          {t("landing.openWallet")}
        </Link>
        <a href="https://github.com/zephyr-ramp" className="btn-secondary sm:w-auto">
          {t("landing.github")}
        </a>
      </div>
    </section>
  );
}
