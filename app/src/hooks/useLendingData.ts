import { useQueries } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { Lending } from "./useLendingList";
import { formatUnits } from '../utils/format';

interface LendingPoolFields {
  reserves: string;
  total_supplies: string;
  total_borrows: string;
  borrow_index: string;
  supply_index: string;
  borrow_rate: string;
  supply_rate: string;
  last_update_time: string;
  id: {
    id: string;
  };
}

export interface LendingPoolData {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  type: string;
  lendingPoolId: string;
  reserves: string;
  totalSupplies: string;
  totalBorrows: string;
  borrowIndex: string;
  supplyIndex: string;
  borrowRate: string;
  supplyRate: string;
  lastUpdateTime: string;
  ltv: number;
}

export function useLendingData(lendings?: Lending[]) {
  const suiClient = useSuiClient();

  const results = useQueries({
    queries: (lendings || []).map((lending) => ({
      queryKey: ["lending", lending.lendingPoolId],
      queryFn: async () => {
        const poolData = await suiClient.getObject({
          id: lending.lendingPoolId,
          options: {
            showContent: true,
          },
        });

        if (poolData.data?.content?.dataType !== "moveObject") {
          throw new Error("无效的借贷池数据");
        }

        const fields = poolData.data.content.fields as unknown as LendingPoolFields;
        
        return {
          id: lending.id,
          name: lending.name,
          symbol: lending.symbol,
          icon: lending.icon,
          type: lending.type,
          lendingPoolId: lending.lendingPoolId,
          ltv: lending.ltv,
          reserves: formatUnits(fields.reserves || "0", lending.decimals),
          totalSupplies: formatUnits(fields.total_supplies || "0", lending.decimals),
          totalBorrows: formatUnits(fields.total_borrows || "0", lending.decimals),
          borrowIndex: fields.borrow_index,
          supplyIndex: fields.supply_index,
          borrowRate: ((Number(fields.borrow_rate) / 1e4) * 100).toFixed(2) + "%",
          supplyRate: ((Number(fields.supply_rate) / 1e4) * 100).toFixed(2) + "%",
          lastUpdateTime: new Date(Number(fields.last_update_time)).toLocaleString(),
        } as LendingPoolData;
      },
      enabled: !!lending.lendingPoolId,
    })),
  });

  return results.map((result) => result.data).filter(Boolean) as LendingPoolData[];
}