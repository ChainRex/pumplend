import { Box, Tabs } from "@radix-ui/themes";
import { SupplyPanel } from "./SupplyPanel";
import { BorrowPanel } from "../borrow/BorrowPanel";

interface InteractionPanelProps {
  handleTabChange: (value: string) => void;
  defaultTab?: string;
  healthFactor?: number;
}

export function InteractionPanel({ 
  handleTabChange, 
  defaultTab = "supply",
  healthFactor = 0
}: InteractionPanelProps) {
  return (
    <Box className="interaction-panel" style={{ flex: 1 }}>
      <Tabs.Root defaultValue={defaultTab} onValueChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Trigger value="supply">Supply</Tabs.Trigger>
          <Tabs.Trigger value="borrow">Borrow</Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Content value="supply">
          <SupplyPanel />
        </Tabs.Content>
        
        <Tabs.Content value="borrow">
          <BorrowPanel healthFactor={healthFactor} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
} 