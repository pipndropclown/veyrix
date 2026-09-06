import type { Metadata } from "next";
import "./globals.css";
import { SolanaWalletProvider } from "@/components/SolanaWalletProvider";
import { ThemeProvider } from "@/components/ThemeProvider";
export const metadata: Metadata = {
  title: "Veyrix — Autonomous Strategy Research Lab",
  description:
    "Paper trading, blockchain strategy research, historical backtesting, and robustness validation without real-money execution.",
  icons: { icon: "/brand/veyrix-mark.png", shortcut: "/brand/veyrix-mark.png" },
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <ThemeProvider><SolanaWalletProvider>{children}</SolanaWalletProvider></ThemeProvider>
      </body>
    </html>
  );
}
