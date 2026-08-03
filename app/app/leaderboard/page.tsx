"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/viem";
import { dailyGiveAbi, b20Abi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, GIVEN_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";

type Row = { fid: bigint; balance: bigint };

/// No subgraph for v1: derive the set of recipient fids from `Tipped` events, then read each
/// one's live GIVEN balance directly. Fine at DailyGive's early-stage event volume; revisit with
/// an indexer if the event count grows large enough to make this slow.
export default function Leaderboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const logs = await publicClient.getContractEvents({
        address: DAILYGIVE_ADDRESS,
        abi: dailyGiveAbi,
        eventName: "Tipped",
        fromBlock: 0n,
        toBlock: "latest",
      });

      const uniqueFids = Array.from(new Set(logs.map((log) => log.args.toFid!)));

      const balances = await Promise.all(
        uniqueFids.map(async (fid) => {
          const wallet = await publicClient.readContract({
            address: DAILYGIVE_ADDRESS,
            abi: dailyGiveAbi,
            functionName: "wallet",
            args: [fid],
          });
          const balance = await publicClient.readContract({
            address: GIVEN_ADDRESS,
            abi: b20Abi,
            functionName: "balanceOf",
            args: [wallet],
          });
          return { fid, balance };
        }),
      );

      balances.sort((a, b) => (b.balance > a.balance ? 1 : b.balance < a.balance ? -1 : 0));
      setRows(balances.slice(0, 100));
      setLoading(false);
    })();
  }, []);

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 p-4 text-white">
      <header className="flex items-center justify-between">
        <h1 className="text-lg font-semibold">Leaderboard</h1>
        <Link href="/" className="text-sm text-white/60 hover:text-white">
          Back
        </Link>
      </header>

      {loading && <p className="text-sm text-white/40">Loading…</p>}
      {!loading && rows.length === 0 && <p className="text-sm text-white/40">No GIVEN minted yet.</p>}

      <ol className="space-y-2">
        {rows.map((row, i) => (
          <li
            key={row.fid.toString()}
            className="flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm"
          >
            <span className="flex items-center gap-3">
              <span className="w-6 text-white/40">{i + 1}</span>
              <Link href={`/${row.fid.toString()}`} className="hover:text-amber-300">
                fid {row.fid.toString()}
              </Link>
            </span>
            <span className="font-medium text-amber-300">{formatUnits(row.balance, GIVE_DECIMALS)} GIVEN</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
