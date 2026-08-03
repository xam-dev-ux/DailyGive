import { createClient } from "@farcaster/quick-auth";

/// Server-side Farcaster Quick Auth verification. Quick Auth is built on Sign In With Farcaster
/// but abstracts away SIOP/nonce handling — the client gets a JWT via `sdk.quickAuth.getToken()`
/// and this verifies it, returning the FID straight from the token's `sub` claim. See Phase 0
/// research notes: this replaced the originally-planned raw-SIWF verification flow.
const quickAuthClient = createClient();

export type QuickAuthResult = { fid: number };

export async function verifyQuickAuthToken(token: string, domain: string): Promise<QuickAuthResult> {
  const payload = await quickAuthClient.verifyJwt({ token, domain });
  return { fid: payload.sub };
}
