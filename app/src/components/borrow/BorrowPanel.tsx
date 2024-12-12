import { Box, Flex, Text, Button } from "@radix-ui/themes";

interface BorrowPanelProps {
  healthFactor: number;
}

export function BorrowPanel({ healthFactor }: BorrowPanelProps) {
  return (
    <Box className="panel-content" p="4">
      <Text size="5" weight="bold" mb="4">Borrow vSUI</Text>
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
          <Text>{healthFactor}</Text>
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
  );
} 