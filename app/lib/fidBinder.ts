import "server-only";

import { privateKeyToAccount } from "viem/accounts";
import { CHAIN_ID, DAILYGIVE_ADDRESS } from "./contracts";

/// Signs the EIP-712 `FidBinding` attestation `DailyGive.bindFid` expects, using the
/// limited-power `FID_BINDER_KEY` server secret. This key can only authorize `fid <-> wallet`
/// bindings on-chain (see `DailyGive.sol`'s `bindFid`) — it cannot mint or move value. Never
/// import this module from client code; `FID_BINDER_KEY` must stay a Vercel server-only env var.
const domain = {
  name: "DailyGive",
  version: "1",
  chainId: CHAIN_ID,
  verifyingContract: DAILYGIVE_ADDRESS,
} as const;

const types = {
  FidBinding: [
    { name: "wallet", type: "address" },
    { name: "fid", type: "uint64" },
    { name: "chainId", type: "uint256" },
  ],
} as const;

export async function signFidBinding(walletAddress: `0x${string}`, fid: number): Promise<`0x${string}`> {
  const privateKey = process.env.FID_BINDER_KEY;
  if (!privateKey) throw new Error("FID_BINDER_KEY is not set");

  const account = privateKeyToAccount(privateKey as `0x${string}`);
  return account.signTypedData({
    domain,
    types,
    primaryType: "FidBinding",
    message: {
      wallet: walletAddress,
      fid: BigInt(fid),
      chainId: BigInt(CHAIN_ID),
    },
  });
}
