import { Box, Container, Flex } from "@radix-ui/themes";
import { useNavigate } from "react-router-dom";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PUMPLEND_CORE_PACKAGE_ID, LENDING_STORAGE_ID } from "./config";
import { formatUnits } from './utils/format';
import { OverviewCard } from "./components/lending/OverviewCard";
import { SuppliedAssetsTable } from "./components/lending/SuppliedAssetsTable";
import { AssetsToSupplyTable } from "./components/lending/AssetsToSupplyTable";
import { InteractionPanel } from "./components/lending/InteractionPanel";
import { useState, useEffect } from 'react';
import { LendingPoolData } from "./hooks/useLendingData";
import { useLendingList } from "./hooks/useLendingList";
import { useLendingData } from "./hooks/useLendingData";

// 添加必要的接口定义
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

// 添加新的接口定义
interface MaxBorrowValueEvent {
  user: string;
  max_borrow_value: string;
}

// 添加新的接口来存储用户资产数据
interface UserAssetData {
  asset: LendingPoolData;
  supplied: string;
}

export function Lending() {
  const navigate = useNavigate();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const [userPosition, setUserPosition] = useState<UserPositionEvent | null>(null);
  const [healthFactor, setHealthFactor] = useState<string | null>(null);
  const [maxBorrowValue, setMaxBorrowValue] = useState<string | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [, setUserAssets] = useState<Map<string, UserAssetData>>(new Map());
  const [selectedAsset, setSelectedAsset] = useState<LendingPoolData | undefined>();
  const [selectedUserSupplied, setSelectedUserSupplied] = useState<string>("0");
  const { data: lendings } = useLendingList();
  const lendingPoolsData = useLendingData(lendings);
  const [interactionMode, setInteractionMode] = useState<'supply' | 'withdraw'>('supply');

  const handleTabChange = (value: string) => {
    if (value === 'borrow') {
      navigate('/borrow');
    }
  };

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
        setMaxBorrowValue(remainingBorrowValueInTestSui);
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

  // 修改 useEffect 来监听钱包连接状态
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

      // 查询新钱包地址的数据
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
  }, [currentAccount?.address]); // 使用 address 作为依赖项而不是整个 currentAccount 对象

  // 修改处理供应按钮点击事件
  const handleSupplyClick = (asset: LendingPoolData) => {
    setSelectedAsset(asset);
    setInteractionMode('supply');
    
    // 从用户仓位中查找对应资产的存款金额
    if (userPosition) {
      const assetIndex = userPosition.assets.findIndex(
        a => `0x${a.name}` === asset.type
      );
      if (assetIndex !== -1) {
        setSelectedUserSupplied(formatUnits(userPosition.supplies[assetIndex], 9));
      } else {
        setSelectedUserSupplied("0");
      }
    } else {
      setSelectedUserSupplied("0");
    }
  };

  // 修改默认选择资产的 useEffect
  useEffect(() => {
    if (
      lendingPoolsData?.length > 0 && 
      !selectedAsset && 
      !isLoadingPosition && 
      userPosition // 确保用户仓位数据已加载
    ) {
      handleSupplyClick(lendingPoolsData[0]);
    }
  }, [lendingPoolsData, isLoadingPosition, userPosition]); // 添加 userPosition 作为依赖项

  // 添加一个更新选中资产存款金额的函数
  const updateSelectedSupplied = (position: UserPositionEvent) => {
    if (selectedAsset) {
      const assetIndex = position.assets.findIndex(
        a => `0x${a.name}` === selectedAsset.type
      );
      if (assetIndex !== -1) {
        setSelectedUserSupplied(formatUnits(position.supplies[assetIndex], 9));
      } else {
        setSelectedUserSupplied("0");
      }
    }
  };

  // 添加静默刷新函数
  const refreshData = async () => {
    if (!currentAccount) return;
    
    const tx = new Transaction();
    
    // 添加所有必要的查询
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

      // 更新用仓位数据
      const positionEvent = dryRunResult.events?.find(
        event => event.type.includes('::GetUserPositionEvent')
      );
      
      if (positionEvent?.parsedJson) {
        const position = positionEvent.parsedJson as UserPositionEvent;
        setUserPosition(position);
        updateSelectedSupplied(position);
      }

      // 更新健康因子
      const healthFactorEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateHealthFactorEvent')
      );
      if (healthFactorEvent?.parsedJson) {
        const eventData = healthFactorEvent.parsedJson as HealthFactorEvent;
        const healthFactorNum = Number(eventData.health_factor) / 100;
        const healthFactorValue = healthFactorNum > 1000 ? "∞" : healthFactorNum.toFixed(2);
        setHealthFactor(healthFactorValue);
      }

      // 更新最大借款价值
      const maxBorrowValueEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateMaxBorrowValueEvent')
      );
      if (maxBorrowValueEvent?.parsedJson) {
        const eventData = maxBorrowValueEvent.parsedJson as MaxBorrowValueEvent;
        const maxBorrowValueInTestSui = formatUnits(eventData.max_borrow_value, 18);
        setMaxBorrowValue(maxBorrowValueInTestSui);
      }
    } catch (error) {
      console.error('Silent refresh failed:', error);
    }
  };

  const handleWithdrawClick = (asset: LendingPoolData) => {
    setSelectedAsset(asset);
    setInteractionMode('withdraw');
    // 从用户仓位中查找对应资产的存款金额
    if (userPosition) {
      const assetIndex = userPosition.assets.findIndex(
        a => `0x${a.name}` === asset.type
      );
      if (assetIndex !== -1) {
        setSelectedUserSupplied(formatUnits(userPosition.supplies[assetIndex], 9));
      } else {
        setSelectedUserSupplied("0");
      }
    } else {
      setSelectedUserSupplied("0");
    }
  };

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
          <SuppliedAssetsTable 
            userPosition={userPosition} 
            isLoading={isLoadingPosition}
            maxBorrowValue={maxBorrowValue}
            onSupplyClick={handleSupplyClick}
            onWithdrawClick={handleWithdrawClick}
          />
          <AssetsToSupplyTable 
            onSupplyClick={handleSupplyClick}
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
          />
        </Box>
      </Flex>
    </Container>
  );
}