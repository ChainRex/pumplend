import { Box, Tabs } from "@radix-ui/themes";
import { SupplyPanel } from "./SupplyPanel";
import { BorrowPanel } from "../borrow/BorrowPanel";
import { LendingPoolData } from "../../hooks/useLendingData";

interface InteractionPanelProps {
  handleTabChange: (value: string) => void;
  defaultTab?: string;
  healthFactor?: string;
  selectedAsset?: LendingPoolData;
  userSupplied?: string;
  isLoadingPosition: boolean;
  onTransactionSuccess: () => Promise<void>;
  defaultMode?: 'supply' | 'withdraw';
}

export function InteractionPanel({ 
  handleTabChange, 
  defaultTab = "supply",
  healthFactor = "0",
  selectedAsset,
  userSupplied,
  isLoadingPosition,
  onTransactionSuccess,
  defaultMode = 'supply'
}: InteractionPanelProps) {
  return (
    
    <Box className="interaction-panel" style={{ flex: 1 }}>
      <Tabs.Root defaultValue={defaultTab} onValueChange={handleTabChange}>
        <Tabs.List>
          <Tabs.Trigger value="supply">Supply</Tabs.Trigger>
          <Tabs.Trigger value="borrow">Borrow</Tabs.Trigger>
        </Tabs.List>
        
        <Tabs.Content value="supply">
          <SupplyPanel 
            selectedAsset={selectedAsset}
            userSupplied={userSupplied}
            isLoadingPosition={isLoadingPosition}
            onTransactionSuccess={onTransactionSuccess}
            healthFactor={healthFactor}
            defaultMode={defaultMode}
          />
        </Tabs.Content>
        
        <Tabs.Content value="borrow">
          <BorrowPanel healthFactor={healthFactor} />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
} 