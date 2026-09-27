"use client";

import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { sep10Login } from "@/lib/auth";
import { appConfig } from "@/lib/config";
import { connectWallet, disconnectWallet, type Signer, walletSigner } from "@/lib/wallet";

export interface Session {
  address: string | null;
  /** SEP-10 JWT. Held in memory only: a reload signs you out, by design. */
  jwt: string | null;
  signer: Signer | null;
  connect(): Promise<void>;
  login(): Promise<void>;
  logout(): Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [jwt, setJwt] = useState<string | null>(null);

  const signer = useMemo(() => (address ? walletSigner(address) : null), [address]);

  const connect = useCallback(async () => {
    const next = await connectWallet();
    setAddress(next);
    setJwt(null);
  }, []);

  const login = useCallback(async () => {
    if (!address || !signer) throw new Error("connect a wallet first");
    setJwt(await sep10Login(appConfig.anchorUrl, address, signer));
  }, [address, signer]);

  const logout = useCallback(async () => {
    setJwt(null);
    setAddress(null);
    await disconnectWallet().catch(() => {});
  }, []);

  const value = useMemo(
    () => ({ address, jwt, signer, connect, login, logout }),
    [address, jwt, signer, connect, login, logout],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used inside <SessionProvider>");
  return session;
}
