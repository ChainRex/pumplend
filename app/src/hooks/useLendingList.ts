import { useQuery, useQueryClient } from "@tanstack/react-query";
import { API_BASE_URL } from "../config";

export interface Lending {
  id: string;
  name: string;
  symbol: string;
  type: string;
  icon: string;
  decimals: number;
  metadataId: string;
  lendingPoolId: string;
  ltv: number;
  liquidation_threshold: number;
}

export function useLendingList() {
  const queryClient = useQueryClient();

  const invalidateLendings = () => {
    queryClient.invalidateQueries({ queryKey: ["lendings"] });
  };

  return {
    ...useQuery({
      queryKey: ["lendings"],
      queryFn: async (): Promise<Lending[]> => {
        try {
          const response = await fetch(`${API_BASE_URL}/lendings`);
          if (!response.ok) {
            throw new Error("获取借贷池列表失败");
          }
          return response.json();
        } catch (error) {
          console.error("获取借贷池列表失败:", error);
          return [];
        }
      },
    }),
    invalidateLendings,
  };
} 