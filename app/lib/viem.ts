import {
  createPublicClient,
  http,
  type Abi,
  type ContractEventName,
  type GetContractEventsParameters,
  type GetContractEventsReturnType,
} from "viem";
import { activeChain } from "./contracts";

export const publicClient = createPublicClient({
  chain: activeChain,
  transport: http(),
});

const MAX_BLOCK_RANGE = 10_000n; // "eth_getLogs is limited to a 10,000 range" — hit this live.

/// `publicClient.getContractEvents` in one shot, split into <=10,000-block windows and
/// concatenated. A plain `fromBlock: 0n` (or any range spanning more than one window) gets
/// rejected outright by public RPCs once the chain is more than 10k blocks past that point —
/// this is what made the Feed/leaderboard/[fid] pages hang on "loading" forever, since the
/// rejected request was never caught.
export async function getContractEventsChunked<
  const abi extends Abi | readonly unknown[],
  eventName extends ContractEventName<abi> | undefined = undefined,
>(params: GetContractEventsParameters<abi, eventName> & { fromBlock: bigint; toBlock?: "latest" }) {
  const latest = await publicClient.getBlockNumber();
  const toBlock = params.toBlock === "latest" || params.toBlock === undefined ? latest : params.toBlock;

  const logs: GetContractEventsReturnType<abi, eventName> = [];
  for (let start = params.fromBlock; start <= toBlock; start += MAX_BLOCK_RANGE) {
    const end = start + MAX_BLOCK_RANGE - 1n > toBlock ? toBlock : start + MAX_BLOCK_RANGE - 1n;
    const chunk = await publicClient.getContractEvents({ ...params, fromBlock: start, toBlock: end });
    logs.push(...chunk);
  }
  return logs;
}
