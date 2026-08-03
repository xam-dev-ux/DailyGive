import { Attribution } from "ox/erc8021";

/// Base Builder Code (base.dev > Settings > Builder Codes) for onchain attribution. Our wagmi
/// version (2.19.5) doesn't yet expose the client-level `dataSuffix` option on `createConfig`, so
/// this is spread into each `writeContract` call instead — `WriteContractParameters` forwards
/// straight to viem's, which does support it (viem >=2.45.0 required; we're on ^2.55.10).
export const BUILDER_CODE_DATA_SUFFIX = Attribution.toDataSuffix({
  codes: ["bc_2rk0cqv4"],
});
