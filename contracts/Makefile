SEPOLIA_RPC_URL := https://sepolia.base.org
VIBENET_RPC_URL := https://rpc.vibes.base.org/
MAINNET_RPC_URL := https://mainnet.base.org
DEPLOYER := 0x8F058fE6b568D97f85d517Ac441b52B95722fDDe
ACTIVATION_REGISTRY := 0x8453000000000000000000000000000000000001

.PHONY: install build test test-fork \
        check-keystore check-balance-sepolia check-activation-sepolia check-activation-mainnet \
        deploy-sepolia deploy-vibenet deploy-mainnet

install:
	base-forge install base/base-std --no-git
	base-forge install OpenZeppelin/openzeppelin-contracts --no-git

build:
	base-forge build

test:
	base-forge test -vv

test-fork:
	LIVE_PRECOMPILES=true FOUNDRY_PROFILE=fork base-forge test \
		--fork-url $(SEPOLIA_RPC_URL) -vv

check-keystore:
	@base-cast wallet address --account speedrun | \
		grep -qi "$(DEPLOYER)" && echo "keystore OK" || \
		(echo "KEYSTORE MISMATCH — expected $(DEPLOYER)" && exit 1)

check-balance-sepolia:
	base-cast balance $(DEPLOYER) --rpc-url $(SEPOLIA_RPC_URL)

check-activation-sepolia:
	base-cast call $(ACTIVATION_REGISTRY) \
		"isActivated(bytes32)(bool)" $$(base-cast keccak "base.b20_asset") \
		--rpc-url $(SEPOLIA_RPC_URL)

check-activation-mainnet:
	base-cast call $(ACTIVATION_REGISTRY) \
		"isActivated(bytes32)(bool)" $$(base-cast keccak "base.b20_asset") \
		--rpc-url $(MAINNET_RPC_URL)

deploy-sepolia: check-keystore check-activation-sepolia
	@test -n "$(FID_BINDER_ADDRESS)" || (echo "set FID_BINDER_ADDRESS env var" && exit 1)
	FID_BINDER_ADDRESS=$(FID_BINDER_ADDRESS) base-forge script script/Deploy.s.sol \
		--rpc-url $(SEPOLIA_RPC_URL) \
		--account speedrun \
		--broadcast \
		--verify \
		-vv

deploy-vibenet: check-keystore
	@test -n "$(FID_BINDER_ADDRESS)" || (echo "set FID_BINDER_ADDRESS env var" && exit 1)
	FID_BINDER_ADDRESS=$(FID_BINDER_ADDRESS) base-forge script script/Deploy.s.sol \
		--rpc-url $(VIBENET_RPC_URL) \
		--account speedrun \
		--broadcast \
		-vv

# Real funds, real users. Requires CONFIRM_MAINNET=yes as an explicit extra step so this can
# never fire from a copy-pasted deploy-sepolia command by accident.
deploy-mainnet: check-keystore check-activation-mainnet
	@test -n "$(FID_BINDER_ADDRESS)" || (echo "set FID_BINDER_ADDRESS env var" && exit 1)
	@test "$(CONFIRM_MAINNET)" = "yes" || \
		(echo "This deploys to Base MAINNET with real funds. Re-run with CONFIRM_MAINNET=yes to proceed." && exit 1)
	FID_BINDER_ADDRESS=$(FID_BINDER_ADDRESS) base-forge script script/Deploy.s.sol \
		--rpc-url $(MAINNET_RPC_URL) \
		--account speedrun \
		--broadcast \
		--verify \
		-vv
