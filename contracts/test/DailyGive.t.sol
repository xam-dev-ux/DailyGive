// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Vm} from "forge-std/Vm.sol";

import {BaseTest} from "base-std-test/lib/BaseTest.sol";

import {IB20} from "base-std/interfaces/IB20.sol";

import {DailyGive} from "../src/DailyGive.sol";

contract DailyGiveTest is BaseTest {
    bytes32 internal constant FID_BINDING_TYPEHASH =
        keccak256("FidBinding(address wallet,uint64 fid,uint256 chainId)");
    bytes32 internal constant EIP712_DOMAIN_TYPEHASH =
        keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)");

    uint256 internal constant FID_BINDER_PK = 0xB1DE5;
    uint256 internal constant OTHER_PK = 0xBADBAD;

    DailyGive internal dailyGive;
    IB20 internal give;
    IB20 internal given;
    address internal fidBinderAddr;
    address internal carol = makeAddr("carol");

    function setUp() public override {
        super.setUp();
        fidBinderAddr = vm.addr(FID_BINDER_PK);
        dailyGive = new DailyGive(keccak256("test-salt"), fidBinderAddr);
        give = dailyGive.GIVE();
        given = dailyGive.GIVEN();
    }

    // ============================================================
    //                          HELPERS
    // ============================================================

    function _domainSeparator() internal view returns (bytes32) {
        return keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes("DailyGive")),
                keccak256(bytes("1")),
                block.chainid,
                address(dailyGive)
            )
        );
    }

    function _signBinding(uint256 pk, address walletAddr, uint64 fid_) internal view returns (bytes memory) {
        bytes32 structHash = keccak256(abi.encode(FID_BINDING_TYPEHASH, walletAddr, fid_, block.chainid));
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", _domainSeparator(), structHash));
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, digest);
        return abi.encodePacked(r, s, v);
    }

    function _bind(address walletAddr, uint64 fid_) internal {
        bytes memory sig = _signBinding(FID_BINDER_PK, walletAddr, fid_);
        vm.prank(walletAddr);
        dailyGive.bindFid(fid_, sig);
    }

    /// @dev claim() and tip() pull GIVE via transferFrom (see DailyGive's contract-level dev
    ///      note: SEIZE_HOLDER_POLICY is not yet live), so callers must approve this contract
    ///      before their second claim() or any tip().
    function _approveMax(address walletAddr) internal {
        vm.prank(walletAddr);
        give.approve(address(dailyGive), type(uint256).max);
    }

    // ============================================================
    //                          bindFid
    // ============================================================

    function test_bindFid_success() public {
        _bind(alice, 100);
        assertEq(dailyGive.wallet(100), alice, "wallet(fid) must map to alice");
        assertEq(dailyGive.fid(alice), 100, "fid(wallet) must map to 100");
    }

    function test_bindFid_success_idempotentRebind() public {
        _bind(alice, 100);
        _bind(alice, 100);
        assertEq(dailyGive.wallet(100), alice, "rebind must remain idempotent");
    }

    function test_bindFid_revert_invalidSignature() public {
        bytes memory sig = _signBinding(OTHER_PK, alice, 100);
        vm.prank(alice);
        vm.expectRevert(DailyGive.InvalidBinderSignature.selector);
        dailyGive.bindFid(100, sig);
    }

    function test_bindFid_revert_zeroFid() public {
        bytes memory sig = _signBinding(FID_BINDER_PK, alice, 0);
        vm.prank(alice);
        vm.expectRevert(DailyGive.InvalidFid.selector);
        dailyGive.bindFid(0, sig);
    }

    function test_bindFid_revert_fidAlreadyBoundToDifferentWallet() public {
        _bind(alice, 100);
        bytes memory sig = _signBinding(FID_BINDER_PK, bob, 100);
        vm.prank(bob);
        vm.expectRevert(DailyGive.FidBoundToDifferentWallet.selector);
        dailyGive.bindFid(100, sig);
    }

    /// @notice A fid lazy-bound by a tip (see tip() tests) is NOT self-attested, so the real
    ///         owner must be able to correct it via bindFid even though wallet[fid_] is already
    ///         set to someone else's guess.
    function test_bindFid_success_correctsLazyBoundWallet() public {
        _bind(alice, 100);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        // alice tips fid 200, guessing (wrongly) that carol holds it.
        vm.prank(alice);
        dailyGive.tip(200, carol, 1e6, bytes32(0));
        assertEq(dailyGive.wallet(200), carol, "lazy-bind must set the guessed wallet");
        assertFalse(dailyGive.fidSelfBound(200), "lazy-bind must not be self-attested");

        // bob is the REAL owner of fid 200 and corrects it.
        _bind(bob, 200);
        assertEq(dailyGive.wallet(200), bob, "self-bind must override a prior lazy-bind");
        assertTrue(dailyGive.fidSelfBound(200), "bindFid must mark the fid as self-attested");
    }

    /// @notice Once a fid has gone through real self-attestation, it's no longer just "a
    ///         sender's best guess" — a second bindFid claiming the same fid for a different
    ///         wallet must still revert, same as before self-bind existed for this fid.
    function test_bindFid_revert_cannotOverrideSelfBoundFid() public {
        _bind(alice, 100);
        bytes memory sig = _signBinding(FID_BINDER_PK, bob, 100);
        vm.prank(bob);
        vm.expectRevert(DailyGive.FidBoundToDifferentWallet.selector);
        dailyGive.bindFid(100, sig);
    }

    function test_bindFid_revert_walletAlreadyBoundToDifferentFid() public {
        _bind(alice, 100);
        bytes memory sig = _signBinding(FID_BINDER_PK, alice, 200);
        vm.prank(alice);
        vm.expectRevert(DailyGive.WalletBoundToDifferentFid.selector);
        dailyGive.bindFid(200, sig);
    }

    // ============================================================
    //                          claim
    // ============================================================

    function test_claim_revert_notBoundToFid() public {
        vm.prank(alice);
        vm.expectRevert(DailyGive.NotBoundToFid.selector);
        dailyGive.claim();
    }

    function test_claim_success_mintsDailyAllowance() public {
        _bind(alice, 100);
        vm.prank(alice);
        dailyGive.claim();
        assertEq(give.balanceOf(alice), dailyGive.DAILY_ALLOWANCE(), "claim must mint DAILY_ALLOWANCE");
    }

    function test_claim_revert_alreadyClaimedToday() public {
        _bind(alice, 100);
        vm.startPrank(alice);
        dailyGive.claim();
        vm.expectRevert(DailyGive.AlreadyClaimedToday.selector);
        dailyGive.claim();
        vm.stopPrank();
    }

    function test_claim_success_nextDayBurnsStaleBalanceInsteadOfStacking() public {
        _bind(alice, 100);
        _approveMax(alice);
        vm.startPrank(alice);
        dailyGive.claim();
        vm.warp(block.timestamp + dailyGive.DAY());
        dailyGive.claim();
        vm.stopPrank();

        assertEq(
            give.balanceOf(alice),
            dailyGive.DAILY_ALLOWANCE(),
            "second day's claim must leave exactly DAILY_ALLOWANCE, not 2x"
        );
    }

    function test_claim_success_burnsStaleBalanceEvenIfPartiallySpent() public {
        _bind(alice, 100);
        _bind(bob, 200);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        // alice spends half her allowance tipping bob, keeping half unspent.
        uint256 halfAllowance = dailyGive.DAILY_ALLOWANCE() / 2;
        vm.prank(alice);
        dailyGive.tip(200, bob, halfAllowance, bytes32(0));

        vm.warp(block.timestamp + dailyGive.DAY());
        vm.prank(alice);
        dailyGive.claim();

        assertEq(
            give.balanceOf(alice),
            dailyGive.DAILY_ALLOWANCE(),
            "next day's claim must burn leftover half and mint a fresh full allowance"
        );
    }

    // ============================================================
    //                            tip
    // ============================================================

    function test_tip_revert_senderNotBoundToFid() public {
        _bind(bob, 200);
        vm.prank(alice);
        vm.expectRevert(DailyGive.NotBoundToFid.selector);
        dailyGive.tip(200, bob, 1, bytes32(0));
    }

    /// @notice The recipient does NOT need to have called bindFid — receiving a tip lazy-binds
    ///         wallet[toFid] to the caller-supplied address. This is the fix for the reported
    ///         "transaction would fail" when tipping anyone who hadn't opened the app yet.
    function test_tip_success_lazyBindsNeverBoundRecipient() public {
        _bind(alice, 100);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        assertEq(dailyGive.wallet(999), address(0), "fid 999 must start unbound");

        vm.prank(alice);
        dailyGive.tip(999, carol, 1e6, bytes32(0));

        assertEq(dailyGive.wallet(999), carol, "first tip must lazy-bind the fid to the supplied wallet");
        assertFalse(dailyGive.fidSelfBound(999), "lazy-bind must not count as self-attestation");
        assertEq(given.balanceOf(carol), 1e6, "GIVEN must mint to the lazy-bound wallet");
    }

    function test_tip_revert_toWalletZero() public {
        _bind(alice, 100);
        vm.prank(alice);
        dailyGive.claim();

        vm.prank(alice);
        vm.expectRevert(DailyGive.UnknownRecipient.selector);
        dailyGive.tip(999, address(0), 1, bytes32(0));
    }

    /// @notice Once a fid is bound (lazily or via bindFid) to some wallet, a later tip claiming a
    ///         DIFFERENT wallet for the same fid must revert rather than silently redirecting
    ///         that fid's accumulated reputation to a new address.
    function test_tip_revert_conflictingWalletForAlreadyLazyBoundFid() public {
        _bind(alice, 100);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        vm.prank(alice);
        dailyGive.tip(999, carol, 1e6, bytes32(0));

        vm.prank(alice);
        vm.expectRevert(DailyGive.FidBoundToDifferentWallet.selector);
        dailyGive.tip(999, bob, 1e6, bytes32(0));
    }

    function test_tip_revert_exceedsMax() public {
        _bind(alice, 100);
        _bind(bob, 200);
        vm.prank(alice);
        dailyGive.claim();

        uint256 tooMuch = dailyGive.MAX_TIP() + 1;
        vm.prank(alice);
        vm.expectRevert(DailyGive.TipExceedsMax.selector);
        dailyGive.tip(200, bob, tooMuch, bytes32(0));
    }

    function test_tip_revert_insufficientBalance() public {
        _bind(alice, 100);
        _bind(bob, 200);
        // alice never claimed, so she holds zero GIVE.
        vm.prank(alice);
        vm.expectRevert();
        dailyGive.tip(200, bob, 1, bytes32(0));
    }

    function test_tip_success_burnsGiveAndMintsGivenWithMemo() public {
        _bind(alice, 100);
        _bind(bob, 200);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        bytes32 castHash = keccak256("cast-1");
        uint256 amount = 42e6;

        vm.expectEmit(true, true, false, true, address(dailyGive));
        emit DailyGive.Tipped(100, 200, amount, castHash);

        vm.prank(alice);
        dailyGive.tip(200, bob, amount, castHash);

        assertEq(give.balanceOf(alice), dailyGive.DAILY_ALLOWANCE() - amount, "tip must burn GIVE from sender");
        assertEq(given.balanceOf(bob), amount, "tip must mint GIVEN to recipient");
    }

    function test_tip_success_emitsGivenMemoWithCastHash() public {
        _bind(alice, 100);
        _bind(bob, 200);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        bytes32 castHash = keccak256("cast-2");
        uint256 amount = 10e6;

        vm.recordLogs();
        vm.prank(alice);
        dailyGive.tip(200, bob, amount, castHash);
        Vm.Log[] memory logs = vm.getRecordedLogs();

        bool sawMemo;
        for (uint256 i = 0; i < logs.length; i++) {
            if (
                logs[i].emitter == address(given) && logs[i].topics.length > 0
                    && logs[i].topics[0] == IB20.Memo.selector && logs[i].topics.length > 2
                    && logs[i].topics[2] == castHash
            ) {
                sawMemo = true;
            }
        }
        assertTrue(sawMemo, "GIVEN mint must carry the cast hash as its memo");
    }

    // ============================================================
    //                      SOULBOUND / TRANSFERABILITY
    // ============================================================

    function test_given_revert_transferIsSoulbound() public {
        _bind(alice, 100);
        _bind(bob, 200);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();
        vm.prank(alice);
        dailyGive.tip(200, bob, 10e6, bytes32(0));

        vm.prank(bob);
        vm.expectRevert();
        given.transfer(alice, 1);
    }

    function test_give_success_freelyTransferableBetweenUsers() public {
        _bind(alice, 100);
        vm.prank(alice);
        dailyGive.claim();

        vm.prank(alice);
        give.transfer(bob, 10e6);

        assertEq(give.balanceOf(bob), 10e6, "GIVE must be freely transferable outside the tip() path");
    }

    // ============================================================
    //                       rotateFidBinder
    // ============================================================

    function test_rotateFidBinder_revert_notOwner() public {
        vm.prank(alice);
        vm.expectRevert(DailyGive.NotOwner.selector);
        dailyGive.rotateFidBinder(bob);
    }

    function test_rotateFidBinder_success_oldSignatureNoLongerWorks() public {
        address newBinder = vm.addr(OTHER_PK);
        dailyGive.rotateFidBinder(newBinder);
        assertEq(dailyGive.fidBinder(), newBinder, "fidBinder must update");

        bytes memory oldSig = _signBinding(FID_BINDER_PK, alice, 100);
        vm.prank(alice);
        vm.expectRevert(DailyGive.InvalidBinderSignature.selector);
        dailyGive.bindFid(100, oldSig);

        bytes memory newSig = _signBinding(OTHER_PK, alice, 100);
        vm.prank(alice);
        dailyGive.bindFid(100, newSig);
        assertEq(dailyGive.wallet(100), alice, "new binder's signature must be accepted after rotation");
    }

    // ============================================================
    //                             FUZZ
    // ============================================================

    /// @notice Across many tips in a single day, total GIVEN received by a recipient must equal
    ///         the sum of tip amounts sent to them.
    function testFuzz_tip_totalGivenMatchesSumOfTips(uint8 tipCount, uint256 seed) public {
        tipCount = uint8(bound(tipCount, 1, 20));
        _bind(alice, 100);
        _bind(bob, 200);
        _approveMax(alice);
        vm.prank(alice);
        dailyGive.claim();

        uint256 remaining = dailyGive.DAILY_ALLOWANCE();
        uint256 totalTipped;
        for (uint256 i = 0; i < tipCount; i++) {
            if (remaining == 0) break;
            uint256 amount = bound(uint256(keccak256(abi.encode(seed, i))), 1, remaining);
            vm.prank(alice);
            dailyGive.tip(200, bob, amount, bytes32(0));
            remaining -= amount;
            totalTipped += amount;
        }

        assertEq(given.balanceOf(bob), totalTipped, "sum of GIVEN received must equal sum of tip amounts");
        assertEq(give.balanceOf(alice), remaining, "alice's remaining GIVE must match unspent allowance");
    }
}
