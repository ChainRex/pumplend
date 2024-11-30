import { useQuery } from "@tanstack/react-query";
import { TESTSUI_PACKAGE_ID, TESTSUI_ICON_URL } from "../config";

export interface Token {
  id?: string;
  name: string;
  symbol: string;
  type: string;
  icon: string;
  decimals?: number;
  treasuryCapHolderId?: string;
  poolId?: string;
}

export function useTokenList() {
  return useQuery({
    queryKey: ["tokens"],
    queryFn: async (): Promise<Token[]> => {
      // 首先添加 TESTSUI
      const defaultTokens: Token[] = [{
        name: "TestSui Token",
        symbol: "TESTSUI",
        type: TESTSUI_PACKAGE_ID,
        icon: TESTSUI_ICON_URL,
        decimals: 9
      }];

      try {
        // 从后端获取其他代币
        const response = await fetch("http://localhost:3000/api/tokens");
        if (!response.ok) {
          throw new Error("获取代币列表失败");
        }
        const tokens: Token[] = await response.json();
        return [...defaultTokens, ...tokens];
      } catch (error) {
        console.error("获取代币列表失败:", error);
        return defaultTokens;
      }
    },
    // staleTime: 1000 * 60 * 5, // 5分钟缓存
  });
} 