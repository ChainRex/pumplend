import { Box, Container, Flex } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PUMPLEND_CORE_PACKAGE_ID, LENDING_STORAGE_ID } from "./config";
import { formatUnits } from './utils/format';
import { OverviewCard } from "./components/lending/OverviewCard";
import { BorrowedAssetsTable } from "./components/borrow/BorrowedAssetsTable";
import { AssetsToBorrowTable } from "./components/borrow/AssetsToBorrowTable";
import { InteractionPanel } from "./components/lending/InteractionPanel";
import { useState, useEffect } from 'react';
import { LendingPoolData } from "./hooks/useLendingData";
import { useLendingList } from "./hooks/useLendingList";
import { useLendingData } from "./hooks/useLendingData";

// 复制所有接口定义
interface UserPositionEvent {
  user: string;
  assets: {
    name: string;
  }[];
  supplies: string[];
  borrows: string[];
  borrow_index_snapshots: string[];
  supply_index_snapshots: string[];
  borrow_value: string;
  supply_value: string;
}

interface HealthFactorEvent {
  user: string;
  health_factor: string;
}

interface RemainingBorrowValueEvent {
  user: string;
  remaining_borrow_value: string;
}

interface MaxBorrowValueEvent {
  user: string;
  max_borrow_value: string;
}

interface UserAssetData {
  asset: LendingPoolData;
  supplied: string;
}

export function Borrow() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [userPosition, setUserPosition] = useState<UserPositionEvent | null>(null);
  const [healthFactor, setHealthFactor] = useState<string | null>(null);
  const [, setMaxBorrowValue] = useState<string | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [, setUserAssets] = useState<Map<string, UserAssetData>>(new Map());
  const [selectedAsset, setSelectedAsset] = useState<LendingPoolData | undefined>();
  const [selectedUserSupplied, setSelectedUserSupplied] = useState<string>("0");
  const { data: lendings } = useLendingList();
  const lendingPoolsData = useLendingData(lendings);
  const [interactionMode, setInteractionMode] = useState<'borrow' | 'repay'>('borrow');
  const [remainingBorrowValue, setRemainingBorrowValue] = useState<string | null>(null);

  // 复制所有函数
  const handleTabChange = (value: string) => {
    if (value === 'supply') {
      navigate('/lending');
    }
  };

  // 复制 queryUserData, refreshData, handleSupplyClick, handleWithdrawClick 等所有函数
  // ... 

  const queryUserData = async (address: string) => {
    try {
      setIsLoadingPosition(true);
      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::get_user_position`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(address)
        ],
      });

      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_health_factor`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(address)
        ],
      });

      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_max_borrow_value`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(address)
        ],
      });

      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_remaining_borrow_value`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(address)
        ],
      });

      tx.setSender(address);

      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
      });

      console.log("Full dryRunResult:", dryRunResult);

      const positionEvent = dryRunResult.events?.find(
        event => event.type.includes('::GetUserPositionEvent')
      );
      console.log("Position event:", positionEvent);
      
      if (positionEvent?.parsedJson) {
        const position = positionEvent.parsedJson as UserPositionEvent;
        setUserPosition(position);
        
        const newUserAssets = new Map<string, UserAssetData>();
        position.assets.forEach((asset, index) => {
          const assetType = `0x${asset.name}`;
          const pool = lendingPoolsData.find(p => p.type === assetType);
          if (pool) {
            newUserAssets.set(assetType, {
              asset: pool,
              supplied: formatUnits(position.supplies[index], 9)
            });
          }
        });
        setUserAssets(newUserAssets);
      }

      const healthFactorEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateHealthFactorEvent')
      );
      if (healthFactorEvent?.parsedJson) {
        const eventData = healthFactorEvent.parsedJson as HealthFactorEvent;
        const healthFactorNum = Number(eventData.health_factor) / 100;
        const healthFactorValue = healthFactorNum > 1000 ? "∞" : healthFactorNum.toFixed(2);
        setHealthFactor(healthFactorValue);
      }

      const remainingBorrowEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateRemainingBorrowValueEvent')
      );
      if (remainingBorrowEvent?.parsedJson) {
        const eventData = remainingBorrowEvent.parsedJson as RemainingBorrowValueEvent;
        const remainingBorrowValueInTestSui = formatUnits(eventData.remaining_borrow_value, 18);
        setRemainingBorrowValue(remainingBorrowValueInTestSui);
      }

      const maxBorrowValueEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateMaxBorrowValueEvent')
      );
      if (maxBorrowValueEvent?.parsedJson) {
        const eventData = maxBorrowValueEvent.parsedJson as MaxBorrowValueEvent;
        const maxBorrowValueInTestSui = formatUnits(eventData.max_borrow_value, 18);
        setMaxBorrowValue(maxBorrowValueInTestSui);
      }
    } catch (error) {
      console.error('查询用户数据失败:', error);
    } finally {
      setIsLoadingPosition(false);
    }
  };

  const refreshData = async () => {
    if (!currentAccount) return;
    
    const tx = new Transaction();
    
    tx.moveCall({
      target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::get_user_position`,
      arguments: [
        tx.object(LENDING_STORAGE_ID),
        tx.pure.address(currentAccount.address)
      ],
    });

    tx.moveCall({
      target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_health_factor`,
      arguments: [
        tx.object(LENDING_STORAGE_ID),
        tx.pure.address(currentAccount.address)
      ],
    });

    tx.moveCall({
      target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_max_borrow_value`,
      arguments: [
        tx.object(LENDING_STORAGE_ID),
        tx.pure.address(currentAccount.address)
      ],
    });

    tx.setSender(currentAccount.address);

    try {
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
      });

      const positionEvent = dryRunResult.events?.find(
        event => event.type.includes('::GetUserPositionEvent')
      );
      
      if (positionEvent?.parsedJson) {
        const position = positionEvent.parsedJson as UserPositionEvent;
        setUserPosition(position);
        updateSelectedSupplied(position);
      }

      const healthFactorEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateHealthFactorEvent')
      );
      if (healthFactorEvent?.parsedJson) {
        const eventData = healthFactorEvent.parsedJson as HealthFactorEvent;
        const healthFactorNum = Number(eventData.health_factor) / 100;
        const healthFactorValue = healthFactorNum > 1000 ? "∞" : healthFactorNum.toFixed(2);
        setHealthFactor(healthFactorValue);
      }

      const maxBorrowValueEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateMaxBorrowValueEvent')
      );
      if (maxBorrowValueEvent?.parsedJson) {
        const eventData = maxBorrowValueEvent.parsedJson as MaxBorrowValueEvent;
        const maxBorrowValueInTestSui = formatUnits(eventData.max_borrow_value, 18);
        setMaxBorrowValue(maxBorrowValueInTestSui);
      }

      const remainingBorrowEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateRemainingBorrowValueEvent')
      );
      if (remainingBorrowEvent?.parsedJson) {
        const eventData = remainingBorrowEvent.parsedJson as RemainingBorrowValueEvent;
        const remainingBorrowValueInTestSui = formatUnits(eventData.remaining_borrow_value, 18);
        setRemainingBorrowValue(remainingBorrowValueInTestSui);
      }
    } catch (error) {
      console.error('Silent refresh failed:', error);
    }
  };

  // 添加 updateSelectedSupplied 函数
  const updateSelectedSupplied = (position: UserPositionEvent) => {
    if (selectedAsset) {
      const assetIndex = position.assets.findIndex(
        a => `0x${a.name}` === selectedAsset.type
      );
      if (assetIndex !== -1) {
        setSelectedUserSupplied(formatUnits(position.borrows[assetIndex], 9));
      } else {
        setSelectedUserSupplied("0");
      }
    }
  };

  // 修改为 handleBorrowClick
  const handleBorrowClick = (asset: LendingPoolData) => {
    setSelectedAsset(asset);
    setInteractionMode('borrow');
    
    if (userPosition) {
      const assetIndex = userPosition.assets.findIndex(
        a => `0x${a.name}` === asset.type
      );
      if (assetIndex !== -1) {
        setSelectedUserSupplied(formatUnits(userPosition.borrows[assetIndex], 9));
      } else {
        setSelectedUserSupplied("0");
      }
    } else {
      setSelectedUserSupplied("0");
    }

    // 使用更准确的选择器来定位返回箭头按钮
    setTimeout(() => {
      const backButton = document.querySelector('.rt-Button.rt-variant-ghost[style*="padding: 4px"][style*="font-size: 24px"]');
      if (backButton instanceof HTMLElement) {
        backButton.click();
      }
    }, 0);
  };

  // 修改为 handleRepayClick
  const handleRepayClick = (asset: LendingPoolData) => {
    setSelectedAsset(asset);
    setInteractionMode('repay');
    
    if (userPosition) {
      const assetIndex = userPosition.assets.findIndex(
        a => `0x${a.name}` === asset.type
      );
      if (assetIndex !== -1) {
        setSelectedUserSupplied(formatUnits(userPosition.borrows[assetIndex], 9));
      } else {
        setSelectedUserSupplied("0");
      }
    } else {
      setSelectedUserSupplied("0");
    }

    // 等待状态更新后尝试点击 BorrowPanel 中的 repay 按钮
    setTimeout(() => {
      const repayButton = document.querySelector('.action-button.secondary');
      if (repayButton instanceof HTMLElement) {
        repayButton.click();
      }
    }, 0);
  };

  // 添加 useEffect
  useEffect(() => {
    if (currentAccount) {
      // 重置所有状态
      setIsLoadingPosition(true);
      setUserPosition(null);
      setHealthFactor(null);
      setMaxBorrowValue(null);
      setUserAssets(new Map());
      setSelectedAsset(undefined);
      setSelectedUserSupplied("0");

      // ���询新钱包地址的数据
      queryUserData(currentAccount.address);
    } else {
      // 当钱包断开连接时重置所有状态
      setUserPosition(null);
      setHealthFactor(null);
      setMaxBorrowValue(null);
      setUserAssets(new Map());
      setSelectedAsset(undefined);
      setSelectedUserSupplied("0");
      setIsLoadingPosition(false);
    }
  }, [currentAccount?.address]);

  // 修改默认选择资产的 useEffect
  useEffect(() => {
    if (
      lendingPoolsData?.length > 0 && 
      !selectedAsset && 
      !isLoadingPosition && 
      userPosition
    ) {
      handleBorrowClick(lendingPoolsData[0]);  // 改为 handleBorrowClick
    }
  }, [lendingPoolsData, isLoadingPosition, userPosition]);

  return (
    <Container className="lending-container" style={{ padding: '0 8px', maxWidth: '100%', margin: '0 auto' }}>
      <Flex gap="4" mb="4" wrap="wrap">
        <OverviewCard
          title="Your Supplies"
          value={formatUnits(userPosition?.supply_value || "0", 9)}
        />
        <OverviewCard
          title="Your Borrows"
          value={formatUnits(userPosition?.borrow_value || "0", 9)}
        />
        <OverviewCard
          title="Health Factor"
          value={healthFactor === "0" ? "-" : healthFactor || "-"}
          isHealthFactor
        />
      </Flex>

      <Flex gap="4" wrap="wrap">
        <Box className="main-content" style={{ flex: 4 }}>
          <BorrowedAssetsTable 
            userPosition={userPosition} 
            isLoading={isLoadingPosition}
            onBorrowClick={handleBorrowClick}  // 改为 handleBorrowClick
            onRepayClick={handleRepayClick}    // 改为 handleRepayClick
          />
          <AssetsToBorrowTable 
            onBorrowClick={handleBorrowClick}  // 改为 handleBorrowClick
          />
        </Box>
        <Box style={{ flex: 2 }}>
          <InteractionPanel 
            handleTabChange={handleTabChange}
            selectedAsset={selectedAsset}
            userSupplied={selectedUserSupplied}
            isLoadingPosition={isLoadingPosition}
            onTransactionSuccess={refreshData}
            healthFactor={healthFactor || "0"}
            defaultMode={interactionMode}
            maxBorrowValue={remainingBorrowValue || "0"}
            defaultTab="borrow"
          />
        </Box>
      </Flex>
    </Container>
  );
} 