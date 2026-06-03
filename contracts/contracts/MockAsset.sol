// SPDX-License-Identifier: MIT
pragma solidity ^0.8.30;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title MockAsset
 * @dev Test token for OPN Pulse Yield Optimizer demo.
 * Users can mint freely on testnet for testing the vault.
 * In real deployment this would be replaced by OPN or a real stable/RWA token.
 */
contract MockAsset is ERC20, Ownable {
    uint8 private constant _decimals = 18;

    constructor() ERC20("OPN Test Asset", "tOPN") Ownable(msg.sender) {}

    function decimals() public pure override returns (uint8) {
        return _decimals;
    }

    /// @notice Anyone can mint on testnet for easy testing (demo only)
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }

    /// @notice Owner can mint larger amounts if needed
    function ownerMint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }
}
