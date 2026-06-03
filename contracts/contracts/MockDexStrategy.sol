// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./IStrategy.sol";

/**
 * @title MockDexStrategy
 * @dev Higher yield "DEX LP / farm" simulation with a bit more variance.
 * Higher rate to demonstrate the optimizer choosing / benefiting from allocation.
 * Real-time harvesting still wins big because of OPN's 1s blocks + low fees.
 */
contract MockDexStrategy is IStrategy {
    using SafeERC20 for IERC20;

    IERC20 public immutable underlying;
    address public immutable vault;

    uint256 public totalPrincipal;
    uint256 public lastUpdate;
    uint256 public accumulatedYield;

    // ~18% APY demo rate (higher than lending, "riskier")
    uint256 public constant RATE_PER_SECOND = 570000000; // scaled

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
        if (accumulatedYield > toWithdraw) accumulatedYield -= toWithdraw;
        else accumulatedYield = 0;

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
        profit = currentTotal > (totalPrincipal + accumulatedYield) 
            ? currentTotal - (totalPrincipal + accumulatedYield) 
            : 0;

        lastUpdate = block.timestamp;

        uint256 tip = (profit * 80) / 10000; // 0.8% keeper tip (incentivize frequent calls)
        uint256 toCompound = profit > tip ? profit - tip : profit;

        accumulatedYield += toCompound;

        emit Harvested(profit, tip, msg.sender);
    }

    function debugAccrue(uint256 extra) external onlyVault {
        accumulatedYield += extra;
        lastUpdate = block.timestamp;
    }
}
