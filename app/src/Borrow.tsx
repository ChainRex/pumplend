import { Box, Container, Flex, Text, Button, Tabs } from "@radix-ui/themes";
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useNavigate } from "react-router-dom";

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
        <Box className="overview-card">
          <Flex align="center" gap="4">
            <Box style={{ width: 60, height: 60 }}>
              <CircularProgressbar
                value={mockData.borrows.percentage}
                text={`${mockData.borrows.percentage}%`}
                styles={{
                  path: {
                    stroke: `rgba(255, 99, 71, ${mockData.borrows.percentage / 100})`,
                  },
                  text: {
                    fill: '#fff',
                    fontSize: '24px',
                  },
                }}
              />
            </Box>
            <Box>
              <Text size="2" color="gray">Your Borrows</Text>
              <Text size="6" weight="bold">${mockData.borrows.totalValue}</Text>
              <Text size="2" color="gray">APY: {mockData.borrows.apy || '--'}%</Text>
            </Box>
          </Flex>
        </Box>

        <Box className="overview-card">
          <Box>
            <Text size="2" color="gray">Your Supplies</Text>
            <Text size="6" weight="bold">${mockData.supplies.totalValue}</Text>
            <Text size="2" color="gray">APY: {mockData.supplies.apy}%</Text>
          </Box>
        </Box>

        <Box className="overview-card health-factor">
          <Flex justify="between" align="center">
            <Box>
              <Text size="2" color="gray">Health Factor</Text>
              <Text size="6" weight="bold">{mockData.healthFactor}</Text>
            </Box>
            <Flex gap="2">
              <Button variant="soft" size="1">RISK DETAILS</Button>
              <Button variant="soft" size="1">NOTIFI</Button>
            </Flex>
          </Flex>
        </Box>
      </Flex>

      {/* 主体内容区 */}
      <Flex gap="6">
        {/* 左侧区域 */}
        <Box className="main-content">
          {/* Your Borrows 区域 */}
          <Box className="section-card" mb="4">
            <Flex justify="between" align="center" mb="4">
              <Text size="4" weight="bold">Your Borrows</Text>
              <Text>Borrow Power Used: {mockData.borrows.powerUsed}%</Text>
            </Flex>
            <Box className="asset-table">
              {/* 表头 */}
              <Flex className="table-header" p="2">
                <Box style={{ width: '30%' }}>Asset</Box>
                <Box style={{ width: '25%' }}>Debt</Box>
                <Box style={{ width: '25%' }}>APY</Box>
                <Box style={{ width: '20%' }}>Actions</Box>
              </Flex>
              {/* 资产列表 */}
              {mockData.borrowedAssets.map((asset, index) => (
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

          {/* Assets to Borrow 区域 */}
          <Box className="section-card">
            <Flex justify="between" align="center" mb="4">
              <Text size="4" weight="bold">Assets to Borrow</Text>
            </Flex>
            <Box className="asset-table">
              {/* 表头 */}
              <Flex className="table-header" p="2">
                <Box style={{ width: '25%' }}>Asset</Box>
                <Box style={{ width: '35%' }}>Available</Box>
                <Box style={{ width: '25%' }}>APY</Box>
                <Box style={{ width: '15%' }}>Actions</Box>
              </Flex>
              {/* 资产列表 */}
              {mockData.assetsToBorrow.map((asset, index) => (
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
        </Box>

        {/* 右侧交互区 */}
        <Box className="interaction-panel">
          <Tabs.Root defaultValue="borrow" onValueChange={handleTabChange}>
            <Tabs.List>
              <Tabs.Trigger value="supply">Supply</Tabs.Trigger>
              <Tabs.Trigger value="borrow">Borrow</Tabs.Trigger>
            </Tabs.List>
            <Box className="panel-content" p="4">
              <Text size="5" weight="bold" mb="4">Borrow vSUI</Text>
              {/* 输入区域 */}
              <Box className="amount-input-container" mb="4">
                <Flex justify="between" mb="2">
                  <Text>Amount</Text>
                  <Text>Available: 0.74 vSUI</Text>
                </Flex>
                <Flex className="amount-input" align="center" gap="2">
                  <input type="text" placeholder="0.00" />
                  <Button variant="soft" size="1">MAX</Button>
                </Flex>
              </Box>
              {/* 交易概览 */}
              <Box className="transaction-overview">
                <Text size="3" weight="bold" mb="2">Transaction Overview</Text>
                <Flex justify="between" mb="2">
                  <Text>Borrow Fee</Text>
                  <Text>0.2%</Text>
                </Flex>
                <Flex justify="between" mb="2">
                  <Text>Debt</Text>
                  <Text>-</Text>
                </Flex>
                <Flex justify="between" mb="2">
                  <Text>Borrow APY</Text>
                  <Text>0.408%</Text>
                </Flex>
                <Flex justify="between" mb="2">
                  <Text>Health Factor</Text>
                  <Text>{mockData.healthFactor}</Text>
                </Flex>
                <Flex justify="between" mb="2">
                  <Text>Fee</Text>
                  <Text>-</Text>
                </Flex>
              </Box>
              <Button 
                className="action-button submit-button" 
                size="3" 
                disabled
              >
                Enter An Amount
              </Button>
            </Box>
          </Tabs.Root>
        </Box>
      </Flex>
    </Container>
  );
} 