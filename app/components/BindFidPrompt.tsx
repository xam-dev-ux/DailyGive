"use client";

import { useEffect, useState } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
import { sdk } from "@farcaster/miniapp-sdk";
import { dailyGiveAbi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS } from "@/lib/contracts";
import { BUILDER_CODE_DATA_SUFFIX } from "@/lib/builderCode";

/// First-run identity binding: gets a Farcaster Quick Auth token from the SDK, has the server
/// verify it and sign an EIP-712 attestation (see app/api/quickauth/route.ts), then submits
/// `bindFid` on-chain. Wallet connect proves control of the address; Quick Auth proves the FID —
/// both are required, neither substitutes for the other.
export function BindFidPrompt() {
  const { address } = useAccount();
  const [status, setStatus] = useState<"idle" | "authenticating" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { data: fid, refetch: refetchFid } = useReadContract({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    functionName: "fid",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { writeContract: bindFid, data: bindHash, isPending: binding } = useWriteContract();
  const { isSuccess: bound } = useWaitForTransactionReceipt({ hash: bindHash });

  // ClaimCard and page.tsx read this same `fid` query independently — same key, so refetching
  // here updates their cache too. Without this, the bind confirms on-chain but the UI (Claim
  // button, header) stays stale until something else happens to trigger a refetch (e.g.
  // navigating away and back) — reported live, exactly that symptom.
  useEffect(() => {
    if (bound) refetchFid();
  }, [bound, refetchFid]);

  async function handleBind() {
    if (!address) return;
    setStatus("authenticating");
    setErrorMessage(null);
    try {
      const { token } = await sdk.quickAuth.getToken();
      const res = await fetch("/api/quickauth", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token, walletAddress: address }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Quick Auth failed");
      const { fid: verifiedFid, signature } = await res.json();

      bindFid({
        address: DAILYGIVE_ADDRESS,
        abi: dailyGiveAbi,
        functionName: "bindFid",
        args: [verifiedFid, signature],
        dataSuffix: BUILDER_CODE_DATA_SUFFIX,
      });
      setStatus("idle");
    } catch (err) {
      setStatus("error");
      setErrorMessage((err as Error).message);
    }
  }

  if (!address || fid || bound) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
      <p className="mb-3 text-sm text-white/60">Sign in with Farcaster to bind your FID to this wallet.</p>
      <button
        onClick={handleBind}
        disabled={status === "authenticating" || binding}
        className="w-full rounded-xl bg-white text-black py-3 font-semibold hover:bg-white/90 disabled:opacity-50"
      >
        {status === "authenticating" || binding ? "Signing in…" : "Sign In With Farcaster"}
      </button>
      {errorMessage && <p className="mt-2 text-xs text-red-400">{errorMessage}</p>}
    </div>
  );
}
