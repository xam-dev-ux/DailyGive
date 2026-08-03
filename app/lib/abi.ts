// Generated from contracts/out/DailyGive.sol/DailyGive.json — keep in sync with the deployed
// contract. Re-export after every `make build` in /contracts that changes the public interface.
export const dailyGiveAbi = [
  {
    type: "constructor",
    inputs: [
      { name: "salt", type: "bytes32", internalType: "bytes32" },
      { name: "fidBinder_", type: "address", internalType: "address" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "DAILY_ALLOWANCE",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "DAY",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "GIVE",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IB20" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "GIVEN",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "contract IB20" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "MAX_TIP",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "bindFid",
    inputs: [
      { name: "fid_", type: "uint64", internalType: "uint64" },
      { name: "binderSignature", type: "bytes", internalType: "bytes" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  { type: "function", name: "claim", inputs: [], outputs: [], stateMutability: "nonpayable" },
  {
    type: "function",
    name: "fid",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "fidBinder",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "lastClaim",
    inputs: [{ name: "", type: "address", internalType: "address" }],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "owner",
    inputs: [],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "rotateFidBinder",
    inputs: [{ name: "newFidBinder", type: "address", internalType: "address" }],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "tip",
    inputs: [
      { name: "toFid", type: "uint64", internalType: "uint64" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "castHash", type: "bytes32", internalType: "bytes32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "wallet",
    inputs: [{ name: "", type: "uint64", internalType: "uint64" }],
    outputs: [{ name: "", type: "address", internalType: "address" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "Claimed",
    inputs: [
      { name: "fromFid", type: "uint64", indexed: true, internalType: "uint64" },
      { name: "wallet", type: "address", indexed: true, internalType: "address" },
      { name: "day", type: "uint256", indexed: false, internalType: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "Tipped",
    inputs: [
      { name: "fromFid", type: "uint64", indexed: true, internalType: "uint64" },
      { name: "toFid", type: "uint64", indexed: true, internalType: "uint64" },
      { name: "amount", type: "uint256", indexed: false, internalType: "uint256" },
      { name: "castHash", type: "bytes32", indexed: false, internalType: "bytes32" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "FidBound",
    inputs: [
      { name: "fid", type: "uint64", indexed: true, internalType: "uint64" },
      { name: "walletAddr", type: "address", indexed: true, internalType: "address" },
    ],
    anonymous: false,
  },
  { type: "error", name: "AlreadyClaimedToday", inputs: [] },
  { type: "error", name: "FidBoundToDifferentWallet", inputs: [] },
  { type: "error", name: "InvalidBinderSignature", inputs: [] },
  { type: "error", name: "InvalidFid", inputs: [] },
  { type: "error", name: "NotBoundToFid", inputs: [] },
  { type: "error", name: "NotOwner", inputs: [] },
  { type: "error", name: "TipExceedsMax", inputs: [] },
  { type: "error", name: "UnknownRecipient", inputs: [] },
  { type: "error", name: "WalletBoundToDifferentFid", inputs: [] },
] as const;

/// Minimal B20/ERC-20-shaped read+approve surface — enough for balances, allowance, and the
/// one-time approval GIVE needs (see DailyGive.sol's contract-level note on why `approve` is
/// required: `SEIZE_HOLDER_POLICY` isn't live yet).
export const b20Abi = [
  {
    type: "function",
    name: "balanceOf",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "allowance",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "approve",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "decimals",
    inputs: [],
    outputs: [{ name: "", type: "uint8" }],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "symbol",
    inputs: [],
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
  },
] as const;
