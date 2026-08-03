import { NextRequest, NextResponse } from "next/server";
import { formatUnits } from "viem";
import { publicClient } from "@/lib/viem";
import { dailyGiveAbi } from "@/lib/abi";
import { DAILYGIVE_ADDRESS, GIVE_DECIMALS } from "@/lib/contracts";
import { getLastProcessedBlock, setLastProcessedBlock } from "@/lib/kv";
import { sendNotification } from "@/lib/neynar";

export const maxDuration = 30;

/// Polls for new `Tipped` events since the last processed block and notifies each recipient.
/// Triggered by Vercel Cron once daily (see vercel.json) — Vercel's Hobby plan only allows daily
/// cron schedules, so this batches up to 24h of tips into one notification per recipient rather
/// than pinging in near-real-time. Fine for now; revisit (more frequent polling via an external
/// scheduler, or Vercel Pro) if same-day notification latency becomes a real product need.
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

  // Batched window (daily, not per-minute — see doc comment above) can carry many tips to the
  // same recipient; summarize into one notification per fid instead of one per tip, both for a
  // better message and to stay well under Farcaster's 1-per-30s-per-token throttle.
  const perRecipient = new Map<number, { total: bigint; count: number }>();
  for (const log of logs) {
    const { toFid, amount } = log.args;
    if (toFid === undefined || amount === undefined) continue;
    const fid = Number(toFid);
    const existing = perRecipient.get(fid) ?? { total: 0n, count: 0 };
    perRecipient.set(fid, { total: existing.total + amount, count: existing.count + 1 });
  }

  for (const [fid, { total, count }] of perRecipient) {
    await sendNotification({
      targetFids: [fid],
      title: "You got GIVEN",
      body:
        count === 1
          ? `You received ${formatUnits(total, GIVE_DECIMALS)} GIVE`
          : `You received ${formatUnits(total, GIVE_DECIMALS)} GIVE across ${count} tips`,
      targetUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://dailygive.example",
    });
  }

  await setLastProcessedBlock(latestBlock);
  return NextResponse.json({
    tipsProcessed: logs.length,
    notificationsSent: perRecipient.size,
    fromBlock: fromBlock.toString(),
    toBlock: latestBlock.toString(),
  });
}
