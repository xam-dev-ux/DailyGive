import { NextRequest, NextResponse } from "next/server";
import { sendNotification } from "@/lib/neynar";

/// Manual/ad-hoc notification send, gated by a shared secret. The two real automated triggers
/// are the Vercel Cron routes at api/cron/notify-tips (per-tip pings) and
/// api/cron/daily-reminder (unclaimed-GIVE nudge) — this endpoint exists for one-off sends
/// outside those schedules (announcements, manual retries), not as their dispatch path.
export async function POST(req: NextRequest) {
  const secret = req.headers.get("x-notify-secret");
  if (!secret || secret !== process.env.NOTIFY_SECRET) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { targetFids, title, body } = await req.json();
  if (!Array.isArray(targetFids) || !title || !body) {
    return NextResponse.json({ error: "targetFids, title, body are required" }, { status: 400 });
  }

  try {
    await sendNotification({
      targetFids,
      title,
      body,
      targetUrl: process.env.NEXT_PUBLIC_APP_URL ?? "https://dailygive.example",
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
