import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "TickETH — Blockchain NFT Ticketing",
    template: "%s | TickETH",
  },
  description:
    "Secure, transparent, fraud-resistant event ticketing on Polygon. Mint NFT tickets, verify ownership, and check in seamlessly.",
  keywords: ["NFT", "ticketing", "blockchain", "Polygon", "events", "Web3", "TickETH", "crypto tickets"],
  authors: [{ name: "TickETH" }],
  openGraph: {
    type: "website",
    siteName: "TickETH",
    title: "TickETH — Blockchain NFT Ticketing",
    description: "Secure, transparent, fraud-resistant event ticketing on Polygon.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "TickETH — Blockchain NFT Ticketing",
    description: "Secure, transparent, fraud-resistant event ticketing on Polygon.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
