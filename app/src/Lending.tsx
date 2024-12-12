import { Box, Container, Flex } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { OverviewCard } from "./components/lending/OverviewCard";
import { SuppliedAssetsTable } from "./components/lending/SuppliedAssetsTable";
import { AssetsToSupplyTable } from "./components/lending/AssetsToSupplyTable";
import { InteractionPanel } from "./components/lending/InteractionPanel";
import { HealthFactorCard } from "./components/lending/HealthFactorCard";

// 假数据
const mockData = {
  supplies: {
    totalValue: 4.29,
    apy: 5.11,
    percentage: 45.23,
  },
  borrows: {
    totalValue: 0.11,
    apy: null,
  },
  healthFactor: 29.07,
  suppliedAssets: [
    {
      name: "SUI",
      logo: "https://sui.io/logo.png",
      supplied: 1,
      value: 4.18,
      apy: 5.128,
      apyChange: 8.73,
      maxLtv: 75.00,
    },
    {
      name: "wUSDC",
      logo: "https://example.com/wusdc.png",
      supplied: 0.11,
      value: 0.11,
      apy: 4.461,
      maxLtv: 80.00,
    },
  ],
  assetsToSupply: [
    {
      name: "SUI",
      logo: "https://sui.io/logo.png",
      balance: 1.24,
      value: 5.2,
      apy: 5.128,
      apyChange: 8.73,
      tvl: 219219945.4,
    },
    {
      name: "USDC",
      logo: "https://example.com/usdc.png",
      balance: 100,
      value: 100,
      apy: 3.5,
      apyChange: -0.5,
      tvl: 150000000,
    },
    {
      name: "USDT",
      logo: "https://example.com/usdt.png",
      balance: 50,
      value: 50,
      apy: 3.2,
      apyChange: 0.2,
      tvl: 120000000,
    },
  ],
};

export function Lending() {
  const navigate = useNavigate();

  const handleTabChange = (value: string) => {
    if (value === 'borrow') {
      navigate('/borrow');
    }
  };

  return (
    <Container className="lending-container" style={{ padding: '0 8px', maxWidth: '100%', margin: '0 auto' }}>
      <Flex gap="4" mb="4" wrap="wrap" style={{ width: '100%' }}>
        <Box style={{ flex: 1, minWidth: '300px' }}>
          <OverviewCard
            title="Your Supplies"
            value={mockData.supplies.totalValue}
            apy={mockData.supplies.apy}
            percentage={mockData.supplies.percentage}
          />
        </Box>
        <Box style={{ flex: 1, minWidth: '300px' }}>
          <OverviewCard
            title="Your Borrows"
            value={mockData.borrows.totalValue}
            apy={mockData.borrows.apy}
          />
        </Box>
        <Box style={{ flex: 1, minWidth: '300px' }}>
          <HealthFactorCard value={mockData.healthFactor} />
        </Box>
      </Flex>

      <Flex gap="4" wrap="wrap">
        <Box className="main-content" style={{ flex: 4 }}>
          <SuppliedAssetsTable assets={mockData.suppliedAssets} />
          <AssetsToSupplyTable assets={mockData.assetsToSupply} />
        </Box>
        <Box style={{ flex: 2 }}>
          <InteractionPanel handleTabChange={handleTabChange} />
        </Box>
      </Flex>
    </Container>
  );
}