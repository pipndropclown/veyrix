export const SUPPORTED_WALLET_NAMES = [
  "Phantom",
  "Solflare",
  "Backpack",
] as const;
export function supportedWalletName(name: string): boolean {
  return SUPPORTED_WALLET_NAMES.some((supported) => supported === name);
}
export function shortenAddress(address: string): string {
  return address.length > 10
    ? `${address.slice(0, 4)}…${address.slice(-5)}`
    : address;
}
