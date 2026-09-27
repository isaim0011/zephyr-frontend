import type { ReactNode } from "react";

/** Minimal chrome for wallet popups and webviews (works down to 320px wide). */
export default function InteractiveLayout({ children }: { children: ReactNode }) {
  return (
    <main id="main" className="mx-auto max-w-md px-4 py-6">
      {children}
    </main>
  );
}
