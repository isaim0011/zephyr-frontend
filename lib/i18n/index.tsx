"use client";

import { createContext, type ReactNode, useContext, useMemo } from "react";
import { en, type Messages } from "./en";

/** Registered languages. English is the fallback for anything missing. */
const dictionaries: Record<string, Messages> = { en };

export const SUPPORTED_LANGS = Object.keys(dictionaries);

type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;
type Paths<T> = T extends string ? never : { [K in keyof T]: T[K] extends string ? K : Join<K, Paths<T[K]>> }[keyof T];
export type MessageKey = Paths<Messages>;

export function pickLang(lang: string | null | undefined): string {
  const base = lang?.toLowerCase().split(/[-_]/)[0] ?? "";
  return base in dictionaries ? base : "en";
}

function lookup(dict: Messages, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

export function translate(lang: string, key: MessageKey, vars?: Record<string, string | number>): string {
  const template = lookup(dictionaries[lang] ?? en, key) ?? lookup(en, key) ?? key;
  return template.replace(/\{(\w+)\}/g, (_, name: string) => String(vars?.[name] ?? `{${name}}`));
}

type T = (key: MessageKey, vars?: Record<string, string | number>) => string;
const I18nContext = createContext<{ lang: string; t: T }>({ lang: "en", t: (k, v) => translate("en", k, v) });

export function I18nProvider({ lang, children }: { lang?: string | null; children: ReactNode }) {
  const value = useMemo(() => {
    const picked = pickLang(lang);
    return { lang: picked, t: ((k, v) => translate(picked, k, v)) as T };
  }, [lang]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
