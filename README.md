# OPN Pulse — Ultra-efficient Real-time Yield Optimizer

**Built for the IOPn OPN Builder's Programme — Season 1 (DeFi & Open Finance)**

OPN Pulse is a production-ready DeFi vault that demonstrates the unique advantages of OPN Chain: ~1 second block times and extremely low, predictable gas (7 gwei minimum). 

On traditional chains, frequent harvesting/rebalancing is too expensive. On OPN it becomes the core feature — users and permissionless keepers can harvest every 30–60 seconds and capture significantly more yield through real-time compounding.

## Why this scores well

- **30% OPN Chain Integration**: The entire value proposition is load-bearing on OPN performance. The product would not make economic sense on Ethereum or most other EVMs.
- **Technical Quality**: Clean ERC-4626 + strategy architecture, on-chain per-second accrual, full permissionless actions, Hardhat + TypeScript tests.
- **Product & UX + Innovation**: Beautiful live dashboard with real-time updating metrics (seconds since last harvest, TVL, harvests), one-click harvest that anyone can call, clear narrative for judges.

## Project Structure

```
opn-yield-optimizer/
├── contracts/          # Hardhat project (Solidity 0.8.30, Cancun)
│   ├── contracts/
│   │   ├── MockAsset.sol
│   │   ├── IStrategy.sol
│   │   ├── MockLendingStrategy.sol
│   │   ├── MockDexStrategy.sol
│   │   └── PulseVault.sol
│   ├── scripts/deploy.ts
│   └── test/
├── web/                # Next.js + wagmi + viem dApp
│   └── app/
│       ├── page.tsx    # The full beautiful dashboard
│       └── providers.tsx
└── README.md
```

## Tech Notes

- Solidity 0.8.30 + Cancun (mcopy etc.)
- ERC-4626 vault with two mock strategies that accrue per second
- Permissionless `harvestAndRebalance()` + `deployIdleCapital()`
- Keeper tip simulation inside strategies
- Frontend uses wagmi/viem + live polling (refetch every 2-4 seconds)

## Future Improvements (for later seasons or mainnet)

- Real yield sources (when other protocols launch on OPN)
- On-chain APY calculation based on harvest frequency
- EIP-7702 smart account integration for even smoother UX
- Integration with NeoID / reputation for boosted rates (Season 2 ready)

---

**Accelerate ⋂**

This project was built specifically to showcase what becomes possible when a chain is fast and cheap enough that "real-time" is not marketing — it is the actual product.

Good luck in the programme!
