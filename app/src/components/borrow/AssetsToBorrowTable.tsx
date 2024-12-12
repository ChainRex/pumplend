import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { useLendingList } from "../../hooks/useLendingList";
import { LendingPoolData, useLendingData } from "../../hooks/useLendingData";

interface AssetsToBorrowTableProps {
  onBorrowClick: (asset: LendingPoolData) => void;
  maxBorrowValue?: string;
}

// 添加 APY Tooltip 组件
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

export function AssetsToBorrowTable({ 
  onBorrowClick}: AssetsToBorrowTableProps) {
  const { data: lendings } = useLendingList();
  const lendingPoolsData = useLendingData(lendings);

  // 处理数据转换
  const assetsToBorrow = lendingPoolsData
    .filter(pool => pool.symbol === 'TESTSUI' || pool.price >= 0.0125)
    .map((pool) => {
      const borrowRateMatch = pool.borrowRate.match(/(\d+\.\d+)%\s*\((\d+\.\d+)%\s*-\s*(\d+\.\d+)%\)/);
      const totalRate = borrowRateMatch ? parseFloat(borrowRateMatch[1]) : 0;
      const baseRate = borrowRateMatch ? parseFloat(borrowRateMatch[2]) : 0;
      const discountRate = borrowRateMatch ? parseFloat(borrowRateMatch[3]) : 0;

      const availableAmount = pool.reserves;
      const availableValue = (parseFloat(availableAmount) * pool.price).toFixed(2);

      return {
        name: pool.name,
        symbol: pool.symbol,
        logo: pool.icon,
        available: pool.reserves,
        value: availableValue,
        apy: totalRate.toFixed(2),
        baseRate: baseRate.toFixed(2),
        discountRate: discountRate.toFixed(2),
        pool: pool
      };
    });

  return (
    <Box className="section-card">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Assets to Borrow</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '20%' }}>Asset</Box>
          <Box style={{ width: '30%' }}>Available</Box>
          <Box style={{ width: '30%' }}>APY</Box>
          <Box style={{ width: '20%' }}>Actions</Box>
        </Flex>
        {assetsToBorrow.map((asset, index) => (
          <Flex key={index} className="table-row" p="2" align="center">
            <Box style={{ width: '20%' }}>
              <Flex align="center" gap="2">
                <img src={asset.logo} alt={asset.name} className="asset-logo" />
                <Text>{asset.symbol}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '30%' }}>
              <Flex direction="column">
                <Text>{asset.available}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '30%' }}>
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
            <Box style={{ width: '20%' }}>
              <Button 
                size="1" 
                className="action-button"
                onClick={() => onBorrowClick(asset.pool)}
              >
                Borrow
              </Button>
            </Box>
          </Flex>
        ))}
        {assetsToBorrow.length === 0 && (
          <Flex p="4" justify="center">
            <Text color="gray">No assets available to borrow</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
}