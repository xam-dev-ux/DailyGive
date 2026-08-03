"use client";

import { useEffect, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, maxUint256, zeroHash } from "viem";
import { sdk } from "@farcaster/miniapp-sdk";
import { dailyGiveAbi, b20Abi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, GIVE_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";
import { BUILDER_CODE_DATA_SUFFIX } from "@/lib/builderCode";

type ResolvedUser = { fid: number; username: string; displayName: string; pfpUrl: string };

export function TipComposer({ castHash }: { castHash?: `0x${string}` }) {
  const { address, isConnected } = useAccount();

  const { data: fid } = useReadContract({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    functionName: "fid",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const [handle, setHandle] = useState("");
  const [resolved, setResolved] = useState<ResolvedUser | null>(null);
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [amount, setAmount] = useState(10);

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: GIVE_ADDRESS,
    abi: b20Abi,
    functionName: "allowance",
    args: address ? [address, DAILYGIVE_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  useEffect(() => {
    const trimmed = handle.trim();
    const timeout = setTimeout(async () => {
      if (!trimmed) {
        setResolved(null);
        setResolveError(null);
        return;
      }
      try {
        const res = await fetch(`/api/resolve?username=${encodeURIComponent(trimmed)}`);
        if (!res.ok) {
          setResolved(null);
          setResolveError("User not found");
          return;
        }
        setResolved(await res.json());
        setResolveError(null);
      } catch {
        setResolveError("Lookup failed");
      }
    }, 400);
    return () => clearTimeout(timeout);
  }, [handle]);

  const amountWei = parseUnits(String(amount), GIVE_DECIMALS);
  const needsApproval = Boolean(!allowance || allowance < amountWei);

  const { writeContract: approve, data: approveHash, isPending: approving } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });
  useEffect(() => {
    if (approveConfirmed) refetchAllowance();
  }, [approveConfirmed, refetchAllowance]);

  const { writeContract: tip, data: tipHash, isPending: tipping, error: tipError } = useWriteContract();
  const { isSuccess: tipConfirmed } = useWaitForTransactionReceipt({ hash: tipHash });

  async function shareTip() {
    if (!resolved) return;
    await sdk.actions.composeCast({
      text: `I just tipped @${resolved.username} ${amount} GIVE via DailyGive`,
      embeds: [process.env.NEXT_PUBLIC_APP_URL ?? ""],
    });
  }

  if (!isConnected || !fid) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-6">
      <label className="text-xs uppercase tracking-wide text-white/40">Recipient</label>
      <input
        value={handle}
        onChange={(e) => setHandle(e.target.value)}
        placeholder="@handle"
        className="mt-1 w-full rounded-lg bg-black/30 px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-amber-400"
      />
      {resolveError && <p className="mt-1 text-xs text-red-400">{resolveError}</p>}
      {resolved && (
        <p className="mt-1 text-xs text-emerald-400">
          {resolved.displayName} (fid {resolved.fid})
        </p>
      )}

      <label className="mt-4 block text-xs uppercase tracking-wide text-white/40">Amount: {amount} GIVE</label>
      <input
        type="range"
        min={1}
        max={100}
        value={amount}
        onChange={(e) => setAmount(Number(e.target.value))}
        className="mt-1 w-full"
      />

      {resolved && !needsApproval && (
        <p className="mt-3 text-xs text-white/50">
          You&rsquo;ll burn {amount} GIVE. <span className="text-amber-300">@{resolved.username}</span> receives{" "}
          {amount} GIVEN, permanently — it can&rsquo;t be transferred or taken back.
        </p>
      )}

      {needsApproval ? (
        <>
          <p className="mt-4 text-xs text-white/50">
            One-time approval so DailyGive can move your GIVE when you tip — you&rsquo;ll only see this once.
          </p>
          <button
            onClick={() =>
              approve({
                address: GIVE_ADDRESS,
                abi: b20Abi,
                functionName: "approve",
                args: [DAILYGIVE_ADDRESS, maxUint256],
                dataSuffix: BUILDER_CODE_DATA_SUFFIX,
              })
            }
            disabled={approving}
            className="mt-2 w-full rounded-xl bg-white/10 py-3 font-medium hover:bg-white/20 disabled:opacity-50"
          >
            {approving ? "Approving…" : "Approve GIVE"}
          </button>
        </>
      ) : (
        <button
          onClick={() =>
            resolved &&
            tip({
              address: DAILYGIVE_ADDRESS,
              abi: dailyGiveAbi,
              functionName: "tip",
              args: [BigInt(resolved.fid), amountWei, castHash ?? zeroHash],
              dataSuffix: BUILDER_CODE_DATA_SUFFIX,
            })
          }
          disabled={!resolved || tipping}
          className="mt-4 w-full rounded-xl bg-amber-400 py-3 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
        >
          {tipping ? "Sending…" : "Send tip"}
        </button>
      )}
      {tipError && <p className="mt-2 text-xs text-red-400">{tipError.message}</p>}

      {tipConfirmed && (
        <button onClick={shareTip} className="mt-3 w-full rounded-xl border border-white/20 py-2 text-sm hover:bg-white/10">
          Share this tip
        </button>
      )}
    </div>
  );
}
