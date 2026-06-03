// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

/**
 * @title IStrategy
 * @dev Interface for strategies used by PulseVault.
 * Strategies are responsible for generating yield on deposited assets.
 */
interface IStrategy {
    /// @notice Deposit underlying into the strategy
    function deposit(uint256 amount) external;

    /// @notice Withdraw underlying from the strategy back to vault
    function withdraw(uint256 amount) external;

    /// @notice Harvest accrued yield. Returns the profit generated (in underlying).
    /// Caller (usually the vault or keeper) may receive a small tip.
    function harvest() external returns (uint256 profit);

    /// @notice Total assets currently managed by this strategy (principal + accrued)
    function totalAssets() external view returns (uint256);

    /// @notice Underlying asset this strategy uses
    function asset() external view returns (address);
}
