import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { useLendingList } from "../../hooks/useLendingList";
import { useLendingData, LendingPoolData } from "../../hooks/useLendingData";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQueries } from "@tanstack/react-query";
import { useSuiClient } from "@mysten/dapp-kit";

// 添加 Tooltip 组件
function APYTooltip({ baseRate, bonusRate, totalRate }: { baseRate: string; bonusRate: string; totalRate: string }) {
  return (
    <Box className="apy-tooltip" p="3">
      <Flex direction="column" gap="3">
        <Box>
          <Text size="1" color="gray" mb="1">Vault APR: </Text>
          <Text size="3">{baseRate}%</Text>
        </Box>
        <Box>
          <Text size="1" color="gray" mb="1">Boosted APR: </Text>
          <Text size="3">{bonusRate}%</Text>
        </Box>
        <Box style={{ borderTop: '1px solid var(--gray-a5)', paddingTop: '8px' }}>
          <Text size="1" color="gray" mb="1">Total: </Text>
          <Text size="3" color="green">{totalRate}%</Text>
        </Box>
      </Flex>
    </Box>
  );
}

interface AssetsToSupplyTableProps {
  onSupplyClick: (asset: LendingPoolData) => void;
}

export function AssetsToSupplyTable({ onSupplyClick }: AssetsToSupplyTableProps) {
  const { data: lendings } = useLendingList();
  const lendingPoolsData = useLendingData(lendings);
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();

  // 修改 useQueries 的配置
  const balanceQueries = useQueries({
    queries: lendingPoolsData.map(pool => ({
      queryKey: ["tokenBalance", currentAccount?.address, pool.type],
      queryFn: async () => {
        if (!currentAccount?.address || !pool.type) {
          return { formatted: "0", raw: BigInt(0) };
        }

        const coins = await suiClient.getCoins({
          owner: currentAccount.address,
          coinType: pool.type,
        });

        const totalBalance = coins.data.reduce(
          (sum, coin) => sum + BigInt(coin.balance),
          BigInt(0)
        );

        return {
          formatted: (Number(totalBalance) / 1e9).toFixed(4),
          raw: totalBalance
        };
      },
      enabled: !!currentAccount?.address && !!pool.type,
      // 添加重试配置
      retry: 2,
      // 添加刷新配置
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }))
  });

  // 处理数据转换
  const assetsToSupply = lendingPoolsData.map((pool, index) => {
    const balance = balanceQueries[index]?.data;

    const supplyRateMatch = pool.supplyRate.match(/(\d+\.\d+)%\s*\((\d+\.\d+)%\s*\+\s*(\d+\.\d+)%\)/);
    const totalRate = supplyRateMatch ? parseFloat(supplyRateMatch[1]) : 0;
    const baseRate = supplyRateMatch ? parseFloat(supplyRateMatch[2]) : 0;
    const bonusRate = supplyRateMatch ? parseFloat(supplyRateMatch[3]) : 0;

    return {
      name: pool.name,
      symbol: pool.symbol,
      logo: pool.icon,
      balance: balance?.formatted || "0",
      apy: totalRate.toFixed(2),
      baseRate: baseRate.toFixed(2),
      bonusRate: bonusRate.toFixed(2),
      reserves: pool.reserves
    };
  });

  return (
    <Box className="section-card">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Assets to Supply</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '20%' }}>Asset</Box>
          <Box style={{ width: '30%' }}>Wallet Balance</Box>
          <Box style={{ width: '20%' }}>APY</Box>
          <Box style={{ width: '20%' }}>Available</Box>
          <Box style={{ width: '10%' }}>Actions</Box>
        </Flex>
        {assetsToSupply.map((asset, index) => (
          <Flex key={index} className="table-row" p="2" align="center">
            <Box style={{ width: '20%' }}>
              <Flex align="center" gap="2">
                <img src={asset.logo} alt={asset.name} className="asset-logo" />
                <Text>{asset.symbol}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '30%' }}>
              <Text>{asset.balance}</Text>
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
            <Box style={{ width: '20%' }}>
              <Text>
                {lendingPoolsData[index].reserves}
              </Text>
            </Box>
            <Box style={{ width: '10%' }}>
              <Button 
                size="1" 
                className="action-button"
                onClick={() => onSupplyClick(lendingPoolsData[index])}
              >
                Supply
              </Button>
            </Box>
          </Flex>
        ))}
        {assetsToSupply.length === 0 && (
          <Flex p="4" justify="center">
            <Text color="gray">No assets available to supply</Text>
          </Flex>
        )}
      </Box>
    </Box>
  );
} 