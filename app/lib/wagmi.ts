import { createConfig, http } from "wagmi";
import { farcasterMiniApp } from "@farcaster/miniapp-wagmi-connector";
import { baseSepolia } from "./contracts";

export const wagmiConfig = createConfig({
  chains: [baseSepolia],
  connectors: [farcasterMiniApp()],
  transports: {
    [baseSepolia.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof wagmiConfig;
  }
}
