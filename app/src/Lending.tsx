import { Box, Container, Flex, Text, Button, Tabs } from "@radix-ui/themes";
import { CircularProgressbar } from 'react-circular-progressbar';
import 'react-circular-progressbar/dist/styles.css';
import { useNavigate } from "react-router-dom";

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
    <Container className="lending-container">
      {/* 顶部概览区 */}
      <Flex gap="6" mb="6">
        <Box className="overview-card">
          <Flex align="center" gap="4">
            <Box style={{ width: 60, height: 60 }}>
              <CircularProgressbar
                value={mockData.supplies.percentage}
                text={`${mockData.supplies.percentage}%`}
                styles={{
                  path: {
                    stroke: `rgba(62, 152, 199, ${mockData.supplies.percentage / 100})`,
                  },
                  text: {
                    fill: '#fff',
                    fontSize: '24px',
                  },
                }}
              />
            </Box>
            <Box>
              <Text size="2" color="gray">Your Supplies</Text>
              <Text size="6" weight="bold">${mockData.supplies.totalValue}</Text>
              <Text size="2" color="gray">APY: {mockData.supplies.apy}%</Text>
            </Box>
          </Flex>
        </Box>

        <Box className="overview-card">
          <Box>
            <Text size="2" color="gray">Your Borrows</Text>
            <Text size="6" weight="bold">${mockData.borrows.totalValue}</Text>
            <Text size="2" color="gray">APY: {mockData.borrows.apy || '--'}%</Text>
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
        {/* 左侧区域 - 增加宽度比例 */}
        <Box className="main-content" style={{ flex: 3 }}>
          {/* Your Supplies 区域 */}
          <Box className="section-card" mb="4">
            <Flex justify="between" align="center" mb="4">
              <Text size="4" weight="bold">Your Supplies</Text>
              <Text>Collateral: $3.22</Text>
            </Flex>
            <Box className="asset-table">
              {/* 表头 */}
              <Flex className="table-header" p="2">
                <Box style={{ width: '30%' }}>Asset</Box>
                <Box style={{ width: '20%' }}>Balance</Box>
                <Box style={{ width: '20%' }}>APY</Box>
                <Box style={{ width: '15%' }}>Max LTV</Box>
                <Box style={{ width: '15%' }}>Actions</Box>
              </Flex>
              {/* 资产列表 */}
              {mockData.suppliedAssets.map((asset, index) => (
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

          {/* Assets to Supply 区域 */}
          <Box className="section-card">
            <Flex justify="between" align="center" mb="4">
              <Text size="4" weight="bold">Assets to Supply</Text>
            </Flex>
            <Box className="asset-table">
              {/* 表头 */}
              <Flex className="table-header" p="2">
                <Box style={{ width: '25%' }}>Asset</Box>
                <Box style={{ width: '25%' }}>Wallet Balance</Box>
                <Box style={{ width: '20%' }}>APY</Box>
                <Box style={{ width: '20%' }}>Total Value Locked</Box>
                <Box style={{ width: '10%' }}>Actions</Box>
              </Flex>
              {/* 资产列表 */}
              {mockData.assetsToSupply.map((asset, index) => (
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
        </Box>

        {/* 右侧交互区 - 减小宽度比例 */}
        <Box className="interaction-panel" style={{ flex: 1 }}>
          <Tabs.Root defaultValue="supply" onValueChange={handleTabChange}>
            <Tabs.List>
              <Tabs.Trigger value="supply">Supply</Tabs.Trigger>
              <Tabs.Trigger value="borrow">Borrow</Tabs.Trigger>
            </Tabs.List>
            <Box className="panel-content" p="4">
              <Text size="5" weight="bold" mb="4">Supply SUI</Text>
              <Flex justify="between" mb="4">
                <Text>Supply Balance: 1</Text>
                <Button variant="soft" size="1" className="action-button secondary">Withdraw</Button>
              </Flex>
              {/* 输入区域 */}
              <Box className="amount-input-container" mb="4">
                <Flex justify="between" mb="2">
                  <Text>Amount</Text>
                  <Text>Balance: 1.24 SUI</Text>
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
                  <Text>Supply APY</Text>
                  <Text>5.128% (+3.73%)</Text>
                </Flex>
                <Flex justify="between" mb="2">
                  <Text>Health Factor</Text>
                  <Text>29.07</Text>
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