import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { useLendingList } from "../../hooks/useLendingList";
import { LendingPoolData, useLendingData } from "../../hooks/useLendingData";
import { ClipLoader } from "react-spinners";
import { formatUnits } from '../../utils/format';

interface BorrowedAssetsTableProps {
  userPosition: any;
  isLoading: boolean;
  onBorrowClick: (asset: LendingPoolData) => void;
  onRepayClick: (asset: LendingPoolData) => void;
  maxBorrowValue?: string;  // 添加最大可借额度
}

// 添加 APYTooltip 组件
function APYTooltip({ baseRate, discountRate, totalRate }: { baseRate: string; discountRate: string; totalRate: string }) {
  return (
    <Box className="apy-tooltip" p="3">
      <Flex direction="column" gap="3">
        <Box>
          <Text size="1" color="gray" mb="1">Base APR: </Text>
          <Text size="3">{baseRate}%</Text>
        </Box>
        <Box>
          <Text size="1" color="gray" mb="1">Discount APR: </Text>
          <Text size="3">{discountRate}%</Text>
        </Box>
        <Box style={{ borderTop: '1px solid var(--gray-a5)', paddingTop: '8px' }}>
          <Text size="1" color="gray" mb="1">Total: </Text>
          <Text size="3" color="red">{totalRate}%</Text>
        </Box>
      </Flex>
    </Box>
  );
}

export function BorrowedAssetsTable({ 
  userPosition, 
  isLoading,
  onBorrowClick,
  onRepayClick}: BorrowedAssetsTableProps) {
  const { data: lendings } = useLendingList();
  const lendingPoolsData = useLendingData(lendings);

  // 处理数据转换
  const borrowedAssets = userPosition?.assets.map((asset: any, index: number) => {
    const pool = lendingPoolsData.find(p => p.type === `0x${asset.name}`);
    if (!pool) return null;

    if (pool.symbol !== 'TESTSUI' && pool.price < 0.0125) {
      return null;
    }

    const borrowAmount = formatUnits(userPosition.borrows[index], 9);
    const value = (parseFloat(borrowAmount) * pool.price).toFixed(2);

    const borrowRateMatch = pool.borrowRate.match(/(\d+\.\d+)%\s*\((\d+\.\d+)%\s*-\s*(\d+\.\d+)%\)/);
    const totalRate = borrowRateMatch ? parseFloat(borrowRateMatch[1]) : 0;
    const baseRate = borrowRateMatch ? parseFloat(borrowRateMatch[2]) : 0;
    const discountRate = borrowRateMatch ? parseFloat(borrowRateMatch[3]) : 0;

    return {
      name: pool.name,
      symbol: pool.symbol,
      logo: pool.icon,
      borrowed: borrowAmount,
      value: value,
      apy: totalRate.toFixed(2),
      baseRate: baseRate.toFixed(2),
      discountRate: discountRate.toFixed(2),
      pool: pool
    };
  }).filter(Boolean);

  return (
    <Box className="section-card" mb="4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Your Borrows</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '20%' }}>Asset</Box>
          <Box style={{ width: '30%' }}>Debt</Box>
          <Box style={{ width: '20%' }}>APY</Box>
          <Box style={{ width: '30%' }}>Actions</Box>
        </Flex>
        {!isLoading ? (
          borrowedAssets?.length > 0 ? (
            borrowedAssets.map((asset: any, index: number) => (
              <Flex key={index} className="table-row" p="2" align="center">
                <Box style={{ width: '20%' }}>
                  <Flex align="center" gap="2">
                    <img src={asset.logo} alt={asset.name} className="asset-logo" />
                    <Text>{asset.symbol}</Text>
                  </Flex>
                </Box>
                <Box style={{ width: '30%' }}>
                  <Flex direction="column">
                    <Text>{asset.borrowed}</Text>
                  </Flex>
                </Box>
                <Box style={{ width: '20%' }}>
                  <Box position="relative">
                    <Flex direction="column" gap="1" className="apy-container">
                      <Text color="red">{asset.apy}%</Text>
                      <Text size="1" style={{ textDecoration: 'line-through' }} color="gray">
                        {asset.baseRate}%
                      </Text>
                      <Box className="apy-tooltip-wrapper">
                        <APYTooltip 
                          baseRate={asset.baseRate} 
                          discountRate={asset.discountRate} 
                          totalRate={asset.apy}
                        />
                      </Box>
                    </Flex>
                  </Box>
                </Box>
                <Box style={{ width: '30%' }}>
                  <Flex gap="2">
                    <Button 
                      size="1" 
                      variant="soft"
                      onClick={() => onRepayClick(asset.pool)}
                    >
                      Repay
                    </Button>
                    <Button 
                      size="1" 
                      className="action-button"
                      onClick={() => onBorrowClick(asset.pool)}
                    >
                      Borrow
                    </Button>
                  </Flex>
                </Box>
              </Flex>
            ))
          ) : (
            <Flex p="4" justify="center">
              <Text color="gray">No assets borrowed</Text>
            </Flex>
          )
        ) : (
          <Flex justify="center" p="4">
            <ClipLoader size={24} />
          </Flex>
        )}
      </Box>
    </Box>
  );
}
