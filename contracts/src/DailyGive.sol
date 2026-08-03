// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {B20Constants} from "base-std/lib/B20Constants.sol";
import {B20FactoryLib} from "base-std/lib/B20FactoryLib.sol";
import {IB20} from "base-std/interfaces/IB20.sol";
import {IB20Factory} from "base-std/interfaces/IB20Factory.sol";
import {IPolicyRegistry} from "base-std/interfaces/IPolicyRegistry.sol";
import {StdPrecompiles} from "base-std/StdPrecompiles.sol";

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title DailyGive
///
/// @notice Daily use-it-or-lose-it tipping allowance (GIVE) that mints a permanent soulbound
///         reputation token (GIVEN) to whoever receives a tip. GIVE stays freely transferable
///         (ALWAYS_ALLOW on every transfer policy, the B20 default); expiration of yesterday's
///         unspent balance is enforced by this contract pulling it via `transferFrom` and
///         self-burning it on the holder's next `claim()`.
///
/// @dev `seizeWithMemo` + `SEIZE_HOLDER_POLICY` is base-std's documented modern replacement for
///      forced third-party burns, and `burnBlocked` is flagged deprecated in `IB20` — but as of
///      writing `SEIZE_HOLDER_POLICY` reverts `UnsupportedPolicyType` on both a local `base-forge`
///      node and a Base Sepolia fork, and `burnBlocked` requires the target to already be denied
///      by `TRANSFER_SENDER_POLICY` (incompatible with GIVE staying freely transferable). Standard
///      `approve` + `transferFrom` + `burn` is therefore the only currently-live mechanism; callers
///      must grant this contract a GIVE allowance (typically once, at onboarding) before their
///      second `claim()` or any `tip()`. Revisit once `SEIZE_HOLDER_POLICY` ships on live chains.
contract DailyGive is EIP712 {
    IB20 public immutable GIVE;
    IB20 public immutable GIVEN;

    uint256 public constant DAY = 1 days;
    uint256 public constant DAILY_ALLOWANCE = 100e6; // 100 GIVE, 6 decimals
    uint256 public constant MAX_TIP = 100e6;

    /// @dev PolicyRegistry built-in sentinel. Not exported as a named constant by base-std;
    ///      value is `(uint64(PolicyType.ALLOWLIST) << 56) | 1` per
    ///      lib/base-std/docs/PolicyRegistry/README.md.
    uint64 internal constant ALWAYS_BLOCK_POLICY_ID = (uint64(uint8(IPolicyRegistry.PolicyType.ALLOWLIST)) << 56) | 1;

    bytes32 internal constant FID_BINDING_TYPEHASH =
        keccak256("FidBinding(address wallet,uint64 fid,uint256 chainId)");

    address public owner;
    address public fidBinder;

    mapping(uint64 => address) public wallet; // fid -> wallet
    mapping(address => uint64) public fid; // wallet -> fid
    mapping(address => uint256) public lastClaim;

    event Claimed(uint64 indexed fromFid, address indexed wallet, uint256 day);
    event Tipped(uint64 indexed fromFid, uint64 indexed toFid, uint256 amount, bytes32 castHash);
    event FidBound(uint64 indexed fid, address indexed walletAddr);
    event FidBinderRotated(address indexed oldBinder, address indexed newBinder);

    error AlreadyClaimedToday();
    error UnknownRecipient();
    error TipExceedsMax();
    error NotBoundToFid();
    error InvalidFid();
    error FidBoundToDifferentWallet();
    error WalletBoundToDifferentFid();
    error InvalidBinderSignature();
    error NotOwner();

    constructor(bytes32 salt, address fidBinder_) EIP712("DailyGive", "1") {
        owner = msg.sender;
        fidBinder = fidBinder_;

        // GIVE: freely transferable, day-scoped. Contract holds MINT for daily claims and BURN so
        // it can destroy a holder's stale balance (pulled via transferFrom) on their next claim.
        bytes memory giveParams = B20FactoryLib.encodeAssetCreateParams("DailyGive", "GIVE", address(this), 6);
        bytes[] memory giveInit = new bytes[](2);
        giveInit[0] = B20FactoryLib.encodeGrantRole(B20Constants.MINT_ROLE, address(this));
        giveInit[1] = B20FactoryLib.encodeGrantRole(B20Constants.BURN_ROLE, address(this));
        address giveToken =
            StdPrecompiles.B20_FACTORY.createB20(IB20Factory.B20Variant.ASSET, salt, giveParams, giveInit);
        GIVE = IB20(giveToken);

        // GIVEN: soulbound permanent reputation. Transfers blocked at the sender side; contract
        // only ever mints.
        bytes memory givenParams =
            B20FactoryLib.encodeAssetCreateParams("Given Reputation", "GIVEN", address(this), 6);
        bytes[] memory givenInit = new bytes[](2);
        givenInit[0] = B20FactoryLib.encodeGrantRole(B20Constants.MINT_ROLE, address(this));
        givenInit[1] = B20FactoryLib.encodeUpdatePolicy(B20Constants.TRANSFER_SENDER_POLICY, ALWAYS_BLOCK_POLICY_ID);
        address givenToken = StdPrecompiles.B20_FACTORY.createB20(
            IB20Factory.B20Variant.ASSET, keccak256(abi.encode(salt, "given")), givenParams, givenInit
        );
        GIVEN = IB20(givenToken);
    }

    /// @notice Binds `fid_` to `msg.sender`, authorized by an EIP-712 signature from `fidBinder`
    ///         attesting the binding was verified off-chain (Farcaster Quick Auth). Idempotent for
    ///         a wallet re-binding its own fid; reverts if either side is already bound elsewhere.
    function bindFid(uint64 fid_, bytes calldata binderSignature) external {
        if (fid_ == 0) revert InvalidFid();

        address existingWallet = wallet[fid_];
        if (existingWallet != address(0) && existingWallet != msg.sender) revert FidBoundToDifferentWallet();

        uint64 existingFid = fid[msg.sender];
        if (existingFid != 0 && existingFid != fid_) revert WalletBoundToDifferentFid();

        bytes32 structHash = keccak256(abi.encode(FID_BINDING_TYPEHASH, msg.sender, fid_, block.chainid));
        address signer = ECDSA.recover(_hashTypedDataV4(structHash), binderSignature);
        if (signer != fidBinder) revert InvalidBinderSignature();

        wallet[fid_] = msg.sender;
        fid[msg.sender] = fid_;
        emit FidBound(fid_, msg.sender);
    }

    /// @notice Claims today's `DAILY_ALLOWANCE` of GIVE. Any GIVE left over from a previous day is
    ///         pulled and burned first (requires an existing GIVE allowance to this contract once
    ///         the caller holds a stale balance), so a claim always leaves the caller holding
    ///         exactly `DAILY_ALLOWANCE`.
    function claim() external {
        uint64 f = fid[msg.sender];
        if (f == 0) revert NotBoundToFid();

        uint256 today = block.timestamp / DAY;
        if (lastClaim[msg.sender] != 0 && lastClaim[msg.sender] / DAY == today) {
            revert AlreadyClaimedToday();
        }

        uint256 stale = GIVE.balanceOf(msg.sender);
        if (stale > 0) {
            GIVE.transferFrom(msg.sender, address(this), stale);
            GIVE.burn(stale);
        }

        GIVE.mintWithMemo(msg.sender, DAILY_ALLOWANCE, bytes32(today));
        lastClaim[msg.sender] = block.timestamp;
        emit Claimed(f, msg.sender, today);
    }

    /// @notice Tips `amount` of the caller's GIVE to the wallet bound to `toFid`. The GIVE is
    ///         pulled from the caller (requires a prior GIVE allowance to this contract) and
    ///         burned; an equal amount of GIVEN is minted to the recipient, memo'd with `castHash`
    ///         so the reputation mint is auditable per-post.
    function tip(uint64 toFid, uint256 amount, bytes32 castHash) external {
        uint64 from = fid[msg.sender];
        if (from == 0) revert NotBoundToFid();
        if (amount > MAX_TIP) revert TipExceedsMax();
        address to = wallet[toFid];
        if (to == address(0)) revert UnknownRecipient();

        GIVE.transferFrom(msg.sender, address(this), amount);
        GIVE.burn(amount);
        GIVEN.mintWithMemo(to, amount, castHash);

        emit Tipped(from, toFid, amount, castHash);
    }

    /// @notice Rotates the fid-binder signer. Limited-power key: it can only authorize
    ///         `fid <-> wallet` bindings, never mint or move value. Rotate on suspected leak.
    function rotateFidBinder(address newFidBinder) external {
        if (msg.sender != owner) revert NotOwner();
        emit FidBinderRotated(fidBinder, newFidBinder);
        fidBinder = newFidBinder;
    }
}
