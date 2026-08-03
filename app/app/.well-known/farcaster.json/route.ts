import { NextResponse } from "next/server";

/// Serves the Mini App manifest. Field set matches the current spec at
/// miniapps.farcaster.xyz/docs/specification (confirmed in Phase 0 research — NOT the
/// docs.farcaster.xyz/developers/mini-apps/* paths, which 404 as of this writing).
/// `imageUrl` / `buttonTitle` at the top level are deprecated; the embed's button/image live in
/// the `fc:miniapp` meta tag instead (see app/layout.tsx).
export async function GET() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "https://dailygive.example";
  const neynarClientId = process.env.NEYNAR_CLIENT_ID;

  const manifest = {
    // Filled in via the Farcaster Manifest tool (warpcast.com/~/developers/mini-apps/manifest)
    // once the domain is live — see PUBLISH.md step 7. Placeholder until then.
    accountAssociation: {
      header: process.env.FARCASTER_ACCOUNT_ASSOCIATION_HEADER ?? "",
      payload: process.env.FARCASTER_ACCOUNT_ASSOCIATION_PAYLOAD ?? "",
      signature: process.env.FARCASTER_ACCOUNT_ASSOCIATION_SIGNATURE ?? "",
    },
    miniapp: {
      version: "1",
      name: "DailyGive",
      homeUrl: appUrl,
      iconUrl: `${appUrl}/icon-1024.png`,
      splashImageUrl: `${appUrl}/splash.png`,
      splashBackgroundColor: "#0b0b0f",
      // Neynar manages notification-token lifecycle automatically when webhookUrl points here —
      // no need to host our own webhook receiver (see Phase 0 research notes).
      webhookUrl: neynarClientId ? `https://api.neynar.com/f/app/${neynarClientId}/event` : undefined,
      subtitle: "Daily GIVE, permanent GIVEN",
      description: "Claim 100 GIVE daily, tip any Farcaster user. Received tips become permanent GIVEN reputation.",
      primaryCategory: "social",
      tags: ["social", "tipping", "b20", "base"],
      canonicalDomain: new URL(appUrl).hostname,
      // eip155:84532 = Base Sepolia. Update to eip155:8453 (Base mainnet) alongside the
      // NEXT_PUBLIC_CHAIN_ID / contract-address env vars when promoting per PUBLISH.md's
      // mainnet section — this and those must move together, never independently.
      requiredChains: [`eip155:${process.env.NEXT_PUBLIC_CHAIN_ID ?? "84532"}`],
    },
  };

  return NextResponse.json(manifest);
}
