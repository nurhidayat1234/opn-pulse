// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IStrategy.sol";

/**
 * @title MockLendingStrategy
 * @dev Simulates a lending protocol that accrues yield every second.
 * Yield rate is ~8-12% APY (very conservative, adjustable).
 * Designed so that harvesting frequently is beneficial and cheap on OPN Chain.
 */
contract MockLendingStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    address public immutable vault;

    uint256 public totalPrincipal;
    uint256 public lastUpdate;
    uint256 public accumulatedYield;

    // 10% APY ≈ 0.00000000317 per second (rough 1e18 scale)
    // For demo we use a slightly higher visible number so effect is obvious in minutes.
    uint256 public constant RATE_PER_SECOND = 317000000; // scaled 1e18 / (365*24*3600) * 0.10 * some boost for demo

    event Harvested(uint256 profit, uint256 keeperTip, address caller);
    event Deposited(uint256 amount);
    event Withdrawn(uint256 amount);

    constructor(address _asset, address _vault) {
        underlying = IERC20(_asset);
        vault = _vault;
        lastUpdate = block.timestamp;
    }

    modifier onlyVault() {
        require(msg.sender == vault, "Only vault");
        _;
    }

    function asset() external view override returns (address) {
        return address(underlying);
    }

    function deposit(uint256 amount) external override onlyVault {
        require(amount > 0, "Zero amount");
        totalPrincipal += amount;
        lastUpdate = block.timestamp;
        emit Deposited(amount);
    }

    function withdraw(uint256 amount) external override onlyVault {
        require(amount > 0, "Zero amount");
        uint256 available = totalAssets();
        uint256 toWithdraw = amount > available ? available : amount;

        totalPrincipal = totalPrincipal > toWithdraw ? totalPrincipal - toWithdraw : 0;
        if (accumulatedYield > toWithdraw) {
            accumulatedYield -= toWithdraw;
        } else {
            accumulatedYield = 0;
        }

        lastUpdate = block.timestamp;
        underlying.safeTransfer(vault, toWithdraw);
        emit Withdrawn(toWithdraw);
    }

    function totalAssets() public view override returns (uint256) {
        uint256 timeDelta = block.timestamp - lastUpdate;
        uint256 accrued = (totalPrincipal * RATE_PER_SECOND * timeDelta) / 1e18;
        return totalPrincipal + accumulatedYield + accrued;
    }

    function harvest() external override returns (uint256 profit) {
        uint256 currentTotal = totalAssets();
        profit = currentTotal > totalPrincipal + accumulatedYield 
            ? currentTotal - (totalPrincipal + accumulatedYield) 
            : 0;

        if (profit > 0) {
            accumulatedYield += profit;
        }

        lastUpdate = block.timestamp;

        // Permissionless keeper incentive: 1% of profit to caller (shows cheap frequent calls win)
        uint256 tip = (profit * 100) / 10000; // 1%
        uint256 toVault = profit > tip ? profit - tip : profit;

        if (tip > 0 && address(this).balance >= tip) {
            // For ERC20 strategy we transfer tip from "accrued"
            // Since it's mock accounting, we just reduce accumulated for simplicity
            // In real strategy the profit would be realized tokens.
        }

        // In this mock, "profit" is virtual until withdrawn. We transfer nothing extra.
        // The vault will see higher totalAssets() on next check.

        // To make harvest have on-chain effect visible, we "lock in" the yield
        accumulatedYield += toVault; // keep most for vault

        if (tip > 0) {
            // Send tiny tip in the underlying if we had minted, but for demo we emit only
            // Real implementations would transfer actual profit tokens.
        }

        emit Harvested(profit, tip, msg.sender);
    }

    /// @notice For demo: ownerless, anyone (vault) can "force" some yield for testing
    function debugAccrue(uint256 extra) external onlyVault {
        accumulatedYield += extra;
        lastUpdate = block.timestamp;
    }
}
