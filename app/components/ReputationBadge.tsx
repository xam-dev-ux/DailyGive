"use client";

import { useReadContract } from "wagmi";
import { formatUnits } from "viem";
import { b20Abi } from "@/lib/abi";
import { GIVEN_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";

export function ReputationBadge({ address }: { address: `0x${string}` | undefined }) {
  const { data: balance } = useReadContract({
    address: GIVEN_ADDRESS,
    abi: b20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: Boolean(address) },
  });

  const formatted = balance !== undefined ? formatUnits(balance, GIVE_DECIMALS) : "—";

  return (
    <div className="flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-sm font-medium text-amber-300">
      <span aria-hidden>◆</span>
      <span>{formatted} GIVEN</span>
    </div>
  );
}
