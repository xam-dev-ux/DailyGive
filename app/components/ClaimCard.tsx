"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { formatUnits, maxUint256 } from "viem";
import { dailyGiveAbi, b20Abi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, GIVE_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";
import { BUILDER_CODE_DATA_SUFFIX } from "@/lib/builderCode";

const DAY_SECONDS = 86400;

function useNow() {
  const [now, setNow] = useState(() => Math.floor(Date.now() / 1000));
  useEffect(() => {
    const id = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function formatCountdown(now: number) {
  const secondsLeft = DAY_SECONDS - (now % DAY_SECONDS);
  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  return `${hours}h ${minutes}m`;
}

export function ClaimCard({ onClaimed }: { onClaimed?: () => void } = {}) {
  const { address, isConnected } = useAccount();
  const now = useNow();
  const countdown = useMemo(() => formatCountdown(now), [now]);

  const { data: fid } = useReadContract({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    functionName: "fid",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: lastClaim, refetch: refetchLastClaim } = useReadContract({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    functionName: "lastClaim",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: balance } = useReadContract({
    address: GIVE_ADDRESS,
    abi: b20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: GIVE_ADDRESS,
    abi: b20Abi,
    functionName: "allowance",
    args: address ? [address, DAILYGIVE_ADDRESS] : undefined,
    query: { enabled: Boolean(address) },
  });

  const alreadyClaimedToday = useMemo(() => {
    if (!lastClaim) return false;
    const today = Math.floor(now / DAY_SECONDS);
    return Math.floor(Number(lastClaim) / DAY_SECONDS) === today;
  }, [lastClaim, now]);

  const needsApproval = Boolean(balance && balance > 0n && (!allowance || allowance < balance));

  const { writeContract: approve, data: approveHash, isPending: approving } = useWriteContract();
  const { isSuccess: approveConfirmed } = useWaitForTransactionReceipt({ hash: approveHash });

  const { writeContract: claim, data: claimHash, isPending: claiming, error: claimError } = useWriteContract();
  const { isSuccess: claimConfirmed } = useWaitForTransactionReceipt({ hash: claimHash });

  useEffect(() => {
    if (approveConfirmed) refetchAllowance();
  }, [approveConfirmed, refetchAllowance]);

  useEffect(() => {
    if (claimConfirmed) {
      refetchLastClaim();
      onClaimed?.();
    }
  }, [claimConfirmed, refetchLastClaim, onClaimed]);

  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
        Connect your wallet to claim your daily GIVE.
      </div>
    );
  }

  if (!fid) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center text-sm text-white/60">
        Bind your Farcaster ID to start claiming (see Sign In With Farcaster prompt above).
      </div>
    );
  }

  if (alreadyClaimedToday) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-6 text-center">
        <p className="text-sm text-white/60">Come back tomorrow</p>
        <p className="mt-1 text-2xl font-semibold">{countdown}</p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-400/30 bg-amber-400/5 p-6 text-center">
      {needsApproval ? (
        <>
          <p className="mb-3 text-sm text-white/60">
            Approve DailyGive once so it can clear your expired GIVE balance automatically.
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
            className="w-full rounded-xl bg-white/10 py-3 font-medium hover:bg-white/20 disabled:opacity-50"
          >
            {approving ? "Approving…" : "Approve GIVE"}
          </button>
        </>
      ) : (
        <>
          <button
            onClick={() =>
              claim({
                address: DAILYGIVE_ADDRESS,
                abi: dailyGiveAbi,
                functionName: "claim",
                dataSuffix: BUILDER_CODE_DATA_SUFFIX,
              })
            }
            disabled={claiming}
            className="w-full rounded-xl bg-amber-400 py-3 font-semibold text-black hover:bg-amber-300 disabled:opacity-50"
          >
            {claiming ? "Claiming…" : "Claim your 100 GIVE for today"}
          </button>
          {balance !== undefined && (
            <p className="mt-2 text-xs text-white/40">
              Current balance: {formatUnits(balance, GIVE_DECIMALS)} GIVE
            </p>
          )}
          {claimError && <p className="mt-2 text-xs text-red-400">{claimError.message}</p>}
        </>
      )}
    </div>
  );
}
