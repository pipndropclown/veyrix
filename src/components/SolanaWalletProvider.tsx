"use client";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import type { ReactNode } from "react";

const PUBLIC_RPC = "https://api.mainnet-beta.solana.com";
export function SolanaWalletProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={PUBLIC_RPC}>
      <WalletProvider wallets={[]} autoConnect={false}>
        {children}
      </WalletProvider>
    </ConnectionProvider>
  );
}
