import { createPublicClient, http } from "viem";
import { baseSepolia } from "./contracts";

export const publicClient = createPublicClient({
  chain: baseSepolia,
  transport: http(),
});
