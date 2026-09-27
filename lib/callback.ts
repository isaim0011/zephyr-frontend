import type { Transaction } from "./api/client";

/**
 * SEP-24 wallet callback. Wallets can add `callback` to the interactive URL:
 * - `postMessage`: post `{ transaction }` to the window that opened us (popup)
 *   or our parent (iframe/webview);
 * - an https URL: POST `{ transaction }` JSON to it.
 */
export function notifyWallet(callback: string | null, transaction: Transaction, win: Window = window): void {
  if (!callback) return;
  const message = { transaction };

  if (callback === "postMessage") {
    const target = win.opener ?? (win.parent !== win ? win.parent : null);
    target?.postMessage(message, "*");
    return;
  }

  let url: URL;
  try {
    url = new URL(callback);
  } catch {
    return;
  }
  if (url.protocol !== "https:") return;
  void fetch(url, {
    method: "POST",
    mode: "no-cors",
    headers: { "content-type": "text/plain" },
    body: JSON.stringify(message),
  }).catch(() => {});
}
