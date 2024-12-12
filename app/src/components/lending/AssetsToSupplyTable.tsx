import { Box, Flex, Text, Button } from "@radix-ui/themes";

interface Asset {
  name: string;
  logo: string;
  balance: number;
  value: number;
  apy: number;
  apyChange: number;
  tvl: number;
}

export function AssetsToSupplyTable({ assets }: { assets: Asset[] }) {
  return (
    <Box className="section-card">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Assets to Supply</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '25%' }}>Asset</Box>
          <Box style={{ width: '25%' }}>Wallet Balance</Box>
          <Box style={{ width: '20%' }}>APY</Box>
          <Box style={{ width: '20%' }}>Total Value Locked</Box>
          <Box style={{ width: '10%' }}>Actions</Box>
        </Flex>
        {assets.map((asset, index) => (
          <Flex key={index} className="table-row" p="2" align="center">
            <Box style={{ width: '25%' }}>
              <Flex align="center" gap="2">
                <img src={asset.logo} alt={asset.name} className="asset-logo" />
                <Text>{asset.name}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '25%' }}>
              <Flex direction="column">
                <Text>{asset.balance} {asset.name}</Text>
                <Text size="1" color="gray">${asset.value}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '20%' }}>
              <Flex align="center" gap="1">
                <Text>{asset.apy}%</Text>
                <Text size="1" color={asset.apyChange >= 0 ? "green" : "red"}>
                  ({asset.apyChange >= 0 ? '+' : ''}{asset.apyChange}%)
                </Text>
              </Flex>
            </Box>
            <Box style={{ width: '20%' }}>
              ${asset.tvl.toLocaleString()}
            </Box>
            <Box style={{ width: '10%' }}>
              <Button size="1" className="action-button">Supply</Button>
            </Box>
          </Flex>
        ))}
      </Box>
    </Box>
  );
} 