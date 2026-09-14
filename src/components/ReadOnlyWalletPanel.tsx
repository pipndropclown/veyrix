"use client";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { SectionHeader } from "./SectionHeader";
import { shortenAddress, supportedWalletName, SUPPORTED_WALLET_NAMES } from "@/lib/wallet/walletIdentity";

export function ReadOnlyWalletPanel() {
  const { connection } = useConnection();
  const {
    wallets,
    wallet,
    publicKey,
    connected,
    connecting,
    select,
    connect,
    disconnect,
  } = useWallet();
  const [error, setError] = useState<string | null>(null);
  const [balance, setBalance] = useState<{ address: string; sol: number } | null>(null);
  const address = publicKey?.toBase58() ?? null;
  const displayedBalance = balance?.address === address ? balance.sol : null;
  const available = useMemo(
    () => wallets.filter((item) => supportedWalletName(item.adapter.name)),
    [wallets],
  );
  useEffect(() => {
    if (!publicKey || !address) return;
    let active = true;
    connection
      .getBalance(publicKey)
      .then((lamports) => {
        if (active) setBalance({ address, sol: lamports / 1_000_000_000 });
      })
      .catch(() => {
        if (active) {
          setBalance(null);
          setError("Wallet balance is temporarily unavailable.");
        }
      });
    return () => {
      active = false;
    };
  }, [connection, publicKey, address]);
  const choose = useCallback(
    async (name: string) => {
      setError(null);
      try {
        const candidate = available.find((item) => item.adapter.name === name);
        if (!candidate) throw new Error();
        select(candidate.adapter.name);
        window.setTimeout(
          () =>
            void connect().catch(() =>
              setError("Connection was rejected or the wallet is unavailable."),
            ),
          0,
        );
      } catch {
        setError(
          "Install or unlock the selected wallet extension, then try again.",
        );
      }
    },
    [available, connect, select],
  );
  return (
    <section className="panel wallet-panel">
      <SectionHeader
        eyebrow="Identity only · no signing"
        title="Connected wallet"
      />
      {connected && publicKey ? (
        <>
          <div className="wallet-identity">
            <strong>{wallet?.adapter.name ?? "Solana wallet"}</strong>
            <span>{shortenAddress(publicKey.toBase58())}</span>
            <small>READ-ONLY</small>
          </div>
          <dl>
            <div>
              <dt>Public SOL balance</dt>
              <dd>
                {displayedBalance === null ? "Unavailable" : `${displayedBalance.toFixed(4)} SOL`}
              </dd>
            </div>
            <div>
              <dt>Paper account impact</dt>
              <dd>None</dd>
            </div>
          </dl>
          <button type="button" onClick={() => void disconnect()}>
            DISCONNECT
          </button>
        </>
      ) : (
        <>
          <p className="wallet-copy">
            Connect a supported extension to display public identity and balance
            only.
          </p>
          <div className="wallet-actions">
          {SUPPORTED_WALLET_NAMES.map((name) => (
              <button
                key={name}
                type="button"
                disabled={connecting}
                onClick={() => void choose(name)}
              >
                {name.toUpperCase()}
              </button>
            ))}
          </div>
          {available.length === 0 && (
            <small>
              No supported wallet extension detected. The paper terminal remains
              fully available.
            </small>
          )}
        </>
      )}
      {error && (
        <p className="backtest-error" role="alert">
          {error}
        </p>
      )}
      <div className="wallet-separation">
        <strong>VEYRIX PAPER ACCOUNT</strong>
        <span>$10,000 Virtual USDC</span>
        <small>
          Connected wallet funds are not used by Veyrix paper trading.
        </small>
      </div>
    </section>
  );
}
