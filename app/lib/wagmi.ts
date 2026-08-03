import { createConfig, http } from "wagmi";
import { base, baseSepolia } from "viem/chains";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { activeChain } from "./contracts";

// `activeChain` is typed as `typeof base | typeof baseSepolia`, so wagmi's `transports` needs an
// entry for every chain ID in that union, not just whichever one is active at runtime.
export const wagmiConfig = createConfig({
  chains: [activeChain],
  connectors: [farcasterMiniApp()],
  transports: {
    [base.id]: http(),
    [baseSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
