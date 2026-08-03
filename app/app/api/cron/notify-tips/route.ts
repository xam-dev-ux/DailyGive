import { NextRequest, NextResponse } from "next/server";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/viem";
import { dailyGiveAbi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";
import { getLastProcessedBlock, setLastProcessedBlock } from "@/lib/kv";
import { sendNotification } from "@/lib/neynar";

export const maxDuration = 30;

/// Polls for new `Tipped` events since the last processed block and notifies each recipient.
/// Triggered by Vercel Cron every 60s (see vercel.json).
///
/// Why polling, not a webhook: checked docs.neynar.com directly — Neynar webhooks only cover
/// Farcaster-protocol events (casts, reactions, follows), not arbitrary onchain contract events,
/// so there's no zero-infra option here. A long-running `watchContractEvent` subscription is also
/// off the table since Vercel functions aren't long-running. A cursor-based poll against a shared
/// cursor in Upstash Redis is the smallest fallback that actually works within those constraints.
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const latestBlock = await publicClient.getBlockNumber();
  const lastProcessed = await getLastProcessedBlock();
  // First-ever run starts from "now", not genesis — avoids notification-flooding on deploy.
  const fromBlock = lastProcessed !== null ? lastProcessed + 1n : latestBlock;

  if (fromBlock > latestBlock) {
    return NextResponse.json({ processed: 0 });
  }

  const logs = await publicClient.getContractEvents({
    address: DAILYGIVE_ADDRESS,
    abi: dailyGiveAbi,
    eventName: "Tipped",
    fromBlock,
    toBlock: latestBlock,
  });

  for (const log of logs) {
    const { toFid, fromFid, amount } = log.args;
    if (toFid === undefined || fromFid === undefined || amount === undefined) continue;
    await sendNotification({
      targetFids: [Number(toFid)],
      title: "You got GIVEN",
      body: `fid ${fromFid} tipped you ${formatUnits(amount, GIVE_DECIMALS)} GIVE`,
      targetUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://dailygive.example",
    });
  }

  await setLastProcessedBlock(latestBlock);
  return NextResponse.json({
    processed: logs.length,
    fromBlock: fromBlock.toString(),
    toBlock: latestBlock.toString(),
  });
}
