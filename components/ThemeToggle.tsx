"use client";

import { useSyncExternalStore } from "react";
import { useI18n } from "@/lib/i18n";

type Theme = "light" | "dark";
const EVENT = "zephyr-theme-change";

/** Inline script run before paint so the saved theme applies without a flash. */
export const THEME_SCRIPT = `try{var t=localStorage.getItem("zephyr-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

function currentTheme(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "light" || set === "dark") return set;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const media = window.matchMedia?.("(prefers-color-scheme: dark)");
  window.addEventListener(EVENT, onChange);
  media?.addEventListener?.("change", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    media?.removeEventListener?.("change", onChange);
  };
}

export function ThemeToggle() {
  const { t } = useI18n();
  // null on the server; the real theme after hydration.
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);

  function toggle() {
    const next: Theme = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("zephyr-theme", next);
    } catch {
      // Storage may be blocked (private mode); the toggle still works for this page.
    }
    window.dispatchEvent(new Event(EVENT));
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={theme === "dark"}
      className="min-h-11 rounded-lg border border-line px-3 text-sm font-semibold hover:border-accent"
    >
      <span className="sr-only">{t("app.theme.toggle")}: </span>
      {theme === "dark" ? t("app.theme.dark") : t("app.theme.light")}
    </button>
  );
}
