import { createPublicClient, http } from "viem";
import { activeChain } from "./contracts";

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
});
