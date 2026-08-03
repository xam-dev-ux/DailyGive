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

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dailygive.example";

/// Embed metadata for the cast preview when this URL is shared. `fc:miniapp` is the only tag
/// emitted — the official troubleshooting checklist explicitly lists `fc:frame` on a new
/// implementation as a common agent mistake, so it's deliberately NOT included here.
///
/// `imageUrl` must be 3:2 and 600x400-3000x2000px per spec — deliberately NOT the same asset as
/// `splashImageUrl` below, which must be ~200x200 square. Conflating the two was a bug caught by
/// auditing against the full spec (llms-full.txt) — og-image.png (1200x800) is dedicated to this.
const embed = JSON.stringify({
  version: "1",
  imageUrl: `${appUrl}/og-image.png`,
  button: {
    title: "Open DailyGive",
    action: {
      type: "launch_frame",
      name: "DailyGive",
      url: appUrl,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#0b0b0f",
    },
  },
});

export const metadata: Metadata = {
  title: "DailyGive",
  description: "Claim 100 GIVE daily, tip any Farcaster user. Received tips become permanent GIVEN reputation.",
  other: {
    "fc:miniapp": embed,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
