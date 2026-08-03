import { NextRequest, NextResponse } from "next/server";
import { lookupUserByUsername } from "@/lib/neynar";

/// Resolves a Farcaster @handle to an fid + verified addresses, for the tip composer's
/// recipient picker. Server-side because NEYNAR_API_KEY must never reach the client.
export async function GET(req: NextRequest) {
  const username = req.nextUrl.searchParams.get("username");
  if (!username) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  try {
    const user = await lookupUserByUsername(username.replace(/^@/, ""));
    if (!user) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json(user);
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
