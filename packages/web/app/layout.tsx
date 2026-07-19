import type { Metadata } from "next";
import "./globals.css";
import { WalletContextProvider } from "@/components/WalletContextProvider";

export const metadata: Metadata = {
  title: "Final Third — World Cup Live Prediction Game",
  description:
    "A live World Cup prediction game. Read the pressure, call ATTACK or DEFENSE before the phase resolves, and build your streak — every call graded against the live TxLINE feed.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <WalletContextProvider>{children}</WalletContextProvider>
      </body>
    </html>
  );
}
