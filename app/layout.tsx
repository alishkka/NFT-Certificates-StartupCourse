import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NFTStart — Solana Certificate Console",
  description: "Create and verify educational NFT certificates on Solana Devnet.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
