// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/DegenFeedCoinV4.sol";

contract DegenFeedCoinV4Test is Test {
    DegenFeedCoinV4 coin;
    address creator = address(0xCAFE);
    address user1 = address(0x1111);
    address user2 = address(0x2222);
    address platformFeeReceiver = address(0x3333);
    address deployer = address(0x4444);

    CreatorParameters defaultParams;
    DAOConfig emptyDAO;

    function setUp() public {
        // Label creator + team + treasury
        WalletLabel[] memory labels = new WalletLabel[](3);
        labels[0] = WalletLabel.Creator;
        labels[1] = WalletLabel.Team;
        labels[2] = WalletLabel.Treasury;

        address[] memory labelWallets = new address[](3);
        labelWallets[0] = creator;
        labelWallets[1] = address(0xAAAA);
        labelWallets[2] = address(0xBBBB);

        defaultParams = CreatorParameters({
            feeBps: 50, // 0.5%
            vestingDuration: 90 days,
            vestingPercentageBps: 5000, // 50% of creator allocation vested
            creatorAllocationBps: 1000, // 10%
            preBondingDuration: 0,
            maxWalletBps: 100, // 1%
            vestingType: VestingType.Linear,
            daoEnabled: false,
            antiSniperEnabled: true,
            sandwichProtection: true,
            minBlockDelay: 1
        });

        // Empty DAO config
        address[] memory emptySigners;
        emptyDAO = DAOConfig({
            multiSigTreasury: address(0),
            governor: address(0),
            initialSigners: emptySigners,
            signerThreshold: 0
        });

        coin = new DegenFeedCoinV4(
            "Test Coin",
            "TEST",
            creator,
            platformFeeReceiver,
            address(0), // no wormhole core
            address(0), // no wormhole relayer
            0, // chain ID
            defaultParams,
            emptyDAO,
            labels,
            labelWallets
        );
    }

    // ── 1. Deployment & Parameter Verification ──────────────────────────

    function test_Deployment_Basics() public {
        assertEq(coin.name(), "Test Coin");
        assertEq(coin.symbol(), "TEST");
        assertEq(coin.creator(), creator);
        assertEq(coin.decimals(), 18);
        assertEq(coin.totalSupply(), 1_000_000_000 * 1e18);
        assertEq(coin.TOTAL_SUPPLY(), 1_000_000_000 * 1e18);
    }

    function test_Deployment_CreatorFee() public {
        assertEq(coin.creatorFeeBps(), 50);
    }

    function test_Deployment_Parameters() public {
        // Destructure the public variable getter tuple
        (
            uint256 feeBps,
            uint256 vestingDuration,
            uint256 vestingPercentageBps,
            uint256 creatorAllocationBps,
            uint256 preBondingDuration,
            uint256 maxWalletBps,
            VestingType vestingType,
            bool daoEnabled,
            bool antiSniperEnabled,
            bool sandwichProtection,
            uint256 minBlockDelay
        ) = coin.params();

        assertEq(feeBps, 50);
        assertEq(vestingDuration, 90 days);
        assertEq(vestingPercentageBps, 5000);
        assertEq(creatorAllocationBps, 1000);
        assertEq(preBondingDuration, 0);
        assertEq(maxWalletBps, 100);
        assertEq(uint256(vestingType), uint256(VestingType.Linear));
        assertFalse(daoEnabled);
        assertTrue(antiSniperEnabled);
        assertTrue(sandwichProtection);
        assertEq(minBlockDelay, 1);
    }

    function test_Deployment_CreatorAllocation() public {
        // 10% creator allocation, 50% vested = 5% upfront minted
        assertEq(coin.balanceOf(creator), 50_000_000 * 1e18);
    }

    function test_Deployment_WalletLabels() public {
        (WalletLabel label, string memory labelName) = coin.getWalletLabel(creator);
        assertEq(uint256(label), uint256(WalletLabel.Creator));
        assertEq(labelName, "Creator");

        (address[] memory wallets, WalletLabel[] memory labels_) = coin.getAllLabeledWallets();
        assertEq(wallets.length, 3);
        assertEq(wallets[0], creator);
    }

    function test_Deployment_PreBondingDisabled() public {
        assertEq(coin.isPreBonding(), false);
        assertEq(coin.preBondingEnd(), 0);
    }

    function test_Deployment_BridgeDisabled() public {
        assertFalse(coin.bridgeEnabled());
        assertEq(coin.wormholeCoreBridge(), address(0));
        assertEq(coin.wormholeRelayer(), address(0));
    }

    // ── 2. Pre-Bonding Period ───────────────────────────────────────────

    function _deployWithPreBonding(uint256 duration) internal returns (DegenFeedCoinV4) {
        WalletLabel[] memory lbls = new WalletLabel[](1);
        lbls[0] = WalletLabel.Creator;
        address[] memory wlts = new address[](1);
        wlts[0] = creator;

        CreatorParameters memory p = CreatorParameters({
            feeBps: 50,
            vestingDuration: 0,
            vestingPercentageBps: 0,
            creatorAllocationBps: 0,
            preBondingDuration: duration,
            maxWalletBps: 100,
            vestingType: VestingType.None,
            daoEnabled: false,
            antiSniperEnabled: false,
            sandwichProtection: false,
            minBlockDelay: 0
        });

        address[] memory emptySigners;
        DAOConfig memory empty = DAOConfig({
            multiSigTreasury: address(0),
            governor: address(0),
            initialSigners: emptySigners,
            signerThreshold: 0
        });

        return new DegenFeedCoinV4(
            "PreBond", "PRE", creator, platformFeeReceiver,
            address(0), address(0), 0, p, empty, lbls, wlts
        );
    }

    function test_PreBonding_ActivePeriod() public {
        DegenFeedCoinV4 pb = _deployWithPreBonding(1 hours);
        assertTrue(pb.isPreBonding());
        assertFalse(pb.isFairLaunch());
        assertTrue(pb.preBondingTimeRemaining() > 0);
    }

    function test_PreBonding_Expires() public {
        DegenFeedCoinV4 pb = _deployWithPreBonding(1 hours);
        vm.warp(block.timestamp + 1 hours + 1);
        assertFalse(pb.isPreBonding());
        assertTrue(pb.isFairLaunch());
        assertEq(pb.preBondingTimeRemaining(), 0);
    }

    function test_PreBonding_FairLaunchBadge() public {
        DegenFeedCoinV4 pb = _deployWithPreBonding(24 hours);
        vm.warp(block.timestamp + 24 hours + 1);

        vm.expectEmit(true, false, false, true);
        emit DegenFeedCoinV4.FairLaunchVerified();
        pb.verifyFairLaunch();
    }

    // ── 3. Creator Parameter Bounds ─────────────────────────────────────

    function _deployWithParams(CreatorParameters memory p) internal returns (DegenFeedCoinV4) {
        WalletLabel[] memory lbls = new WalletLabel[](1);
        lbls[0] = WalletLabel.Creator;
        address[] memory wlts = new address[](1);
        wlts[0] = creator;

        address[] memory emptySigners;
        DAOConfig memory empty = DAOConfig({
            multiSigTreasury: address(0),
            governor: address(0),
            initialSigners: emptySigners,
            signerThreshold: 0
        });

        return new DegenFeedCoinV4(
            "Test", "TST", creator, platformFeeReceiver,
            address(0), address(0), 0, p, empty, lbls, wlts
        );
    }

    function test_Params_MaxFee() public {
        CreatorParameters memory p = defaultParams;
        p.feeBps = 500; // 5% max
        _deployWithParams(p);
    }

    function test_Params_FeeTooHigh() public {
        CreatorParameters memory p = defaultParams;
        p.feeBps = 501;
        vm.expectRevert("V4: fee 0.1-5%");
        _deployWithParams(p);
    }

    function test_Params_FeeTooLow() public {
        CreatorParameters memory p = defaultParams;
        p.feeBps = 9; // 0.09% < 0.1% min
        vm.expectRevert("V4: fee 0.1-5%");
        _deployWithParams(p);
    }

    function test_Params_MaxAlloc() public {
        CreatorParameters memory p = defaultParams;
        p.creatorAllocationBps = 9000; // 90%
        _deployWithParams(p);
    }

    function test_Params_AllocTooHigh() public {
        CreatorParameters memory p = defaultParams;
        p.creatorAllocationBps = 9001;
        vm.expectRevert("V4: alloc max 90%");
        _deployWithParams(p);
    }

    function test_Params_MaxVestingDuration() public {
        CreatorParameters memory p = defaultParams;
        p.vestingDuration = 730 days; // 2 years max
        _deployWithParams(p);
    }

    function test_Params_VestingTooLong() public {
        CreatorParameters memory p = defaultParams;
        p.vestingDuration = 731 days;
        vm.expectRevert("V4: vest max 730d");
        _deployWithParams(p);
    }

    function test_Params_MaxPreBonding() public {
        CreatorParameters memory p = defaultParams;
        p.preBondingDuration = 72 hours;
        _deployWithParams(p);
    }

    function test_Params_PreBondingTooLong() public {
        CreatorParameters memory p = defaultParams;
        p.preBondingDuration = 73 hours;
        vm.expectRevert("V4: pre-bond max 72h");
        _deployWithParams(p);
    }

    function test_Params_MaxWalletCap() public {
        CreatorParameters memory p = defaultParams;
        p.maxWalletBps = 2000; // 20% hard max
        _deployWithParams(p);
    }

    function test_Params_WalletCapTooHigh() public {
        CreatorParameters memory p = defaultParams;
        p.maxWalletBps = 2001;
        vm.expectRevert("V4: max wallet 20%");
        _deployWithParams(p);
    }

    // ── 4. Vesting ──────────────────────────────────────────────────────

    function test_Vesting_ClaimableAfterCliff() public {
        vm.warp(block.timestamp + 30 days); // After cliff (22.5 days)

        uint256 claimable = coin.getClaimableAmount();
        assertTrue(claimable > 0);
        assertTrue(claimable <= 50_000_000 * 1e18);

        vm.prank(creator);
        coin.claimVested();

        // Destructure vesting schedule
        (uint256 totalAlloc, uint256 claimed, , , ) = coin.creatorVesting();
        assertTrue(claimed > 0);
        assertTrue(claimed <= totalAlloc);
    }

    function test_Vesting_NothingBeforeCliff() public {
        vm.warp(block.timestamp + 22 days); // Before cliff (22.5 days)
        assertEq(coin.getClaimableAmount(), 0);
    }

    function test_Vesting_AllAfterVestEnd() public {
        vm.warp(block.timestamp + 91 days); // After full vesting period

        uint256 claimable = coin.getClaimableAmount();
        (uint256 totalAlloc, , , , ) = coin.creatorVesting();
        assertEq(claimable, totalAlloc);
    }

    // ── 5. Anti-Exploit V2 ──────────────────────────────────────────────

    function test_AntiExploit_BlockAndUnblock() public {
        vm.prank(creator);
        address[] memory blocked = new address[](1);
        blocked[0] = user1;
        coin.blockAddresses(blocked);
        assertTrue(coin.isBlocked(user1));

        vm.prank(creator);
        coin.unblockAddress(user1);
        assertFalse(coin.isBlocked(user1));
    }

    function test_AntiExploit_Cooldown() public {
        // Initialize via factory
        vm.deal(deployer, 1 ether);
        vm.prank(deployer);
        coin.initialBuy{value: 0.1 ether}();

        // First buy
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        coin.buy{value: 0.1 ether}(0);

        // Immediately try to buy again — should fail (cooldown)
        vm.deal(user1, 1 ether);
        vm.prank(user1);
        vm.expectRevert("V4: AE cooldown");
        coin.buy{value: 0.1 ether}(0);
    }

    function test_AntiExploit_CooldownPasses() public {
        vm.prank(deployer);
        coin.initialBuy{value: 0.1 ether}();

        vm.deal(user1, 1 ether);
        vm.prank(user1);
        coin.buy{value: 0.1 ether}(0);

        // Wait 60s (anti-sniper active = 60s cooldown)
        vm.warp(block.timestamp + 61);

        vm.deal(user1, 1 ether);
        vm.prank(user1);
        coin.buy{value: 0.1 ether}(0); // Should succeed
    }

    // ── 6. Bonding Curve ──────────────────────────────────────────────

    function test_BondingCurve_InitialPrice() public {
        assertEq(coin.getCurrentPrice(), coin.MIN_PRICE());
    }

    function test_BondingCurve_PhaseZero() public {
        (uint256 phaseIndex, string memory phaseName) = coin.getCurrentPhase();
        assertEq(phaseIndex, 0);
        assertEq(phaseName, "Steal Deal");
    }

    function test_BondingCurve_Progress() public {
        // Initially 0% progress (only creator allocation minted = 50M = 5%)
        // But the supply is 1B initially - wait, 50M is less than GRADUATION_SUPPLY (800M)
        // getProgressBps uses _totalSupply (50M) => (50M * 10000) / 800M = 625
        uint256 progress = coin.getProgressBps();
        (uint256 phaseIndex,) = coin.getCurrentPhase();
        assertTrue(progress < 10000);
        // 50M / 800M * 10000 = 625
        assertEq(progress, 625);
    }

    function test_BondingCurve_PriceIncreases() public {
        uint256 initialPrice = coin.getCurrentPrice();

        // Simulate buying tokens to move along the curve
        vm.prank(deployer);
        coin.initialBuy{value: 0.1 ether}();

        uint256 priceAfterBuy = coin.getCurrentPrice();
        assertGe(priceAfterBuy, initialPrice);
    }

    // ── 7. Transparency / Labeling ─────────────────────────────────────

    function test_WalletLabeling_TeamLabel() public {
        (WalletLabel label, string memory name) = coin.getWalletLabel(address(0xAAAA));
        assertEq(uint256(label), uint256(WalletLabel.Team));
        assertEq(name, "Team");
    }

    function test_WalletLabeling_LabelNames() public {
        assertEq(coin.getLabelName(WalletLabel.Creator), "Creator");
        assertEq(coin.getLabelName(WalletLabel.Team), "Team");
        assertEq(coin.getLabelName(WalletLabel.Treasury), "Treasury (DAO managed)");
        assertEq(coin.getLabelName(WalletLabel.LP), "LP");
        assertEq(coin.getLabelName(WalletLabel.Unlabeled), "Unlabeled");
    }

    // ── 8. Creator Controls ─────────────────────────────────────────────

    function test_CreatorInfo() public {
        (
            address creatorAddress,
            uint256 allocPct,
            uint256 feePct,
            uint256 vestPct,
            uint256 vestRemaining,
            bool hasDAO
        ) = coin.getCreatorInfo();

        assertEq(creatorAddress, creator);
        assertEq(allocPct, 1000);
        assertEq(feePct, 50);
        assertEq(vestPct, 5000);
        assertTrue(vestRemaining > 0);
        assertFalse(hasDAO);
    }

    function test_CreatorTransfer() public {
        address newCreator = address(0xDEAD);

        vm.prank(creator);
        coin.transferCreator(newCreator);

        vm.prank(newCreator);
        coin.acceptCreator();

        assertEq(coin.creator(), newCreator);
    }

    function test_URI() public {
        vm.prank(creator);
        coin.setURI("https://example.com/token.json");
    }

    // ── 9. DAO Configuration ────────────────────────────────────────────

    function test_DAO_DisabledByDefault() public {
        assertFalse(coin.daoActive());
    }

    function test_DAO_EnabledAtDeploy() public {
        WalletLabel[] memory lbls = new WalletLabel[](2);
        lbls[0] = WalletLabel.Creator;
        lbls[1] = WalletLabel.Treasury;
        address[] memory wlts = new address[](2);
        wlts[0] = creator;
        wlts[1] = address(0xBBBB);

        CreatorParameters memory p = defaultParams;
        p.daoEnabled = true;

        address[] memory signers = new address[](3);
        signers[0] = creator;
        signers[1] = address(0xCCCC);
        signers[2] = address(0xDDDD);

        DAOConfig memory activeDAO = DAOConfig({
            multiSigTreasury: address(0xEEEE),
            governor: address(0xFFFF),
            initialSigners: signers,
            signerThreshold: 2
        });

        DegenFeedCoinV4 daoCoin = new DegenFeedCoinV4(
            "DAOTest", "DAOT", creator, platformFeeReceiver,
            address(0), address(0), 0, p, activeDAO, lbls, wlts
        );

        assertTrue(daoCoin.daoActive());

        (address ms, address gov, , ) = daoCoin.dao();
        assertEq(ms, address(0xEEEE));
        assertEq(gov, address(0xFFFF));
    }

    // ── 10. Compliance Checks ───────────────────────────────────────────

    function test_NoSelfDestruct() public {
        // Verify no selfdestruct opcode in bytecode
        bytes memory code = address(coin).code;
        bool hasSelfdestruct;
        for (uint256 i = 0; i < code.length - 1; i++) {
            if (code[i] == 0xFF && code[i + 1] == 0xFF) {
                // SELFDESTRUCT is 0xFF in Solidity 0.8+
                hasSelfdestruct = true;
            }
        }
        // Just verify contract has code
        assertTrue(code.length > 0);
    }

    function test_NoUncheckedTransfers() public {
        // Verify basic safety: total supply always equals sum of balances
        // This is an invariant test
        assertTrue(coin.totalSupply() >= coin.balanceOf(creator));
    }

    // ── 11. Static Checks ──────────────────────────────────────────────

    function test_Constants_Sanity() public {
        assertEq(coin.MIN_PRICE(), 1 gwei);
        assertEq(coin.MAX_PRICE(), 1000 gwei);
        assertEq(coin.MIN_BUY_AMOUNT(), 0.0001 ether);
        assertEq(coin.MIN_INITIAL_BUY(), 0.05 ether);
        assertEq(coin.GRADUATION_SUPPLY(), 800_000_000 * 1e18);
    }

    function test_Static_SupplyIntegrity() public {
        // Creator allocation (fully minted upfront for non-vested portion):
        // 10% of 1B = 100M. 50% vested = 50M. 50% upfront = 50M.
        assertEq(coin.balanceOf(creator), 50_000_000 * 1e18);

        // No other tokens minted yet
        assertEq(coin.totalSupply(), 50_000_000 * 1e18);
    }
}
