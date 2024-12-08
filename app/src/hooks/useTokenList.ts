import { useQuery, useQueryClient } from "@tanstack/react-query";
import { TESTSUI_PACKAGE_ID, TESTSUI_ICON_URL, API_BASE_URL } from "../config";

export interface Token {
  id?: string;
  name: string;
  symbol: string;
  type: string;
  icon: string;
  decimals: number;
  treasuryCapHolderId?: string;
  collateralId?: string;
  metadataId?: string;
  totalSupply?: bigint;
  collectedSui?: bigint;
  status?: string;
  poolId?: string;
}

export function useTokenList() {
  const queryClient = useQueryClient();

  const updateTokenStatus = (
    tokenType: string, 
    totalSupply: string,
    collectedSui: string,
    status: string
  ) => {
    queryClient.setQueryData(["tokens"], (oldData: Token[] | undefined) => {
      if (!oldData) return oldData;
      
      return oldData.map(token => {
        if (token.type === tokenType) {
          const updatedToken = {
            ...token,
            totalSupply: totalSupply,
            collectedSui: collectedSui,
            status
          };
          console.log('Updating token:', tokenType, updatedToken);
          return updatedToken;
        }
        return token;
      });
    });
  };

  return {
    ...useQuery({
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
          const response = await fetch(`${API_BASE_URL}/tokens`);
          if (!response.ok) {
            throw new Error("获取代币列表失败");
          }
          const tokens: Token[] = await response.json();
          
          const formattedTokens = tokens.map(token => ({
            ...token,
            totalSupply: token.totalSupply?.toString(),
            collectedSui: token.collectedSui?.toString()
          }));
          
          return [...defaultTokens, ...formattedTokens] as Token[];
        } catch (error) {
          console.error("获取代币列表失败:", error);
          return defaultTokens;
        }
      },
    }),
    updateTokenStatus
  };
} 