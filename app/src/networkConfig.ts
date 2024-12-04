import { getFullnodeUrl } from "@mysten/sui/client";
import { createNetworkConfig } from "@mysten/dapp-kit";

const { networkConfig, useNetworkVariable, useNetworkVariables } =
  createNetworkConfig({
    devnet: {
      url: getFullnodeUrl("devnet"),

    },
    testnet: {
      url: "https://rpc-testnet.suiscan.xyz:443",

    },
    mainnet: {
      url: getFullnodeUrl("mainnet"),

    },
  });

export { useNetworkVariable, useNetworkVariables, networkConfig };
