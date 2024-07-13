import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  polygon,
  sepolia,
} from "wagmi/chains";

// Define Zircuit Testnet
const ZircuitTestnet = {
  id: 48899,
  name: "Zircuit Testnet",
  network: "Zircuit",
  iconUrl:
    "https://docs.zircuit.com/~gitbook/image?url=https%3A%2F%2F3252263143-files.gitbook.io%2F%7E%2Ffiles%2Fv0%2Fb%2Fgitbook-x-prod.appspot.com%2Fo%2Fspaces%252Fp2pPzGBdConDaqw5tnHs%252Ficon%252FGV9G7nYP6O3OMyRG6XKp%252FGroup%25201547764316.png%3Falt%3Dmedia%26token%3D22a0e495-7f39-4f49-85b3-990e33435061&width=32&dpr=2&quality=100&sign=c0551c4d&sv=1",
  iconBackground: "#FFFFFF",
  nativeCurrency: {
    decimals: 18,
    name: "ZirETH",
    symbol: "ZirETH",
  },
  rpcUrls: {
    default: {
      http: ["https://zircuit1.p2pify.com"],
    },
    public: {
      http: ["https://zircuit1.p2pify.com"],
    },
  },
  blockExplorers: {
    default: {
      name: "Zircuit Explorer",
      url: "https://explorer.zircuit.com/", // Replace with actual explorer URL
    },
  },
};

export const config = getDefaultConfig({
  appName: "RainbowKit App",
  projectId: "YOUR_PROJECT_ID", // Replace this with your actual project ID
  chains: [
    mainnet,
    polygon,
    optimism,
    arbitrum,
    base,
    sepolia,
    ZircuitTestnet,
    ...(process.env.NEXT_PUBLIC_ENABLE_TESTNETS === "false"
      ? [ZircuitTestnet]
      : []),
  ],
  ssr: true,
});
