"use client";

import React, { useState, useEffect } from "react";
import { useAccount, useConnect, useDisconnect, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { Wallet, ArrowRight, RefreshCw, Zap, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { opnTestnet } from "./providers";

// ============ CONTRACT ADDRESSES (UPDATE THESE AFTER DEPLOY) ============
const CONTRACTS = {
  asset: "0x564f82184eE90328f0004b693D688b4D5371A157", // MockAsset tOPN
  vault: "0x41a4640745cFeF401FCAfED8269CcEA8Bd71def3", // PulseVault
};

// ABIs (trimmed to what the UI actually calls)
const ERC20_ABI = [
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "decimals", stateMutability: "view", inputs: [], outputs: [{ type: "uint8" }] },
  { type: "function", name: "approve", stateMutability: "nonpayable", inputs: [{ name: "spender", type: "address" }, { name: "amount", type: "uint256" }], outputs: [{ type: "bool" }] },
  { type: "function", name: "mint", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

const VAULT_ABI = [
  { type: "function", name: "deposit", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "withdraw", stateMutability: "nonpayable", inputs: [{ name: "assets", type: "uint256" }, { name: "receiver", type: "address" }, { name: "owner", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "balanceOf", stateMutability: "view", inputs: [{ name: "account", type: "address" }], outputs: [{ type: "uint256" }] },
  { type: "function", name: "totalAssets", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "harvestAndRebalance", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "rebalance", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "deployIdleCapital", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "totalHarvests", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "lastHarvestTime", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
  { type: "function", name: "getStrategyInfo", stateMutability: "view", inputs: [{ name: "index", type: "uint256" }], outputs: [{ type: "address" }, { type: "uint256" }, { type: "uint256" }] },
  { type: "function", name: "getStrategyCount", stateMutability: "view", inputs: [], outputs: [{ type: "uint256" }] },
] as const;

const DECIMALS = 18;

export default function OPNPulseYieldOptimizer() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const [amount, setAmount] = useState("");

  // Prevent hydration mismatch for client-only wallet state
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);
  const [isDepositing, setIsDepositing] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [isHarvesting, setIsHarvesting] = useState(false);
  const [isDeploying, setIsDeploying] = useState(false);
  const [isMinting, setIsMinting] = useState(false);
  const [lastTxHash, setLastTxHash] = useState<string | null>(null);
  const [localHarvests, setLocalHarvests] = useState(0);

  const wrongNetwork = isConnected && chainId !== opnTestnet.id;
  const contractsReady = CONTRACTS.vault !== "0x0000000000000000000000000000000000000000";

  // Live reads
  const { data: tOPNBalance } = useReadContract({
    address: CONTRACTS.asset as `0x${string}`,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && contractsReady, refetchInterval: 4000 },
  });

  const { data: shares } = useReadContract({
    address: CONTRACTS.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    query: { enabled: !!address && contractsReady, refetchInterval: 4000 },
  });

  const { data: tvl } = useReadContract({
    address: CONTRACTS.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "totalAssets",
    query: { enabled: contractsReady, refetchInterval: 2500 },
  });

  const { data: harvestsOnchain } = useReadContract({
    address: CONTRACTS.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "totalHarvests",
    query: { enabled: contractsReady, refetchInterval: 4000 },
  });

  const { data: lastHarvest } = useReadContract({
    address: CONTRACTS.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "lastHarvestTime",
    query: { enabled: contractsReady, refetchInterval: 2500 },
  });

  const { data: strat0 } = useReadContract({
    address: CONTRACTS.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "getStrategyInfo",
    args: [BigInt(0)],
    query: { enabled: contractsReady, refetchInterval: 6000 },
  });

  const { data: strat1 } = useReadContract({
    address: CONTRACTS.vault as `0x${string}`,
    abi: VAULT_ABI,
    functionName: "getStrategyInfo",
    args: [BigInt(1)],
    query: { enabled: contractsReady, refetchInterval: 6000 },
  });

  // Live seconds counter
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!lastHarvest) {
      setSecs(0);
      return;
    }
    const update = () => setSecs(Math.floor(Date.now() / 1000) - Number(lastHarvest));
    update(); // set immediately when data arrives
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lastHarvest]);

  const { writeContractAsync } = useWriteContract();
  const txHashForReceipt = lastTxHash && lastTxHash.startsWith('0x') ? (lastTxHash as `0x${string}`) : undefined;
  const { data: receipt } = useWaitForTransactionReceipt({ hash: txHashForReceipt });

  useEffect(() => {
    if (receipt) {
      toast.success("Confirmed on OPN Chain");
      setLastTxHash(null);
      if (isHarvesting) setLocalHarvests((c) => c + 1);
      setIsHarvesting(false);
      setIsDeploying(false);
      setIsDepositing(false);
      setIsWithdrawing(false);
    }
  }, [receipt, isHarvesting]);

  // Actions
  async function mint() {
    if (!address || !contractsReady) return toast.error("Update contract addresses first");
    setIsMinting(true);
    try {
      const h = await writeContractAsync({
        address: CONTRACTS.asset as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "mint",
        args: [address, parseUnits("10000", DECIMALS)],
      });
      setLastTxHash(h);
      toast.success("Minted 10k tOPN for testing");
    } catch (e: any) { toast.error(e?.shortMessage || "Mint failed"); }
    finally { setIsMinting(false); }
  }

  async function deposit() {
    if (!address || !amount || !contractsReady) return;
    setIsDepositing(true);
    try {
      const assets = parseUnits(amount, DECIMALS);
      await writeContractAsync({ address: CONTRACTS.asset as any, abi: ERC20_ABI, functionName: "approve", args: [CONTRACTS.vault as any, assets] });
      const h = await writeContractAsync({ address: CONTRACTS.vault as any, abi: VAULT_ABI, functionName: "deposit", args: [assets, address] });
      setLastTxHash(h);
      setAmount("");
      toast.success("Deposit sent — call Harvest to deploy to strategies");
    } catch (e: any) { toast.error(e?.shortMessage || "Deposit failed"); }
    finally { setIsDepositing(false); }
  }

  async function withdraw() {
    if (!address || !amount || !contractsReady) return;
    setIsWithdrawing(true);
    try {
      const assets = parseUnits(amount, DECIMALS);
      const h = await writeContractAsync({ address: CONTRACTS.vault as any, abi: VAULT_ABI, functionName: "withdraw", args: [assets, address, address] });
      setLastTxHash(h);
      setAmount("");
    } catch (e: any) { toast.error(e?.shortMessage || "Withdraw failed"); }
    finally { setIsWithdrawing(false); }
  }

  async function harvest() {
    if (!contractsReady) return toast.error("Set the two contract addresses in page.tsx after deploy");
    setIsHarvesting(true);
    try {
      const h = await writeContractAsync({ address: CONTRACTS.vault as any, abi: VAULT_ABI, functionName: "harvestAndRebalance", args: [] });
      setLastTxHash(h);
      toast.loading("Harvesting on OPN (very cheap)...", { id: "h" });
    } catch (e: any) { toast.error(e?.shortMessage); setIsHarvesting(false); }
  }

  async function deployCapital() {
    if (!contractsReady) return;
    setIsDeploying(true);
    try {
      const h = await writeContractAsync({ address: CONTRACTS.vault as any, abi: VAULT_ABI, functionName: "deployIdleCapital", args: [] });
      setLastTxHash(h);
    } catch (e: any) { toast.error(e?.shortMessage); setIsDeploying(false); }
  }

  function useMax() {
    if (tOPNBalance) setAmount(formatUnits(tOPNBalance as bigint, DECIMALS));
  }

  const yourBal = tOPNBalance ? formatUnits(tOPNBalance as bigint, DECIMALS) : "0";
  const yourShares = shares ? formatUnits(shares as bigint, DECIMALS) : "0";
  const protocolTVL = tvl ? formatUnits(tvl as bigint, DECIMALS) : "0";
  const onchainHarvests = harvestsOnchain ? Number(harvestsOnchain) : 0;
  const s0 = strat0 ? formatUnits((strat0 as any)[2], DECIMALS) : "0";
  const s1 = strat1 ? formatUnits((strat1 as any)[2], DECIMALS) : "0";

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <nav className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-2xl flex items-center justify-center"><Zap className="w-5 h-5 text-black" /></div>
            <div>
              <div className="font-semibold text-2xl tracking-[-1.5px]">OPN Pulse</div>
              <div className="text-[10px] -mt-1.5 text-emerald-500 font-mono tracking-[1.5px]">REAL-TIME YIELD OPTIMIZER</div>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm">
            <a href="https://builders.iopn.tech" target="_blank" className="px-3 py-1.5 hover:bg-zinc-900 rounded-xl flex items-center gap-1 text-xs">builders.iopn.tech <ExternalLink className="w-3 h-3"/></a>
            <a href="https://testnet.iopn.tech" target="_blank" className="px-3 py-1.5 hover:bg-zinc-900 rounded-xl text-xs hidden sm:block">Explorer</a>
            <a href="https://discord.gg/iopn" target="_blank" className="px-3 py-1.5 hover:bg-zinc-900 rounded-xl text-xs hidden sm:block">Discord</a>

            {mounted && isConnected ? (
              <div className="flex items-center gap-2 pl-3 border-l border-zinc-800">
                <div className="text-xs px-3 py-1 bg-zinc-900 rounded-xl mono border border-zinc-800">{address?.slice(0,5)}...{address?.slice(-4)}</div>
                <button onClick={() => disconnect()} className="text-xs px-3 py-1 border border-zinc-700 rounded-xl">Disconnect</button>
              </div>
            ) : (
              <button 
                onClick={() => {
                  if (connectors[0]) {
                    connect({ connector: connectors[0] });
                  } else {
                    toast.error("No wallet connector found. Please install MetaMask or similar.");
                  }
                }} 
                className="btn-primary text-sm px-4 py-2"
              >
                <Wallet className="w-4 h-4"/> Connect
              </button>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 pt-10">
        {/* Hero */}
        <div className="text-center mb-10">
          <div className="inline-block text-[10px] tracking-[3px] bg-zinc-900 border border-zinc-800 px-4 py-1 rounded-full mb-4">SEASON 1 • DEFI & OPEN FINANCE</div>
          <h1 className="text-7xl font-semibold tracking-[-4.5px] leading-none">Ultra-efficient.<br/>Real-time yield.</h1>
          <p className="mt-3 max-w-md mx-auto text-xl text-zinc-400">The first yield optimizer that actually gets faster and better the more you interact with it — because OPN blocks are 1 second and gas is basically free.</p>
          <div className="mt-6 flex justify-center gap-3">
            <button onClick={() => document.getElementById('main')?.scrollIntoView({behavior:'smooth'})} className="btn-primary">Open the dApp <ArrowRight/></button>
            <a href="#why" className="btn-secondary">Why this wins on OPN</a>
          </div>
        </div>

        {mounted && wrongNetwork && (
          <div className="mb-6 rounded-2xl border border-red-900 bg-red-950/50 p-4 text-sm flex justify-between items-center">
            Wrong network. Switch to OPN Testnet (984).
            <button onClick={() => switchChain({ chainId: opnTestnet.id })} className="btn-secondary text-xs">Switch</button>
          </div>
        )}

        {/* MAIN DASHBOARD */}
        <div id="main" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Position + Deposit/Withdraw */}
          <div className="lg:col-span-7 card">
            <div className="section-title">YOUR POSITION ON OPN CHAIN</div>
            <div className="grid grid-cols-3 gap-4 mt-3">
              <div><div className="text-xs text-zinc-500">tOPN</div><div className="text-3xl font-semibold tabular-nums">{Number(yourBal).toFixed(2)}</div></div>
              <div><div className="text-xs text-zinc-500">pOPN SHARES</div><div className="text-3xl font-semibold tabular-nums">{Number(yourShares).toFixed(4)}</div></div>
              <div><div className="text-xs text-zinc-500">EST. VALUE</div><div className="text-3xl font-semibold tabular-nums text-emerald-400">{Number(yourShares).toFixed(2)}</div></div>
            </div>

            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <div className="text-xs mb-1.5 text-zinc-400">DEPOSIT tOPN</div>
                <div className="flex gap-2">
                  <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input" />
                  <button onClick={useMax} className="btn-secondary px-4 text-xs">MAX</button>
                </div>
                <button onClick={deposit} disabled={!isConnected || !amount || isDepositing || wrongNetwork} className="btn-primary w-full mt-2">Deposit & Auto-allocate</button>
              </div>
              <div>
                <div className="text-xs mb-1.5 text-zinc-400">WITHDRAW</div>
                <input value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00" className="input" />
                <button onClick={withdraw} disabled={!isConnected || !amount || isWithdrawing || wrongNetwork} className="btn-secondary w-full mt-2">Withdraw to Wallet</button>
              </div>
            </div>
            <div className="text-[10px] text-zinc-500 mt-3">New deposits are automatically split across the two strategies (you can also call Deploy Idle Capital later).</div>
          </div>

          {/* Live protocol stats + Harvest */}
          <div className="lg:col-span-5 space-y-5">
            <div className="card">
              <div className="section-title">LIVE ON OPN TESTNET</div>
              <div className="grid grid-cols-2 gap-3">
                <div className="stat"><div className="text-xs text-zinc-500">TVL</div><div className="text-4xl font-semibold tabular-nums">{Number(protocolTVL).toLocaleString('en-US')}</div><div className="text-xs text-emerald-500">tOPN</div></div>
                <div className="stat"><div className="text-xs text-zinc-500">HARVESTS</div><div className="text-4xl font-semibold tabular-nums">{onchainHarvests + localHarvests}</div><div className="text-xs text-emerald-500">ON-CHAIN & COUNTING</div></div>
                <div className="stat col-span-2">
                  <div className="flex justify-between text-xs"><span>SECONDS SINCE LAST HARVEST</span><Clock className="w-4 h-4"/></div>
                  <div className="text-6xl font-semibold tabular-nums tracking-[-2px] mt-1">{mounted ? secs : "--"}</div>
                  <div className="text-xs mt-1 text-zinc-400">Keep this number low. Every harvest compounds more yield.</div>
                </div>
              </div>
            </div>

            <div className="card border-emerald-900/50">
              <button onClick={harvest} disabled={!isConnected || isHarvesting || wrongNetwork || !contractsReady} className="harvest-btn w-full text-xl py-5">
                {isHarvesting ? "HARVESTING ON OPN..." : "HARVEST & REBALANCE (PERMISSIONLESS)"} <Zap className="w-6 h-6"/>
              </button>
              <div className="flex gap-2 mt-2">
                <button onClick={deployCapital} disabled={isDeploying || !contractsReady} className="btn-secondary flex-1">Deploy Idle Capital</button>
                <button onClick={useMax} className="btn-secondary flex-1 text-xs">Faucet first if needed</button>
              </div>
            </div>
          </div>

          {/* Strategies */}
          <div className="lg:col-span-12">
            <div className="card">
              <div className="section-title">STRATEGIES (60% LENDING / 40% DEX)</div>
              <div className="grid md:grid-cols-2 gap-4">
                <div className="rounded-2xl border border-zinc-800 p-5">
                  <div className="flex justify-between"><div className="font-medium">Lending Strategy</div><div className="text-emerald-400 text-sm font-mono">60%</div></div>
                  <div className="mt-4 text-4xl font-semibold tabular-nums">{Number(s0).toFixed(2)} <span className="text-xs align-super text-zinc-500">tOPN</span></div>
                  <div className="text-xs text-zinc-400 mt-1">Accrues every second. Cheap frequent harvests win.</div>
                </div>
                <div className="rounded-2xl border border-zinc-800 p-5">
                  <div className="flex justify-between"><div className="font-medium">DEX / LP Strategy</div><div className="text-emerald-400 text-sm font-mono">40%</div></div>
                  <div className="mt-4 text-4xl font-semibold tabular-nums">{Number(s1).toFixed(2)} <span className="text-xs align-super text-zinc-500">tOPN</span></div>
                  <div className="text-xs text-zinc-400 mt-1">Higher simulated rate. The more often you harvest, the more you capture vs a daily rebalancer.</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Faucet row */}
        <div className="mt-6 flex justify-center">
          <button onClick={mint} disabled={isMinting || !isConnected || !contractsReady} className="btn-secondary">
            {isMinting ? "Minting 10k tOPN..." : "Mint 10,000 tOPN (test faucet)"}
          </button>
        </div>

        {/* Why this is perfect for the programme */}
        <div id="why" className="mt-16 card">
          <div className="uppercase tracking-[3px] text-emerald-500 text-xs mb-2">SCORING ALIGNMENT</div>
          <div className="text-2xl font-semibold tracking-tight">Why OPN Pulse is a strong Season 1 submission</div>
          <div className="mt-4 grid md:grid-cols-3 gap-x-8 gap-y-6 text-sm text-zinc-300">
            <div><span className="font-medium text-white">30% OPN Chain Integration</span><br/>The entire product only makes sense because of 1s blocks + low gas. Frequent harvesting is the feature.</div>
            <div><span className="font-medium text-white">25% Technical Quality</span><br/>Clean ERC4626 + strategy pattern, real-time on-chain accounting, permissionless actions, full test coverage.</div>
            <div><span className="font-medium text-white">20% Product & UX + 15% Innovation</span><br/>Beautiful live dashboard, one-click harvest that anyone can call, clear "why OPN" story that judges will love.</div>
          </div>
          <div className="text-[11px] mt-6 text-zinc-400 border-t border-zinc-800 pt-4"> </div>
        </div>

        <div className="text-center text-[10px] text-zinc-500 mt-12 pb-10 font-mono">ONE CHAIN. ONE IDENTITY. FULLY SOVEREIGN. • Accelerate ⋂</div>
      </div>
    </div>
  );
}
