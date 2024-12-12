import { Box, Container, Flex, Text, Button, Tabs } from "@radix-ui/themes";
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useNavigate } from "react-router-dom";
import { OverviewCard } from "./components/lending/OverviewCard";
import { InteractionPanel } from "./components/lending/InteractionPanel";

// 假数据
const mockData = {
  borrows: {
    totalValue: 0.11,
    apy: null,
    percentage: 3.47,
    powerUsed: 2.61,
  },
  supplies: {
    totalValue: 4.29,
    apy: 5.10,
  },
  healthFactor: 29.15,
  borrowedAssets: [
    {
      name: "wUSDC",
      logo: "https://example.com/wusdc.png",
      debt: 0.11,
      value: 0.11,
      apy: 8.562,
    }
  ],
  assetsToBorrow: [
    {
      name: "vSUI",
      logo: "https://example.com/vsui.png",
      available: 38209098.95,
      value: 159520000,
      apy: 0.408,
      apyChange: 0.02,
    },
    {
      name: "haSUI",
      logo: "https://example.com/hasui.png",
      available: 1000000,
      value: 4000000,
      apy: 0.5,
      apyChange: -0.01,
    },
    {
      name: "SUI",
      logo: "https://sui.io/logo.png",
      available: 500000,
      value: 2000000,
      apy: 0.6,
      apyChange: 0.03,
    }
  ],
};

// 借入资产表组件
function BorrowedAssetsTable({ assets }: { assets: { name: string; logo: string; debt: number; value: number; apy: number; }[] }) {
  return (
    <Box className="section-card" mb="4">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Your Borrows</Text>
        <Text>Borrow Power Used: {mockData.borrows.powerUsed}%</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '30%' }}>Asset</Box>
          <Box style={{ width: '25%' }}>Debt</Box>
          <Box style={{ width: '25%' }}>APY</Box>
          <Box style={{ width: '20%' }}>Actions</Box>
        </Flex>
        {assets.map((asset, index) => (
          <Flex key={index} className="table-row" p="2" align="center">
            <Box style={{ width: '30%' }}>
              <Flex align="center" gap="2">
                <img src={asset.logo} alt={asset.name} className="asset-logo" />
                <Text>{asset.name}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '25%' }}>
              <Flex direction="column">
                <Text>{asset.debt} {asset.name}</Text>
                <Text size="1" color="gray">${asset.value}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '25%' }}>
              {asset.apy}%
            </Box>
            <Box style={{ width: '20%' }}>
              <Flex gap="2">
                <Button size="1" className="action-button secondary">Repay</Button>
                <Button size="1" className="action-button">Borrow</Button>
              </Flex>
            </Box>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}

// 可借资产表组件
function AssetsToBorrowTable({ assets }: { assets: { name: string; logo: string; available: number; value: number; apy: number; apyChange: number; }[] }) {
  return (
    <Box className="section-card">
      <Flex justify="between" align="center" mb="4">
        <Text size="4" weight="bold">Assets to Borrow</Text>
      </Flex>
      <Box className="asset-table">
        <Flex className="table-header" p="2">
          <Box style={{ width: '25%' }}>Asset</Box>
          <Box style={{ width: '35%' }}>Available</Box>
          <Box style={{ width: '25%' }}>APY</Box>
          <Box style={{ width: '15%' }}>Actions</Box>
        </Flex>
        {assets.map((asset, index) => (
          <Flex key={index} className="table-row" p="2" align="center">
            <Box style={{ width: '25%' }}>
              <Flex align="center" gap="2">
                <img src={asset.logo} alt={asset.name} className="asset-logo" />
                <Text>{asset.name}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '35%' }}>
              <Flex direction="column">
                <Text>{asset.available.toLocaleString()} {asset.name}</Text>
                <Text size="1" color="gray">${asset.value.toLocaleString()}</Text>
              </Flex>
            </Box>
            <Box style={{ width: '25%' }}>
              <Flex align="center" gap="1">
                <Text>{asset.apy}%</Text>
                <Text size="1" color={asset.apyChange >= 0 ? "green" : "red"}>
                  ({asset.apyChange >= 0 ? '+' : ''}{asset.apyChange}%)
                </Text>
              </Flex>
            </Box>
            <Box style={{ width: '15%' }}>
              <Button size="1" className="action-button">Borrow</Button>
            </Box>
          </Flex>
        ))}
      </Box>
    </Box>
  );
}

export function Borrow() {
  const navigate = useNavigate();

  const handleTabChange = (value: string) => {
    if (value === 'supply') {
      navigate('/lending');
    }
  };

  return (
    <Container className="lending-container">
      {/* 顶部概览区 */}
      <Flex gap="6" mb="6">
        <OverviewCard 
          title="Your Borrows" 
          value={mockData.borrows.totalValue} 
          apy={mockData.borrows.apy ?? 0}
          percentage={mockData.borrows.percentage}
        />
        <OverviewCard 
          title="Your Supplies" 
          value={mockData.supplies.totalValue} 
          apy={mockData.supplies.apy}
        />
        <OverviewCard 
          title="Health Factor" 
          value={mockData.healthFactor} 
          isHealthFactor
        />
      </Flex>

      {/* 主体内容区 */}
      <Flex gap="6">
        {/* 左侧区域 */}
        <Box className="main-content">
          <BorrowedAssetsTable assets={mockData.borrowedAssets} />
          <AssetsToBorrowTable assets={mockData.assetsToBorrow} />
        </Box>

        {/* 右侧交互区 */}
        <InteractionPanel 
          handleTabChange={handleTabChange} 
          defaultTab="borrow"
          healthFactor={mockData.healthFactor}
        />
      </Flex>
    </Container>
  );
} 