"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAccount, useConnect, useReadContract } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import { dailyGiveAbi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS } from "@/lib/contracts";
import { ReputationBadge } from "@/components/ReputationBadge";
import { BindFidPrompt } from "@/components/BindFidPrompt";
import { ClaimCard } from "@/components/ClaimCard";
import { TipComposer } from "@/components/TipComposer";
import { Feed } from "@/components/Feed";

export default function Home() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const [castHash, setCastHash] = useState<`0x${string}` | undefined>();

  const { data: fid } = useReadContract({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    functionName: "fid",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    (async () => {
      const context = await sdk.context;
      if (context.location?.type === "cast_embed") {
        setCastHash(context.location.cast.hash as `0x${string}`);
      }
      await sdk.actions.ready();
    })();
  }, []);

  // Prompt the client's own "add this mini app" UI right after the moment a user is most
  // bought-in (their first successful claim) rather than making them hunt for it in a menu.
  // Safe to call repeatedly: rejects quietly if the user declines or it's already added.
  function handleFirstClaim() {
    sdk.actions.addMiniApp().catch(() => {});
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 pb-24 text-white">
      <header className="flex items-center justify-between">
        <div className="text-sm text-white/60">
          {fid ? `fid ${fid.toString()}` : isConnected ? "not bound" : "not connected"}
        </div>
        <ReputationBadge address={address} />
      </header>

      <section className="rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70">
        <p>
          <span className="font-semibold text-amber-300">DailyGive</span> gives you 100{" "}
          <span className="font-medium text-white">GIVE</span> every day — spend it or lose it. Tip it to anyone on
          Farcaster; what they receive becomes permanent{" "}
          <span className="font-medium text-amber-300">GIVEN</span> reputation that can never be taken away or
          transferred.
        </p>
      </section>

      {!isConnected && connectors[0] && (
        <button
          onClick={() => connect({ connector: connectors[0] })}
          className="rounded-xl bg-white/10 py-3 font-medium hover:bg-white/20"
        >
          Connect wallet
        </button>
      )}

      <BindFidPrompt />
      <ClaimCard onClaimed={handleFirstClaim} />
      <TipComposer castHash={castHash} />

      <section>
        <h2 className="mb-2 text-xs uppercase tracking-wide text-white/40">Your recent tips</h2>
        <Feed fid={fid} />
      </section>

      <footer className="mt-auto flex justify-center gap-6 border-t border-white/10 pt-4 text-sm text-white/60">
        <Link href="/leaderboard" className="hover:text-white">
          Leaderboard
        </Link>
        {fid && (
          <Link href={`/${fid.toString()}`} className="hover:text-white">
            Your reputation
          </Link>
        )}
      </footer>
    </div>
  );
}
