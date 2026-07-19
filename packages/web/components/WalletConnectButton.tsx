"use client";

import { usePrivy } from "@privy-io/react-auth";

export function WalletConnectButton() {
  const { ready, authenticated, login, logout, user } = usePrivy();

  if (!ready) return null;

  if (authenticated) {
    const label = user?.wallet?.address
      ? `${user.wallet.address.slice(0, 4)}...${user.wallet.address.slice(-4)}`
      : "Connected";

    return (
      <button
        onClick={logout}
        className="rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/12"
      >
        {label}
      </button>
    );
  }

  return (
    <button
      onClick={login}
      className="rounded-full bg-white/8 px-3 py-1.5 text-[13px] font-semibold text-white/70 transition-colors hover:bg-white/12"
    >
      Connect Wallet
    </button>
  );
}
