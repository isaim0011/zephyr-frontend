import type { Metadata } from "next";
import { Suspense } from "react";
import { InteractiveFlow } from "@/components/InteractiveFlow";

export const metadata: Metadata = { title: "Transaction status", robots: { index: false } };

export default function MoreInfoPage() {
  return (
    <Suspense>
      <InteractiveFlow readOnly />
    </Suspense>
  );
}
