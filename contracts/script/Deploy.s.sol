// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Script, console} from "forge-std/Script.sol";
import {DailyGive} from "../src/DailyGive.sol";

contract Deploy is Script {
    address constant DEPLOYER = 0x8F058fE6b568D97f85d517Ac441b52B95722fDDe;

    function run() external returns (DailyGive dg) {
        address fidBinder = vm.envAddress("FID_BINDER_ADDRESS");
        bytes32 salt = keccak256(abi.encode("dailygive-v1", block.chainid));

        vm.startBroadcast();
        dg = new DailyGive(salt, fidBinder);
        vm.stopBroadcast();

        console.log("DailyGive:", address(dg));
        console.log("GIVE:", address(dg.GIVE()));
        console.log("GIVEN:", address(dg.GIVEN()));
    }
}
