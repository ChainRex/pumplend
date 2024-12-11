import { Box, Flex, Text, Button } from "@radix-ui/themes";

interface Asset {
  name: string;
  logo: string;
  supplied: number;
  value: number;
  apy: number;
  maxLtv: number;
}

export function SuppliedAssetsTable({ assets }: { assets: Asset[] }) {
  return (
    <Box className="section-card" mb="4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Your Supplies</Text>
        <Text>Collateral: $3.22</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '30%' }}>Asset</Box>
          <Box style={{ width: '20%' }}>Balance</Box>
          <Box style={{ width: '20%' }}>APY</Box>
          <Box style={{ width: '15%' }}>Max LTV</Box>
          <Box style={{ width: '15%' }}>Actions</Box>
        </Flex>
        {assets.map((asset, index) => (
          <Flex key={index} className="table-row" p="2" align="center">
            <Box style={{ width: '30%' }}>
              <Flex align="center" gap="2">
                <img src={asset.logo} alt={asset.name} className="asset-logo" />
                <Text>{asset.name}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '20%' }}>
              {asset.supplied} ({asset.value}$)
            </Box>
            <Box style={{ width: '20%' }}>
              {asset.apy}%
            </Box>
            <Box style={{ width: '15%' }}>
              {asset.maxLtv}%
            </Box>
            <Box style={{ width: '15%' }}>
              <Flex gap="2">
                <Button size="1" className="action-button secondary">Withdraw</Button>
                <Button size="1" className="action-button">Supply</Button>
              </Flex>
            </Box>
          </Flex>
        ))}
      </Box>
    </Box>
  );
} 