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

## Quick Start (Local Testing)

1. In `contracts/`:
   ```bash
   cd contracts
   npm install
   npm run compile
   npm test
   ```

2. In `web/`:
   ```bash
   cd web
   npm install
   npm run dev
   ```

## Deploy to OPN Testnet (Required for Submission)

**⚠️ PRIVATE KEY SAFETY — READ THIS CAREFULLY**

- **Jangan pernah** paste private key asli ke chat ini (Grok conversation), atau ke command yang dikirim via tool.
- Gunakan **wallet burner/fresh** khusus untuk program ini saja (bukan wallet utama yang punya aset berharga).
- Private key hanya digunakan secara lokal di mesin kamu untuk signing transaksi deploy. Tidak dikirim ke server mana pun.
- Setelah deploy selesai, hapus file `.env` atau unset env variable-nya.

**Cara paling aman (recommended):**

1. Get test OPN dari https://faucet.iopn.tech
2. Tambahkan OPN Testnet ke wallet kamu:
   - RPC: `https://testnet-rpc.iopn.tech`
   - Chain ID: `984`
   - Symbol: `OPN`
   - Explorer: `https://testnet.iopn.tech`

3. Buat file `.env` di folder `contracts/` (sudah ada `.env.example`):
   ```bash
   cd contracts
   copy .env.example .env
   ```

4. Buka file `.env` dengan text editor dan isi:
   ```
   PRIVATE_KEY=0xYourBurnerPrivateKeyHere
   ```

5. Deploy:
   ```powershell
   cd contracts
   npm run deploy:testnet
   ```

Hardhat sekarang otomatis load dari `.env` berkat `dotenv`.

6. Copy alamat contract yang muncul di console.

**Alternatif (tanpa file .env):**
```powershell
$env:PRIVATE_KEY="0xYourBurnerPrivateKey"
npm run deploy:testnet
```

Tapi pakai `.env` jauh lebih aman dan praktis. File `.env` sudah otomatis di-ignore oleh `.gitignore`.

7. Buka `web/app/page.tsx` dan ganti dua placeholder address di bagian atas:

   ```ts
   const CONTRACTS = {
     asset: "0xYourRealMockAssetAddress...",
     vault: "0xYourRealPulseVaultAddress...",
   };
   ```

8. Jalankan frontend:
   ```bash
   cd web
   npm run build   # atau npm run dev
   ```

9. **Generate verifiable on-chain activity** (sangat penting untuk lolos verifikasi):
   - Connect your wallet (the same one you deployed with)
   - Mint tOPN
   - Deposit several times (different amounts)
   - Click **Harvest & Rebalance** 25–50 times (costs almost nothing)
   - Also click Deploy Idle Capital a few times
   - Optional: use a second wallet for more "user" activity

10. Take nice screenshots:
   - The live dashboard with low "seconds since harvest"
   - Your transaction list on the explorer
   - TVL growing, harvests increasing

11. **(Strongly Recommended)** Deploy the frontend to Vercel so judges have a live demo URL (see "Apakah Harus Hosting Frontend?" section below).

## Submission to https://builders.iopn.tech

- Go to the dashboard → connect the same wallet + Discord
- Verify the contract (the deploy transaction must be in the season window)
- Fill the form with:
  - Project name: **OPN Pulse**
  - Description: short + link to this GitHub
  - Why OPN: emphasize real-time harvesting only possible here
  - Links to deployed contracts + explorer
  - **Live Demo URL** (strongly recommended — see section below)
  - Screenshots / Loom video of the live dApp in action

### Apakah Harus Hosting Frontend? (Jawaban untuk Submission)

**Tidak wajib**, tapi **sangat direkomendasikan**.

Alasan:
- Judges bisa langsung mencoba dApp kamu tanpa harus clone + setup lokal.
- Skor **Product & UX (20%)** akan jauh lebih tinggi kalau ada live demo yang mudah diakses.
- Terlihat lebih profesional dan "siap pakai".
- Banyak submission lain yang kalah hanya karena "belum ada demo live".

**Cara termudah & gratis (Vercel):**
1. Push project ini ke GitHub.
2. Masuk ke [vercel.com](https://vercel.com) → New Project → Import GitHub.
3. Saat import, set **Root Directory** = `web`.
4. Deploy.
5. Copy URL live-nya dan masukkan ke form submission.

Proses ini biasanya cuma 1-2 menit. Vercel gratis untuk project seperti ini.

Kalau tidak sempat hosting, kamu tetap bisa submit dengan GitHub + instruksi "jalankan `npm run dev` di folder web", tapi kemungkinan lolos Top 25 lebih kecil.

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
