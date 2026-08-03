// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console2} from "forge-std/Test.sol";

import {B20Constants} from "base-std/lib/B20Constants.sol";
import {B20FactoryLib} from "base-std/lib/B20FactoryLib.sol";
import {IB20Factory} from "base-std/interfaces/IB20Factory.sol";
import {IPolicyRegistry} from "base-std/interfaces/IPolicyRegistry.sol";
import {StdPrecompiles} from "base-std/StdPrecompiles.sol";

/// @notice Standalone probe, not part of the regular suite — run manually per PUBLISH.md 7.3
///         against a live fork to check whether `SEIZE_HOLDER_POLICY` is supported yet on that
///         network. `DailyGive.sol` deliberately doesn't touch this policy scope anymore (see its
///         contract-level doc comment), so none of the regular tests exercise it; this probe is
///         the only thing in the repo that still does.
///
///         PASS  -> SEIZE_HOLDER_POLICY is live. Revisit DailyGive.sol: swap the
///                  approve/transferFrom flow back to seizeWithMemo and drop the "approve once"
///                  UX step from ClaimCard/TipComposer.
///         FAIL  -> still unsupported (UnsupportedPolicyType), no action needed — the current
///                  approve/transferFrom design stays as-is.
contract SeizeHolderPolicySupportProbeTest is Test {
    uint64 internal constant ALWAYS_BLOCK_POLICY_ID = (uint64(uint8(IPolicyRegistry.PolicyType.ALLOWLIST)) << 56) | 1;

    function test_probe_seizeHolderPolicySupported() public {
        bytes memory params = B20FactoryLib.encodeAssetCreateParams("Probe", "PRB", address(this), 6);
        bytes[] memory initCalls = new bytes[](1);
        initCalls[0] = B20FactoryLib.encodeUpdatePolicy(B20Constants.SEIZE_HOLDER_POLICY, ALWAYS_BLOCK_POLICY_ID);

        address token = StdPrecompiles.B20_FACTORY.createB20(
            IB20Factory.B20Variant.ASSET, keccak256("seize-holder-policy-probe"), params, initCalls
        );

        console2.log("SEIZE_HOLDER_POLICY IS supported on this network. Probe token:", token);
    }
}
