import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { useLendingList } from "../../hooks/useLendingList";
import { LendingPoolData, useLendingData } from "../../hooks/useLendingData";
import { formatUnits } from '../../utils/format';
import { ClipLoader } from "react-spinners";

interface SuppliedAsset {
  name: string;
  symbol: string;
  logo: string;
  supplied: string;
  value: string;
  apy: string;
  baseRate: string;
  bonusRate: string;
  maxLtv: number;
}

interface SuppliedAssetsTableProps {
  userPosition: any;
  isLoading: boolean;
  maxBorrowValue: string | null;
  onSupplyClick: (asset: LendingPoolData, supplied: string) => void;
  onWithdrawClick?: (asset: LendingPoolData) => void;
}

export function SuppliedAssetsTable({ 
  userPosition, 
  isLoading,
  maxBorrowValue,
  onSupplyClick,
  onWithdrawClick
}: SuppliedAssetsTableProps) {
  const { data: lendings } = useLendingList();
  const lendingPoolsData = useLendingData(lendings);

  console.log("userPosition:", userPosition);
  console.log("lendings:", lendings);
  console.log("lendingPoolsData:", lendingPoolsData);

  // 处理数据转换
  const suppliedAssets: SuppliedAsset[] = userPosition?.assets.map((asset: any, index: number) => {
    console.log("Processing asset:", asset);
    const pool = lendingPoolsData.find(p => p.type === `0x${asset.name}`);
    console.log("Found pool:", pool);

    if (!pool) {
      console.log("Pool not found for asset:", asset.name);
      return null;
    }

    const supplyAmount = formatUnits(userPosition.supplies[index], 9);
    console.log("Supply amount:", supplyAmount);
    const value = (parseFloat(supplyAmount) * pool.price).toFixed(2);
    console.log("Value:", value);

    const supplyRateMatch = pool.supplyRate.match(/(\d+\.\d+)%\s*\((\d+\.\d+)%\s*\+\s*(\d+\.\d+)%\)/);
    const totalRate = supplyRateMatch ? parseFloat(supplyRateMatch[1]) : 0;
    const baseRate = supplyRateMatch ? parseFloat(supplyRateMatch[2]) : 0;
    const bonusRate = supplyRateMatch ? parseFloat(supplyRateMatch[3]) : 0;

    return {
      name: pool.name,
      symbol: pool.symbol,
      logo: pool.icon,
      supplied: supplyAmount,
      value,
      apy: totalRate.toFixed(2),
      baseRate: baseRate.toFixed(2),
      bonusRate: bonusRate.toFixed(2),
      maxLtv: pool.ltv
    };
  }).filter(Boolean) || [];

  console.log("Final suppliedAssets:", suppliedAssets);

  return (
    <Box className="section-card" mb="4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Your Supplies</Text>
        <Text>Collateral: {maxBorrowValue ? parseFloat(maxBorrowValue).toFixed(4) : "0.0000"} SUI</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '20%' }}>Asset</Box>
          <Box style={{ width: '30%' }}>Balance</Box>
          <Box style={{ width: '20%' }}>APY</Box>
          <Box style={{ width: '10%' }}>Max LTV</Box>
          <Box style={{ width: '20%' }}>Actions</Box>
        </Flex>
        {isLoading ? (
          <Flex justify="center" p="4">
            <ClipLoader size={24} />
          </Flex>
        ) : suppliedAssets.length > 0 ? (
          suppliedAssets.map((asset, index) => (
            <Flex key={index} className="table-row" p="2" align="center">
              <Box style={{ width: '20%' }}>
                <Flex align="center" gap="2">
                  <img src={asset.logo} alt={asset.name} className="asset-logo" />
                  <Text>{asset.symbol}</Text>
                </Flex>
              </Box>
              <Box style={{ width: '30%' }}>
                <Text>{asset.supplied}</Text>
              </Box>
              <Box style={{ width: '20%' }}>
                <Box position="relative">
                  <Flex direction="column" gap="1" className="apy-container">
                    <Text color="green">{asset.apy}%</Text>
                    <Text size="1" style={{ textDecoration: 'line-through' }} color="gray">
                      {asset.baseRate}%
                    </Text>
                    <Box className="apy-tooltip-wrapper">
                      <APYTooltip 
                        baseRate={asset.baseRate} 
                        bonusRate={asset.bonusRate} 
                        totalRate={asset.apy}
                      />
                    </Box>
                  </Flex>
                </Box>
              </Box>
              <Box style={{ width: '10%' }}>
                <Text>{asset.maxLtv}%</Text>
              </Box>
              <Box style={{ width: '20%' }}>
                <Flex gap="2">
                  <Button 
                    variant="soft" 
                    size="1" 
                    onClick={() => onWithdrawClick?.(lendingPoolsData[index])}
                  >
                    Withdraw
                  </Button>
                  <Button 
                    size="1" 
                    className="action-button"
                    onClick={() => onSupplyClick(lendingPoolsData[index], asset.supplied)}
                  >
                    Supply
                  </Button>
                </Flex>
              </Box>
            </Flex>
          ))
        ) : (
          <Flex p="4" justify="center">
            <Text color="gray">No assets supplied</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}

// APYTooltip 组件保持不变
function APYTooltip({ baseRate, bonusRate, totalRate }: { baseRate: string; bonusRate: string; totalRate: string }) {
  return (
    <Box className="apy-tooltip" p="3">
      <Flex direction="column" gap="3">
        <Box>
          <Text size="1" color="gray" mb="1">Vault APR</Text>
          <Text size="3">{baseRate}%</Text>
        </Box>
        <Box>
          <Text size="1" color="gray" mb="1">Boosted APR</Text>
          <Text size="3">{bonusRate}%</Text>
        </Box>
        <Box style={{ borderTop: '1px solid var(--gray-a5)', paddingTop: '8px' }}>
          <Text size="1" color="gray" mb="1">Total</Text>
          <Text size="3" color="green">{totalRate}%</Text>
        </Box>
      </Flex>
    </Box>
  );
} 