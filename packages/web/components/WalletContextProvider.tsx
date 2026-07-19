"use client";

import { PrivyProvider } from "@privy-io/react-auth";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "cmrrzuvog00xo0cl4nmanmhbl";

export function WalletContextProvider({ children }: { children: React.ReactNode }) {
  return (
    <PrivyProvider
      appId={PRIVY_APP_ID}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#2563eb",
          walletList: ["phantom", "rabby_wallet", "metamask", "detected_wallets"],
        },
        loginMethods: ["wallet"],
        embeddedWallets: {
          solana: { createOnLogin: "all-users" },
        },
      }}
    >
      {children}
    </PrivyProvider>
  );
}
