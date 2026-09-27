import type { Metadata } from "next";
import { Suspense } from "react";
import { InteractiveFlow } from "@/components/InteractiveFlow";

export const metadata: Metadata = { title: "Deposit", robots: { index: false } };

export default function Page() {
  return (
    <Suspense>
      <InteractiveFlow />
    </Suspense>
  );
}
