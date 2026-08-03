import { NextRequest, NextResponse } from "next/server";
import { publicClient, getContractEventsChunked } from "@/lib/viem";
import { dailyGiveAbi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, DEPLOY_BLOCK } from "@/lib/contracts";
import { sendNotification } from "@/lib/neynar";

export const maxDuration = 30;

const DAY_SECONDS = 86400;

/// Once a day, nudges every bound fid that hasn't claimed today. Enumerates the full
/// `FidBound` history rather than a cursor — fine at early-stage user counts; revisit with an
/// indexer (or cache the bound-fid set in Upstash) once this scan gets slow.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const bindLogs = await getContractEventsChunked({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    eventName: "FidBound",
    fromBlock: DEPLOY_BLOCK,
    toBlock: "latest",
  });

  const boundFids = Array.from(new Set(bindLogs.map((log) => log.args.fid!)));
  const today = Math.floor(Date.now() / 1000 / DAY_SECONDS);

  const unclaimed: number[] = [];
  for (const fid of boundFids) {
    const wallet = await publicClient.readContract({
      address: DAILYGIVE_ADDRESS,
      abi: dailyGiveAbi,
      functionName: "wallet",
      args: [fid],
    });
    const lastClaim = await publicClient.readContract({
      address: DAILYGIVE_ADDRESS,
      abi: dailyGiveAbi,
      functionName: "lastClaim",
      args: [wallet],
    });
    const claimedToday = lastClaim !== 0n && Math.floor(Number(lastClaim) / DAY_SECONDS) === today;
    if (!claimedToday) unclaimed.push(Number(fid));
  }

  if (unclaimed.length > 0) {
    await sendNotification({
      targetFids: unclaimed,
      title: "Claim your daily GIVE",
      body: "Your GIVE resets at midnight UTC — claim before it expires.",
      targetUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://dailygive.example",
    });
  }

  return NextResponse.json({ boundFids: boundFids.length, notified: unclaimed.length });
}
