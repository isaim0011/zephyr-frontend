import type { Metadata } from "next";
import { Suspense } from "react";
import { EscrowWithdrawal } from "@/components/EscrowWithdrawal";

export const metadata: Metadata = { title: "Escrow withdrawal" };

export default function EscrowPage() {
  return (
    <Suspense>
      <EscrowWithdrawal />
    </Suspense>
  );
}
