"use client";

import { useEffect, useState } from "react";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/viem";
import { dailyGiveAbi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";

type TipEvent = {
  fromFid: bigint;
  toFid: bigint;
  amount: bigint;
  castHash: `0x${string}`;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
};

export function Feed({ fid }: { fid: bigint | undefined }) {
  const [tips, setTips] = useState<TipEvent[]>([]);

  useEffect(() => {
    if (!fid) return;
    let cancelled = false;

    (async () => {
      const logs = await publicClient.getContractEvents({
        address: DAILYGIVE_ADDRESS,
        abi: dailyGiveAbi,
        eventName: "Tipped",
        args: { fromFid: fid },
        fromBlock: 0n,
        toBlock: "latest",
      });
      if (cancelled) return;
      const parsed = logs
        .slice(-10)
        .reverse()
        .map((log) => ({
          fromFid: log.args.fromFid!,
          toFid: log.args.toFid!,
          amount: log.args.amount!,
          castHash: log.args.castHash!,
          blockNumber: log.blockNumber!,
          transactionHash: log.transactionHash!,
        }));
      setTips(parsed);
    })();

    return () => {
      cancelled = true;
    };
  }, [fid]);

  if (!fid) return null;
  if (tips.length === 0) {
    return <p className="text-sm text-white/40">No tips sent yet.</p>;
  }

  return (
    <ul className="space-y-2">
      {tips.map((tip) => (
        <li
          key={tip.transactionHash}
          className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
        >
          <span>to fid {tip.toFid.toString()}</span>
          <span className="font-medium text-amber-300">{formatUnits(tip.amount, GIVE_DECIMALS)} GIVE</span>
        </li>
      ))}
    </ul>
  );
}
