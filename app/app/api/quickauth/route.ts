import { NextRequest, NextResponse } from "next/server";
import { verifyQuickAuthToken } from "@/lib/quickAuth";
import { signFidBinding } from "@/lib/fidBinder";

/// Verifies a Farcaster Quick Auth token, then signs the EIP-712 attestation the client submits
/// to `DailyGive.bindFid`. This is the only place `FID_BINDER_KEY` is used — it authorizes an
/// `fid <-> wallet` binding, nothing else.
export async function POST(req: NextRequest) {
  const { token, walletAddress } = await req.json();
  if (!token || !walletAddress) {
    return NextResponse.json({ error: "token and walletAddress are required" }, { status: 400 });
  }

  const domain = new URL(req.url).hostname;

  try {
    const { fid } = await verifyQuickAuthToken(token, domain);
    const signature = await signFidBinding(walletAddress, fid);
    return NextResponse.json({ fid, signature });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 401 });
  }
}
