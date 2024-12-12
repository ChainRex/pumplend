import { Box, Button, Container, Flex, Text, Table } from "@radix-ui/themes";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { 
  PUMPLEND_CORE_PACKAGE_ID, 
  LENDING_STORAGE_ID, 
  CLOCK_ID, 
  TESTSUI_PACKAGE_ID,
} from "./config";
import { useLendingList } from "./hooks/useLendingList";
import { formatUnits } from './utils/format';
import { useLendingData, LendingPoolData } from './hooks/useLendingData';
import { useState, useEffect } from 'react';
import { useQueryClient } from "@tanstack/react-query";
import { useTokenBalance } from "./hooks/useTokenBalance";
import { ClipLoader } from "react-spinners";

// 修改 UserPositionEvent 接口定义
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


// 添加健康因子事件接口
interface HealthFactorEvent {
  user: string;
  health_factor: string;
}

// 添加剩余可借款价值事件接口
interface RemainingBorrowValueEvent {
  user: string;
  remaining_borrow_value: string;
}

export function LendingTest() {
  const { data: lendings, invalidateLendings } = useLendingList();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();


  // 获取借贷池数据
  const lendingPoolsData = useLendingData(lendings);

  console.log("lendingPoolsData:",lendingPoolsData);

  // 修改 preparePaymentCoin 函数
  const preparePaymentCoin = async (
    coinType: string,
    amount: bigint,
    tx: Transaction
  ) => {
    if (!currentAccount) {
      throw new Error("请先连接钱包");
    }

    // 获取用户的所有代币
    const coins = await suiClient.getCoins({
      owner: currentAccount.address,
      coinType,
    });

    if (coins.data.length === 0) {
      throw new Error("余额不足");
    }

    // 计算总余额
    const totalBalance = coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    );

    if (totalBalance < amount) {
      throw new Error("余额不足");
    }

    // 先尝试找到单个足够大的代币
    const singleCoin = coins.data.find(coin => BigInt(coin.balance) >= amount);
    if (singleCoin) {
      return tx.object(singleCoin.coinObjectId);
    }

    // 如果没有单个足够大的代币，需要合并
    console.log('没有找到单个足够大的代币，需要合并多个代币');

    // 合并所有代币到第一个代币
    const primaryCoin = tx.object(coins.data[0].coinObjectId);
    if (coins.data.length > 1) {
      tx.mergeCoins(
        primaryCoin,
        coins.data.slice(1).map(coin => tx.object(coin.coinObjectId))
      );
    }

    return primaryCoin;
  };

  // 修改 handleDeposit 函数
  const handleDeposit = async (pool: LendingPoolData, amount: string) => {
    if (!currentAccount) {
      console.log('请先连接钱包');
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      console.log('请输入有效金额');
      return;
    }

    console.log('存款参数:', { pool, amount });

    try {
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(amount) * 1e9));

      if (pool.symbol === 'TESTSUI') {
        // 准备 TESTSUI 支付
        const paymentCoin = await preparePaymentCoin(
          `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`,
          amountValue,
          tx
        );

        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::supply_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            paymentCoin,
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        if (!pool.cetusPoolId) {
          throw new Error("未找到 CETUS 池信息");
        }

        // 准备代币支付
        const paymentCoin = await preparePaymentCoin(
          pool.type,
          amountValue,
          tx
        );

        // 判断代币顺序
        const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
        const comparison = pool.type.toLowerCase() > testSuiType.toLowerCase();

        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::supply_token_${comparison ? 'a' : 'b'}`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.object(pool.cetusPoolId),
            paymentCoin,
            tx.pure.u64(amountValue),
          ],
        });
      }

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result: { digest: string }) => {
            console.log('存款成功，交易哈希:', result.digest);
            
            // 等待交易完成
            await suiClient.waitForTransaction({
              digest: result.digest,
            });

            // 刷新借贷池列表
            invalidateLendings();

            // 刷新所有借贷池数据的缓存
            lendings?.forEach(lending => {
              queryClient.invalidateQueries({
                queryKey: ["lending", lending.lendingPoolId],
              });
            });
            
            console.log('存款成功，交易哈希:', result.digest);

            // 刷新用户仓位
            if (currentAccount) {
              await queryUserData(currentAccount.address);
            }
          },
          onError: (error: Error) => {
            console.error('存款交易错误:', error);
          },
        }
      );

    } catch (error) {
      console.error('存款函数错误:', error);
    }
  };

  // 修改 handleWithdraw 函数
  const handleWithdraw = async (pool: LendingPoolData, amount: string) => {
    if (!currentAccount) {
      console.log('请先连接钱包');
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      console.log('请输入有效金额');
      return;
    }

    console.log('取款参数:', { pool, amount });

    try {
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(amount) * 1e9));

      if (pool.symbol === 'TESTSUI') {
        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::withdraw_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        // 获取 CETUS 池子信息
        const poolInfo = await suiClient.getObject({
          id: pool.cetusPoolId!,
          options: { showContent: true }
        });

        if (!poolInfo.data?.objectId) {
          throw new Error("无法获取 CETUS 池子信息");
        }

        // 判断代币顺序
        const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
        const comparison = pool.type.toLowerCase() > testSuiType.toLowerCase();

        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::withdraw_token_${comparison ? 'a' : 'b'}`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.object(poolInfo.data.objectId),
            tx.pure.u64(amountValue),
          ],
        });
      }

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result: { digest: string }) => {
            console.log('取款成功，交易哈希:', result.digest);
            
            // 等待交易完成
            await suiClient.waitForTransaction({
              digest: result.digest,
            });

            // 刷新借贷池列表
            invalidateLendings();

            // 刷新所有借贷池数据的缓存
            lendings?.forEach(lending => {
              queryClient.invalidateQueries({
                queryKey: ["lending", lending.lendingPoolId],
              });
            });
            
            console.log('取款成功，交易哈希:', result.digest);

            // 刷新用户仓位
            if (currentAccount) {
              await queryUserData(currentAccount.address);
            }
          },
          onError: (error: Error) => {
            console.error('取款交易错误:', error);
          },
        }
      );

    } catch (error) {
      console.error('取款函数错误:', error);
    }
  };

  // 修改 handleBorrow 函数
  const handleBorrow = async (pool: LendingPoolData, amount: string) => {
    if (!currentAccount) {
      console.log('请先连接钱包');
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      console.log('请输入有效金额');
      return;
    }

    console.log('借款参数:', { pool, amount });

    try {
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(amount) * 1e9));

      if (pool.symbol === 'TESTSUI') {
        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::borrow_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        // 获取 CETUS 池子信息
        const poolInfo = await suiClient.getObject({
          id: pool.cetusPoolId!,
          options: { showContent: true }
        });

        if (!poolInfo.data?.objectId) {
          throw new Error("无法获取 CETUS 池子信息");
        }

        // 判断代币顺序
        const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
        const comparison = pool.type.toLowerCase() > testSuiType.toLowerCase();

        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::borrow_token_${comparison ? 'a' : 'b'}`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.object(poolInfo.data.objectId),
            tx.pure.u64(amountValue),
          ],
        });
      }

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result: { digest: string }) => {
            console.log('借款成功，交易哈希:', result.digest);
            
            await suiClient.waitForTransaction({
              digest: result.digest,
            });

            invalidateLendings();
            lendings?.forEach(lending => {
              queryClient.invalidateQueries({
                queryKey: ["lending", lending.lendingPoolId],
              });
            });
            
            console.log('借款成功，交易哈希:', result.digest);

            // 刷新用户仓位
            if (currentAccount) {
              await queryUserData(currentAccount.address);
            }
          },
          onError: (error: Error) => {
            console.error('借款交易错误:', error);
          },
        }
      );

    } catch (error) {
      console.error('借款函数错误:', error);
    }
  };

  // 修改 handleRepay 函数
  const handleRepay = async (pool: LendingPoolData, amount: string) => {
    if (!currentAccount) {
      console.log('请先连接钱包');
      return;
    }

    if (!amount || isNaN(Number(amount))) {
      console.log('请输入有效金额');
      return;
    }

    console.log('还款参数:', { pool, amount });

    try {
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(amount) * 1e9));

      if (pool.symbol === 'TESTSUI') {
        // 准备 TESTSUI 支付
        const paymentCoin = await preparePaymentCoin(
          `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`,
          amountValue,
          tx
        );

        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::repay_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            paymentCoin,
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        // 获取 CETUS 池子信息
        const poolInfo = await suiClient.getObject({
          id: pool.cetusPoolId!,
          options: { showContent: true }
        });

        if (!poolInfo.data?.objectId) {
          throw new Error("无法获取 CETUS 池子信息");
        }

        // 准备代币支付
        const paymentCoin = await preparePaymentCoin(
          pool.type,
          amountValue,
          tx
        );

        // 判断代币顺序
        const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
        const comparison = pool.type.toLowerCase() > testSuiType.toLowerCase();

        tx.moveCall({
          target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::repay_token_${comparison ? 'a' : 'b'}`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.object(poolInfo.data.objectId),
            paymentCoin,
            tx.pure.u64(amountValue),
          ],
        });
      }

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result: { digest: string }) => {
            console.log('还款成功，交易哈希:', result.digest);
            
            await suiClient.waitForTransaction({
              digest: result.digest,
            });

            invalidateLendings();
            lendings?.forEach(lending => {
              queryClient.invalidateQueries({
                queryKey: ["lending", lending.lendingPoolId],
              });
            });
            
            console.log('还款成功，交易哈希:', result.digest);

            // 刷新用户仓位
            if (currentAccount) {
              await queryUserData(currentAccount.address);
            }
          },
          onError: (error: Error) => {
            console.error('还款交易错误:', error);
          },
        }
      );

    } catch (error) {
      console.error('还款函数错误:', error);
    }
  };

  // 修改 LendingPoolRow 组件
  const LendingPoolRow = ({ 
    pool, 
    currentAccount,
    onDeposit,
    onWithdraw,
    onBorrow,
    onRepay
  }: {
    pool: LendingPoolData;
    currentAccount: { address: string } | null;
    onDeposit: (pool: LendingPoolData, amount: string) => void;
    onWithdraw: (pool: LendingPoolData, amount: string) => void;
    onBorrow: (pool: LendingPoolData, amount: string) => void;
    onRepay: (pool: LendingPoolData, amount: string) => void;
  }) => {
    const [amount, setAmount] = useState('');
    const { data: balance } = useTokenBalance(
      currentAccount?.address,
      pool.type
    );

    const handleAction = (action: (pool: LendingPoolData, amount: string) => void) => {
      action(pool, amount);
      setAmount(''); // 操作后清空输入
    };

    return (
      <Table.Row>
        <Table.Cell>
          <Flex align="center" gap="2">
            <img 
              src={pool.icon} 
              alt={pool.name} 
              style={{ 
                width: '24px', 
                height: '24px',
                borderRadius: '50%'
              }} 
            />
            {pool.symbol}
          </Flex>
        </Table.Cell>
        <Table.Cell>{pool.reserves}</Table.Cell>
        <Table.Cell>{pool.totalSupplies}</Table.Cell>
        <Table.Cell>{pool.totalBorrows}</Table.Cell>
        <Table.Cell>{pool.supplyRate}</Table.Cell>
        <Table.Cell>{pool.borrowRate}</Table.Cell>
        <Table.Cell>{pool.lastUpdateTime}</Table.Cell>
        <Table.Cell>
          {currentAccount ? balance?.formatted || "0" : "-"}
        </Table.Cell>
        <Table.Cell>
          <Flex gap="2" align="center">
            <input
              type="number"
              step="0.000000001"
              placeholder="输入金额"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{
                width: '120px',
                padding: '6px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            />
            <Flex gap="2">
              <Button 
                size="1"
                onClick={() => handleAction(onDeposit)}
                disabled={!amount}
              >
                存款
              </Button>
              <Button 
                size="1"
                onClick={() => handleAction(onWithdraw)}
                disabled={!amount}
              >
                取款
              </Button>
              <Button 
                size="1"
                onClick={() => handleAction(onBorrow)}
                disabled={!amount || !shouldShowLendingButtons(pool)}
              >
                借款
              </Button>
              <Button 
                size="1"
                onClick={() => handleAction(onRepay)}
                disabled={!amount || !shouldShowLendingButtons(pool)}
              >
                还款
              </Button>
            </Flex>
          </Flex>
        </Table.Cell>
      </Table.Row>
    );
  };

  const [userPosition, setUserPosition] = useState<UserPositionEvent | null>(null);
  const [isLoadingPosition, setIsLoadingPosition] = useState(false);
  const [healthFactor, setHealthFactor] = useState<string | null>(null);
  const [maxBorrowValue, setMaxBorrowValue] = useState<string | null>(null);

  // 添加一个新的函数来处理所有的 dryRun 查询
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

      // 添加查询健康因子的调用
      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_health_factor`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(address)
        ],
      });

      // 添加查询剩余可借款价值的调用
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

      console.log("dryRunResult:", dryRunResult);

      // 处理用户仓位事件
      const positionEvent = dryRunResult.events?.find(
        event => event.type.includes('::GetUserPositionEvent')
      );
      if (positionEvent?.parsedJson) {
        setUserPosition(positionEvent.parsedJson as UserPositionEvent);
      }

      // 处理健康因子事件
      const healthFactorEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateHealthFactorEvent')
      );
      if (healthFactorEvent?.parsedJson) {
        const eventData = healthFactorEvent.parsedJson as HealthFactorEvent;
        // 将健康因子转换为百分比格式
        const healthFactorValue = (Number(eventData.health_factor) / 100).toFixed(2);
        setHealthFactor(healthFactorValue);
      }

      // 处理最大可借款价值事件
      const remainingBorrowEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateRemainingBorrowValueEvent')
      );
      if (remainingBorrowEvent?.parsedJson) {
        const eventData = remainingBorrowEvent.parsedJson as RemainingBorrowValueEvent;
        const remainingBorrowValueInTestSui = formatUnits(eventData.remaining_borrow_value, 18);
        setMaxBorrowValue(remainingBorrowValueInTestSui);
      }
    } catch (error) {
      console.error('查询用户数据失败:', error);
    } finally {
      setIsLoadingPosition(false);
    }
  };

  // 修改 useEffect，使用新的查询函数
  useEffect(() => {
    if (currentAccount) {
      queryUserData(currentAccount.address);
    } else {
      setUserPosition(null);
      setHealthFactor(null);
      setMaxBorrowValue(null);
    }
  }, [currentAccount]);

  const UserPositionDisplay = ({ position }: { position: UserPositionEvent }) => {
    const getPoolData = (assetType: string) => {
      const pool = lendingPoolsData.find(pool => {
        if (assetType.includes("::testsui::TESTSUI")) {
          return pool.symbol === "TESTSUI";
        }
        const normalizedAssetType = assetType.startsWith("0x") ? assetType : "0x" + assetType;
        return pool.type === normalizedAssetType;
      });
      return pool;
    };

    // 过滤出有存款或借款的资产
    const activeAssets = position.assets.map((asset, index) => ({
      asset,
      supply: position.supplies[index],
      borrow: position.borrows[index],
      supplySnapshot: position.supply_index_snapshots[index],
      borrowSnapshot: position.borrow_index_snapshots[index],
      index
    })).filter(item => 
      // 如果存款或借款金额大于0，则显示该资产
      BigInt(item.supply) > BigInt(0) || BigInt(item.borrow) > BigInt(0)
    );

    return (
      <>
        <Box mb="4">
          <Flex gap="6">
            <Flex align="center" gap="2">
              <Text weight="bold">总存款价值:</Text>
              <Text>
                {formatUnits(position.supply_value, 9)} TESTSUI
              </Text>
            </Flex>
            <Flex align="center" gap="2">
              <Text weight="bold">总借款价值:</Text>
              <Text>
                {formatUnits(position.borrow_value, 9)} TESTSUI
              </Text>
            </Flex>
            <Flex align="center" gap="2">
              <Text weight="bold">剩余可借款价值:</Text>
              <Text>
                {maxBorrowValue || "0"} TESTSUI
              </Text>
            </Flex>
          </Flex>
        </Box>
        <Table.Root variant="surface">
          <Table.Header>
            <Table.Row>
              <Table.ColumnHeaderCell>资产类型</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>存款金额</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>存款利率</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>存款利率快照</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>借款金额</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>借款利率</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>借款利率快照</Table.ColumnHeaderCell>
              <Table.ColumnHeaderCell>LTV</Table.ColumnHeaderCell>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            {activeAssets.map(({ asset, supply, borrow, supplySnapshot, borrowSnapshot, index }) => {
              const assetType = asset.name;
              const displayName = assetType.split('::').pop() || assetType;
              const poolData = getPoolData(assetType);

              return (
                <Table.Row key={index}>
                  <Table.Cell>{displayName}</Table.Cell>
                  <Table.Cell>
                    {supply !== "0" ? formatUnits(supply, 9) : '-'}
                  </Table.Cell>
                  <Table.Cell>
                    {poolData?.supplyRate || '-'}
                  </Table.Cell>
                  <Table.Cell>
                    {supplySnapshot !== "0" ? supplySnapshot : '-'}
                  </Table.Cell>
                  <Table.Cell>
                    {borrow !== "0" ? formatUnits(borrow, 9) : '-'}
                  </Table.Cell>
                  <Table.Cell>
                    {poolData?.borrowRate || '-'}
                  </Table.Cell>
                  <Table.Cell>
                    {borrowSnapshot !== "0" ? borrowSnapshot : '-'}
                  </Table.Cell>
                  <Table.Cell>
                    {poolData?.ltv ? `${poolData.ltv}%` : '-'}
                  </Table.Cell>
                </Table.Row>
              );
            })}
            {activeAssets.length === 0 && (
              <Table.Row>
                <Table.Cell colSpan={8}>
                  <Text color="gray" align="center">
                    暂无仓位数据
                  </Text>
                </Table.Cell>
              </Table.Row>
            )}
          </Table.Body>
        </Table.Root>
      </>
    );
  };

  // 修改 HealthFactorDisplay 组件
  const HealthFactorDisplay = () => {
    if (!currentAccount) return null;

    const getHealthFactorColor = (value: number) => {
      if (value >= 1.5) return "green";
      if (value >= 1.0) return "orange";
      return "red";
    };

    // 检查是否只有存款没有借款
    const hasOnlyDeposits = userPosition && 
      BigInt(userPosition.supply_value) > 0 && 
      BigInt(userPosition.borrow_value) === BigInt(0);

    return (
      <Box>
        <Flex align="center" gap="2">
          <Text weight="bold">健康因子:</Text>
          {hasOnlyDeposits ? (
            <Text color="green" weight="bold">∞</Text>
          ) : healthFactor ? (
            <Text 
              color={getHealthFactorColor(Number(healthFactor))}
              weight="bold"
            >
              {healthFactor}
            </Text>
          ) : (
            <Text color="gray">-</Text>
          )}
        </Flex>
      </Box>
    );
  };

  // 判断是否显示借贷按钮
  const shouldShowLendingButtons = (pool: LendingPoolData) => {
    if (pool.symbol === 'TESTSUI') {
      return true;
    }
    return pool.price >= 0.0125; // 只有价格大于等于0.0125时才显示按钮
  };


  return (
    <Container>
      <Box mb="4">
        <Text size="5" weight="bold">借贷测试页面</Text>
      </Box>

      <Box mb="4">
        <Text color="gray" as="p" mb="2">
          此页面仅用于测试借贷合约功能
        </Text>
      </Box>

      <Flex direction="column" gap="6">
        {/* 删除资产管理部分,直接从存取借还开始 */}
        <Box>
          <Text size="4" weight="bold" mb="4">1. 存取借还</Text>
          <Table.Root variant="surface">
            <Table.Header>
              <Table.Row>
                <Table.ColumnHeaderCell>代币</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>储备金总额</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>存款总额</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>借款总额</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>存款利率</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>借款利率</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>最后更新时间</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>钱包余额</Table.ColumnHeaderCell>
                <Table.ColumnHeaderCell>操作</Table.ColumnHeaderCell>
              </Table.Row>
            </Table.Header>

            <Table.Body>
              {lendingPoolsData.map((pool: LendingPoolData) => (
                <LendingPoolRow
                  key={pool.id}
                  pool={pool}
                  currentAccount={currentAccount}
                  onDeposit={handleDeposit}
                  onWithdraw={handleWithdraw}
                  onBorrow={shouldShowLendingButtons(pool) ? handleBorrow : () => {}}
                  onRepay={shouldShowLendingButtons(pool) ? handleRepay : () => {}}
                />
              ))}
              {(!lendingPoolsData || lendingPoolsData.length === 0) && (
                <Table.Row>
                  <Table.Cell colSpan={9}>
                    <Text color="gray" align="center">
                      暂无借贷池数据
                    </Text>
                  </Table.Cell>
                </Table.Row>
              )}
            </Table.Body>
          </Table.Root>
        </Box>

        {/* 查询功能部分 */}
        <Box>
          <Text size="4" weight="bold" mb="4">2. 用户仓位</Text>
          <Flex direction="column" gap="4">
            {/* 添加健康因子显示 */}
            <HealthFactorDisplay />
            
            {isLoadingPosition ? (
              <Flex justify="center" py="4">
                <ClipLoader size={24} />
              </Flex>
            ) : currentAccount ? (
              userPosition ? (
                <>
                  <UserPositionDisplay position={userPosition} />
                </>
              ) : (
                <Text color="gray" align="center">暂无仓位数据</Text>
              )
            ) : (
              <Text color="gray" align="center">请先连接钱包查看仓位信息</Text>
            )}
          </Flex>
        </Box>
      </Flex>
    </Container>
  );
} 
