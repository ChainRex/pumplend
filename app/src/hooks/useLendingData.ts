import { useQueries } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";
import { Lending } from "./useLendingList";
import { formatUnits } from '../utils/format';
import { API_BASE_URL } from '../config';

interface LendingPoolFields {
  reserves: string;
  donation_reserves: string;
  total_donations: string;
  donations_lent_out: string;
  max_donation_to_lend_ratio: string;
  borrow_interest_rate_discount: string;
  extra_supply_interest_rate_bonus: string;
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
  cetusPoolId?: string;
  reserves: string;
  donationReserves: string;
  totalDonations: string;
  donationsLentOut: string;
  maxDonationRatio: string;
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
        
        const tokenResponse = await fetch(`${API_BASE_URL}/tokens/${lending.type}/pool`);
        const tokenData = await tokenResponse.json();
        
        const reserves = BigInt(fields.reserves || "0");
        const totalDonations = BigInt(fields.total_donations || "0");
        const donationsLentOut = BigInt(fields.donations_lent_out || "0");
        const maxDonationRatio = BigInt(fields.max_donation_to_lend_ratio || "0");
        
        const availableDonations = (totalDonations * maxDonationRatio) / BigInt(10000) - donationsLentOut;
        
        const totalAvailableReserves = reserves + availableDonations;
        
        const formatRate = (baseRate: number, adjustment: number, isSupply: boolean) => {
          const baseRatePercent = (baseRate / 1e4) * 100;
          const adjustmentPercent = (adjustment / 1e2) * 100;
          
          if (isSupply) {
            // 存款利率 = 基础利率 + 加成
            const totalRate = baseRatePercent + adjustmentPercent;
            // 即使基础利率为0，也显示加成后的利率
            return `${totalRate.toFixed(2)}% (${baseRatePercent.toFixed(2)}% + ${adjustmentPercent.toFixed(2)}%)`;
          } else {
            // 借款利率 = 基础利率 - 折扣，且不低于0
            // 确保折扣不超过基础利率
            const effectiveAdjustment = Math.min(adjustmentPercent, baseRatePercent);
            const totalRate = baseRatePercent - effectiveAdjustment;
            
            return baseRatePercent === 0 
              ? "0.00%"
              : `${totalRate.toFixed(2)}% (${baseRatePercent.toFixed(2)}% - ${effectiveAdjustment.toFixed(2)}%)`;
          }
        };
        
        return {
          id: lending.id,
          name: lending.name,
          symbol: lending.symbol,
          icon: lending.icon,
          type: lending.type,
          lendingPoolId: lending.lendingPoolId,
          cetusPoolId: tokenData?.poolId,
          ltv: lending.ltv,
          reserves: formatUnits(totalAvailableReserves.toString(), lending.decimals),
          donationReserves: formatUnits(fields.donation_reserves || "0", lending.decimals),
          totalDonations: formatUnits(fields.total_donations || "0", lending.decimals),
          donationsLentOut: formatUnits(fields.donations_lent_out || "0", lending.decimals),
          maxDonationRatio: ((Number(fields.max_donation_to_lend_ratio) / 100)).toFixed(2) + "%",
          totalSupplies: formatUnits(fields.total_supplies || "0", lending.decimals),
          totalBorrows: formatUnits(fields.total_borrows || "0", lending.decimals),
          borrowIndex: fields.borrow_index,
          supplyIndex: fields.supply_index,
          borrowRate: formatRate(
            Number(fields.borrow_rate), 
            Number(fields.borrow_interest_rate_discount), 
            false
          ),
          supplyRate: formatRate(
            Number(fields.supply_rate), 
            Number(fields.extra_supply_interest_rate_bonus), 
            true
          ),
          lastUpdateTime: new Date(Number(fields.last_update_time)).toLocaleString(),
        } as LendingPoolData;
      },
      enabled: !!lending.lendingPoolId,
    })),
  });

  return results.map((result) => result.data).filter(Boolean) as LendingPoolData[];
}