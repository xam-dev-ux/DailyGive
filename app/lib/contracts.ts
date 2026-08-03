import { defineChain } from "viem";

export const baseSepolia = defineChain({
  id: 84532,
  name: "Base Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.base.org"] } },
  blockExplorers: { default: { name: "BaseScan", url: "https://sepolia.basescan.org" } },
  testnet: true,
});

export const CHAIN_ID = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? baseSepolia.id);

/// Deployment addresses. Empty until `make deploy-sepolia` runs and these env vars are filled
/// in — reads/writes against `0x0` fail loudly rather than silently, by design.
export const DAILYGIVE_ADDRESS = (process.env.NEXT_PUBLIC_DAILYGIVE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const GIVE_ADDRESS = (process.env.NEXT_PUBLIC_GIVE_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;
export const GIVEN_ADDRESS = (process.env.NEXT_PUBLIC_GIVEN_ADDRESS ??
  "0x0000000000000000000000000000000000000000") as `0x${string}`;

export const GIVE_DECIMALS = 6;
