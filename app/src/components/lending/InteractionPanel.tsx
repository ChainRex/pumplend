import { Box, Flex, Text, Button, Tabs } from "@radix-ui/themes";

export function InteractionPanel({ handleTabChange, defaultTab = "supply" }: { handleTabChange: (value: string) => void, defaultTab?: string }) {
  return (
    <Box className="interaction-panel" style={{ flex: 1 }}>
      <Tabs.Root defaultValue={defaultTab} onValueChange={handleTabChange}>
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
  );
} 