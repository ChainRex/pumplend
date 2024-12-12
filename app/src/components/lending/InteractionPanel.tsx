import { Box, Tabs } from "@radix-ui/themes";
import { SupplyPanel } from "./SupplyPanel";
import { BorrowPanel } from "../borrow/BorrowPanel";
import { LendingPoolData } from "../../hooks/useLendingData";
import { useState, useEffect } from "react";

interface InteractionPanelProps {
  handleTabChange: (value: string) => void;
  defaultTab?: string;
  healthFactor?: string;
  selectedAsset?: LendingPoolData;
  userSupplied?: string;
  isLoadingPosition: boolean;
  onTransactionSuccess: () => Promise<void>;
  defaultMode?: 'supply' | 'withdraw' | 'borrow' | 'repay';
  maxBorrowValue?: string;
}

export function InteractionPanel({ 
  handleTabChange, 
  defaultTab = "supply",
  healthFactor = "0",
  selectedAsset,
  userSupplied,
  isLoadingPosition,
  onTransactionSuccess,
  defaultMode = 'supply',
  maxBorrowValue = "0"
}: InteractionPanelProps) {
  const [currentTab, setCurrentTab] = useState(defaultTab);

  const handleValueChange = (value: string) => {
    setCurrentTab(value);
    handleTabChange(value);
  };

  useEffect(() => {
    if (defaultMode === 'repay') {
      setCurrentTab('borrow');
    }
  }, [defaultMode]);

  return (
    <Box className="interaction-panel" style={{ flex: 1 }}>
      <Tabs.Root value={currentTab} onValueChange={handleValueChange}>
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
            defaultMode={defaultMode === 'supply' || defaultMode === 'withdraw' ? defaultMode : 'supply'}
          />
        </Tabs.Content>
        
        <Tabs.Content value="borrow">
          <BorrowPanel 
            selectedAsset={selectedAsset}
            userBorrowed={userSupplied}
            isLoadingPosition={isLoadingPosition}
            onTransactionSuccess={onTransactionSuccess}
            healthFactor={healthFactor}
            defaultMode={defaultMode === 'borrow' || defaultMode === 'repay' ? defaultMode : 'borrow'}
            maxBorrowValue={maxBorrowValue}
          />
        </Tabs.Content>
      </Tabs.Root>
    </Box>
  );
} 