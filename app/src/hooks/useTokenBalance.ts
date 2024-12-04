import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";

export interface TokenBalance {
  formatted: string;  // 用于显示的格式化字符串
  raw: bigint;       // 原始余额数据
}

export function useTokenBalance(address: string | undefined, coinType: string | undefined) {
  const suiClient = useSuiClient();

  return useQuery({
    queryKey: ["tokenBalance", address, coinType],
    queryFn: async (): Promise<TokenBalance> => {
      if (!address || !coinType) return { formatted: "0", raw: BigInt(0) };

      try {
        const coins = await suiClient.getCoins({
          owner: address,
          coinType,
        });

        // 计算总余额
        const totalBalance = coins.data.reduce(
          (sum, coin) => sum + BigInt(coin.balance),
          BigInt(0)
        );

        return {
          formatted: (Number(totalBalance) / 1e9).toFixed(4),
          raw: totalBalance
        };
      } catch (error) {
        console.error("获取余额失败:", error);
        return { formatted: "0", raw: BigInt(0) };
      }
    },
    enabled: !!address && !!coinType,
  });
} 