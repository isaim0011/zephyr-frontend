import type { Metadata } from "next";
import { WalletHome } from "@/components/WalletHome";

export const metadata: Metadata = { title: "Wallet" };

export default function WalletPage() {
  return <WalletHome />;
}
