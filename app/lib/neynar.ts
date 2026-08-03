import "server-only";

const NEYNAR_BASE_URL = "https://api.neynar.com/v2";

function neynarHeaders() {
  const apiKey = process.env.NEYNAR_API_KEY;
  if (!apiKey) throw new Error("NEYNAR_API_KEY is not set");
  return { "x-api-key": apiKey, "content-type": "application/json" };
}

export type FarcasterUser = {
  fid: number;
  username: string;
  displayName: string;
  pfpUrl: string;
  verifiedAddresses: string[];
};

/// Resolves a Farcaster username to its FID and verified wallet addresses.
/// https://docs.neynar.com/reference/lookup-user-by-username
export async function lookupUserByUsername(username: string): Promise<FarcasterUser | null> {
  const res = await fetch(`${NEYNAR_BASE_URL}/farcaster/user/by_username?username=${encodeURIComponent(username)}`, {
    headers: neynarHeaders(),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Neynar lookup failed: ${res.status}`);

  const data = await res.json();
  const user = data.user;
  return {
    fid: user.fid,
    username: user.username,
    displayName: user.display_name,
    pfpUrl: user.pfp_url,
    verifiedAddresses: user.verified_addresses?.eth_addresses ?? [],
  };
}

/// Sends a notification to one or more FIDs via Neynar's mini-app notification API.
/// Farcaster enforces 1 notification / 30s and 100 / day per token; Neynar filters
/// revoked tokens automatically. https://docs.neynar.com/reference/publish-frame-notifications
export async function sendNotification(params: {
  targetFids: number[];
  title: string;
  body: string;
  targetUrl: string;
}): Promise<void> {
  const res = await fetch(`${NEYNAR_BASE_URL}/farcaster/frame/notifications/`, {
    method: "POST",
    headers: neynarHeaders(),
    body: JSON.stringify({
      target_fids: params.targetFids,
      notification: {
        title: params.title,
        body: params.body,
        target_url: params.targetUrl,
      },
    }),
  });
  if (!res.ok) throw new Error(`Neynar notification failed: ${res.status}`);
}
