import { Box, Button, Container, Flex, Text, Select, Table, TextField } from "@radix-ui/themes";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { Token, useTokenList } from "./hooks/useTokenList";
import { 
  LENDING_CORE_PACKAGE_ID, 
  LENDING_STORAGE_ID, 
  CLOCK_ID, 
  TESTSUI_PACKAGE_ID,
  TESTSUI_ICON_URL,
  TESTSUI_METADATA_ID,
  API_BASE_URL
} from "./config";
import { useLendingList } from "./hooks/useLendingList";
import { formatUnits } from './utils/format';
import { useLendingData, LendingPoolData } from './hooks/useLendingData';
import { useState, useEffect } from 'react';
import { useQueryClient, useQueries } from "@tanstack/react-query";
import { useTokenBalance } from "./hooks/useTokenBalance";

export function LendingTest() {
  const { data: tokens } = useTokenList();
  const { data: lendings, invalidateLendings } = useLendingList();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();

  // 只显示已创建流动性池的代币（包括 TESTSUI
  const availableTokens = tokens?.filter(token => 
    token.status === "LIQUIDITY_POOL_CREATED" && 
    token.type !== `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`
  ) || [];

  // 获取 TESTSUI 代币信息
  const testSuiToken = tokens?.find(token => 
    token.type === `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`
  );

  const handleAddTestSui = async () => {
    if (!currentAccount) {
      console.log('请先连接钱包');
      return;
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${LENDING_CORE_PACKAGE_ID}::lending_core::add_testsui_asset`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.object(CLOCK_ID),
        ],
      });

      await signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            try {
              await suiClient.waitForTransaction({
                digest: result.digest,
              });

              const txDetails = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: {
                  showEffects: true,
                  showEvents: true,
                  showInput: true,
                  showObjectChanges: true,
                },
              });

              const createdObjects = txDetails.objectChanges?.filter(
                (change) => change.type === "created"
              );
              
              const lendingPoolObject = createdObjects?.find(
                (obj) => obj.objectType.includes("::LendingPool<")
              );
              
              if (!lendingPoolObject) {
                throw new Error('未找到 LendingPool 对象');
              }

              await fetch(`${API_BASE_URL}/lendings`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`,
                  name: "testsui",
                  symbol: "TESTSUI",
                  icon: TESTSUI_ICON_URL,
                  decimals: 9,
                  metadataId: TESTSUI_METADATA_ID,
                  lendingPoolId: lendingPoolObject.objectId
                }),
              });

              invalidateLendings();
              console.log('成功添加 TESTSUI 到借贷池，交易哈希:', result.digest);
            } catch (error) {
              console.error('保存借贷池信息失败:', error);
            }
          },
          onError: (error) => {
            console.error('添加 TESTSUI 失败:', error);
          },
        }
      );
    } catch (error) {
      console.error('添加 TESTSUI 失败:', error);
    }
  };

  const handleAddTokenAsset = async (token: Token, poolId: string) => {
    if (!currentAccount) {
      console.log('请先连接钱包');
      return;
    }

    try {
      const tx = new Transaction();
      
      const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
      const comparison = token.type.toLowerCase() > testSuiType.toLowerCase();

      if (comparison) {
        tx.moveCall({
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::add_token_asset_a`,
          typeArguments: [token.type],
          arguments: [
            tx.object(LENDING_STORAGE_ID),
            tx.object(poolId),
            tx.object(CLOCK_ID),
          ],
        });
      } else {
        tx.moveCall({
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::add_token_asset_b`,
          typeArguments: [token.type],
          arguments: [
            tx.object(LENDING_STORAGE_ID),
            tx.object(poolId),
            tx.object(CLOCK_ID),
          ],
        });
      }

      await signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            try {
              await suiClient.waitForTransaction({
                digest: result.digest,
              });

              const txDetails = await suiClient.getTransactionBlock({
                digest: result.digest,
                options: {
                  showEffects: true,
                  showEvents: true,
                  showInput: true,
                  showObjectChanges: true,
                },
              });

              const createdObjects = txDetails.objectChanges?.filter(
                (change) => change.type === "created"
              );
              
              const lendingPoolObject = createdObjects?.find(
                (obj) => obj.objectType.includes("::LendingPool<")
              );

              if (!lendingPoolObject) {
                throw new Error('未找到 LendingPool 对象');
              }

              await fetch(`${API_BASE_URL}/lendings`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  type: token.type,
                  name: token.name,
                  symbol: token.symbol,
                  icon: token.icon,
                  decimals: token.decimals,
                  metadataId: token.metadataId,
                  lendingPoolId: lendingPoolObject.objectId
                }),
              });

              invalidateLendings();
              console.log('成功添加资产到借贷池，交易哈希:', result.digest);
            } catch (error) {
              console.error('保存借贷池信息失败:', error);
            }
          },
          onError: (error) => {
            console.error('添加资产失败:', error);
          },
        }
      );
    } catch (error) {
      console.error('添加资产失败:', error);
    }
  };

  const isTokenInLendingPool = (tokenType: string) => {
    return lendings?.some(lending => lending.type === tokenType);
  };

  // 获取借贷池数据
  const lendingPoolsData = useLendingData(lendings);

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
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::supply_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            paymentCoin,
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        // 准备代币支付
        const paymentCoin = await preparePaymentCoin(
          pool.type,
          amountValue,
          tx
        );

        tx.moveCall({
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::supply_token`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
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
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::withdraw_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        tx.moveCall({
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::withdraw_token`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
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

  // 添加借款和还款函数
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
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::borrow_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        tx.moveCall({
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::borrow_token`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
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
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::repay_testsui`,
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
            paymentCoin,
            tx.pure.u64(amountValue),
          ],
        });
      } else {
        // 准备代币支付
        const paymentCoin = await preparePaymentCoin(
          pool.type,
          amountValue,
          tx
        );

        tx.moveCall({
          target: `${LENDING_CORE_PACKAGE_ID}::lending_core::repay_token`,
          typeArguments: [pool.type],
          arguments: [
            tx.object(CLOCK_ID),
            tx.object(LENDING_STORAGE_ID),
            tx.object(pool.lendingPoolId),
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
                disabled={!amount}
              >
                借款
              </Button>
              <Button 
                size="1"
                onClick={() => handleAction(onRepay)}
                disabled={!amount}
              >
                还款
              </Button>
            </Flex>
          </Flex>
        </Table.Cell>
      </Table.Row>
    );
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
        {/* 资产管理部分 */}
        <Box>
          <Text size="4" weight="bold" mb="4">1. 资产管理</Text>
          
          {/* 1.1 添加 TESTSUI */}
          <Box mb="4">
            <Text size="3" weight="bold" mb="2">1.1 添加 TESTSUI 到借贷池</Text>
            <Box mb="3">
              <Text color="gray" as="p" mb="3">
                • TESTSUI 是借贷池的基础资产，需要首先添加
              </Text>
            </Box>
            <Button 
              onClick={handleAddTestSui}
              disabled={isTokenInLendingPool(`${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`)}
            >
              添加 TESTSUI 到借贷池
            </Button>
          </Box>

          {/* 1.2 添加其他代币 */}
          <Box mb="4">
            <Text size="3" weight="bold" mb="2">1.2 添加其他代币到借贷池</Text>
            <Box mb="3">
              <Text color="gray" as="p" mb="1">
                • 只有状态为 LIQUIDITY_POOL_CREATED 的代币才能被添加到借贷池
              </Text>
              <Text color="gray" as="p" mb="3">
                • 添加资产时会自动判断代币类型顺序，选择正确的函数调用
              </Text>
            </Box>
            <Flex direction="column" gap="2">
              {availableTokens.map(token => (
                <Flex key={token.type} justify="between" align="center">
                  <Text>{token.symbol}</Text>
                  <Button 
                    onClick={() => handleAddTokenAsset(token, token.poolId!)}
                    disabled={!token.poolId || isTokenInLendingPool(token.type)}
                  >
                    添加到借贷池
                  </Button>
                </Flex>
              ))}
              {availableTokens.length === 0 && (
                <Text color="gray">暂无可添加的代币（需要先创建流动性池）</Text>
              )}
            </Flex>
          </Box>
        </Box>
        <Box>
          <Text size="4" weight="bold" mb="4">2. 存取借还</Text>
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
                  onBorrow={handleBorrow}
                  onRepay={handleRepay}
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
          <Text size="4" weight="bold" mb="4">3. 查询功能</Text>
          <Text color="gray">即将实现...</Text>
        </Box>
      </Flex>
    </Container>
  );
} 