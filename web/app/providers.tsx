"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { defineChain } from "viem";
import { useState } from "react";
import { Toaster } from "sonner";

// Define OPN Testnet as per official docs
export const opnTestnet = defineChain({
  id: 984,
  name: "OPN Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "OPN",
    symbol: "OPN",
  },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.iopn.tech"] },
  },
  blockExplorers: {
    default: { name: "OPNScan", url: "https://testnet.iopn.tech" },
  },
  testnet: true,
});

const config = createConfig({
  chains: [opnTestnet],
  connectors: [
    injected(),
  ],
  transports: {
    [opnTestnet.id]: http(),
  },
  ssr: true, // helps with hydration
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        {children}
        <Toaster position="top-center" richColors closeButton />
      </QueryClientProvider>
    </WagmiProvider>
  );
}
