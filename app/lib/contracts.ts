import { base, baseSepolia } from "viem/chains";

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? baseSepolia.id);

/// The chain every client (wagmi connector, viem publicClient) actually talks to. Was previously
/// hardcoded to baseSepolia in lib/viem.ts and lib/wagmi.ts independently of CHAIN_ID — real bug,
/// caught live: switching NEXT_PUBLIC_CHAIN_ID to mainnet updated contract reads/writes but the
/// wallet connector still only knew about Sepolia, so signing prompted a Sepolia network switch.
export const activeChain = CHAIN_ID === base.id ? base : baseSepolia;

/// Deployment addresses. Empty until `make deploy-sepolia` runs and these env vars are filled
/// in — reads/writes against `0x0` fail loudly rather than silently, by design.
export const DAILYGIVE_ADDRESS = (process.env.NEXT_PUBLIC_DAILYGIVE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const GIVE_ADDRESS = (process.env.NEXT_PUBLIC_GIVE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const GIVEN_ADDRESS = (process.env.NEXT_PUBLIC_GIVEN_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const GIVE_DECIMALS = 6;

/// Block DailyGive was deployed at, per network — event queries (Feed, leaderboard, /[fid], the
/// daily-reminder cron) start scanning here instead of genesis. Public RPCs cap eth_getLogs to a
/// 10,000-block range per call ("eth_getLogs is limited to a 10,000 range" — hit this live), so
/// this alone isn't the fix, just the starting point; see lib/viem.ts's chunked fetch helper.
export const DEPLOY_BLOCK = CHAIN_ID === base.id ? 49500681n : 45007956n;
