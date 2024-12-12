import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { LendingPoolData } from "../../hooks/useLendingData";
import { useTokenBalance } from "../../hooks/useTokenBalance";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { ClipLoader } from "react-spinners";
import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, LENDING_STORAGE_ID, PUMPLEND_CORE_PACKAGE_ID, TESTSUI_PACKAGE_ID } from "../../config";

interface SupplyPanelProps {
  selectedAsset?: LendingPoolData;
  userSupplied?: string;
  isLoadingPosition: boolean;
  onTransactionSuccess: () => Promise<void>;
  healthFactor?: string;
  defaultMode?: 'supply' | 'withdraw';
}

export function SupplyPanel({ 
  selectedAsset, 
  userSupplied = "0",
  isLoadingPosition,
  onTransactionSuccess,
  healthFactor = "0",
  defaultMode = 'supply',
}: SupplyPanelProps) {
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [previewHealthFactor, setPreviewHealthFactor] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const suiClient = useSuiClient();
  const { data: balance, refetch: refetchBalance } = useTokenBalance(
    currentAccount?.address,
    selectedAsset?.type
  );
  const [previewController, setPreviewController] = useState<AbortController | null>(null);
  const [mode, setMode] = useState<'supply' | 'withdraw'>(defaultMode);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 当选中资产变化时重置输入金额
  useEffect(() => {
    setAmount("");
  }, [selectedAsset]);

  // 当 defaultMode 或 selectedAsset 改变时更新模式
  useEffect(() => {
    setMode(defaultMode);
    setAmount('');
    setPreviewHealthFactor(null);
    setIsPreviewLoading(false);
    if (previewController) {
      previewController.abort();
      setPreviewController(null);
    }
  }, [defaultMode, selectedAsset]);

  // 添加准备代币的函数
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

    // 先尝试到单个足够大的代币
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

  // 添加一个函数来检查健康因子是否安全
  const isHealthFactorSafe = (value: string | null) => {
    if (!value || value === "-" || value === "∞") return true;
    console.log("value",value);
    
    if (value === "< 1") return false;
    return parseFloat(value) >= 1;
  };

  // 修改预览函数，根据模式使用不同的交易
  const previewSupply = async (value: string) => {
    if (!currentAccount || !selectedAsset || !value) {
      setPreviewHealthFactor(null);
      return;
    }

    // 如果有正在进行的预览，中断它
    if (previewController) {
      previewController.abort();
    }

    // 创建新的 AbortController
    const controller = new AbortController();
    setPreviewController(controller);

    try {
      setIsPreviewLoading(true);
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(value) * 1e9));

      if (mode === 'supply') {
        // 先添加 supply 交易
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::supply_testsui`,
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              await preparePaymentCoin(`${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`, amountValue, tx),
              tx.pure.u64(amountValue),
            ],
          });
        } else {
          // ... 其他代币的 supply 逻辑 ...
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = selectedAsset.type.toLowerCase() > testSuiType.toLowerCase();

          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::supply_token_${comparison ? 'a' : 'b'}`,
            typeArguments: [selectedAsset.type],
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID), 
              tx.object(selectedAsset.lendingPoolId),
              tx.object(selectedAsset.cetusPoolId!),
              await preparePaymentCoin(selectedAsset.type, amountValue, tx),
              tx.pure.u64(amountValue),
            ],
          });
        }
      } else {
        // withdraw 逻辑
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::withdraw_testsui`,
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              tx.pure.u64(amountValue),
            ],
          });
        } else {
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = selectedAsset.type.toLowerCase() > testSuiType.toLowerCase();

          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::withdraw_token_${comparison ? 'a' : 'b'}`,
            typeArguments: [selectedAsset.type],
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              tx.object(selectedAsset.cetusPoolId!),
              tx.pure.u64(amountValue),
            ],
          });
        }
      }

      // 在交易之后添加健康因子查询
      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_health_factor`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(currentAccount.address)
        ],
      });

      tx.setSender(currentAccount.address);

      // 使用 signal 进行中断控制
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
      });

      // 如果已经被中断，直接返回
      if (controller.signal.aborted) {
        return;
      }

      const healthFactorEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateHealthFactorEvent')
      );

      if (healthFactorEvent?.parsedJson) {
        const eventData = healthFactorEvent.parsedJson as { health_factor: string };
        const healthFactorNum = Number(eventData.health_factor) / 100;
        const newHealthFactor = healthFactorNum > 1000 ? "∞" : healthFactorNum.toFixed(2);
        setPreviewHealthFactor(newHealthFactor);
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'message' in error &&
          typeof error.message === 'string') {
        if (error.message.includes('1004')) {
          console.log("小于1");
          setPreviewHealthFactor('< 1');
          setErrorMessage(null);
        } else if (error.message.includes('1001')) {
          console.log("存款储备金不足");
          setErrorMessage("Insufficient balance in reserve");
          setPreviewHealthFactor(null);
        }
        setIsPreviewLoading(false);
        return; 
      } 
      
      if (error && typeof error === 'object' && 'name' in error && 
          error.name === 'AbortError') {
        return;
      }
      
      console.error('预览健康因子失败:', error);
      setPreviewHealthFactor(null);
    } finally {
      setIsPreviewLoading(false);
      if (controller === previewController) {
        setPreviewController(null);
      }
    }
  };

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    setErrorMessage(null);
    
    // 检查输入是否为有效数字
    if (value && !/^\d*\.?\d*$/.test(value)) {
      if (previewController) {
        previewController.abort();
        setPreviewController(null);
      }
      setPreviewHealthFactor(null);
      setIsPreviewLoading(false);
      return;
    }

    // 检查是否为有效的数值
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) {
      if (previewController) {
        previewController.abort();
        setPreviewController(null);
      }
      setPreviewHealthFactor(null);
      setIsPreviewLoading(false);
      return;
    }

    // 查是否超过余额
    if (value) {
      const maxAmount = mode === 'supply' ? 
        (balance ? formatBalance(balance.formatted) : 0) : 
        formatBalance(userSupplied);
      
      if (numValue > maxAmount) {
        setAmount(maxAmount.toString());
        previewSupply(maxAmount.toString());
        return;
      }
    }
    
    if (!value || value === "0") {
      if (previewController) {
        previewController.abort();
        setPreviewController(null);
      }
      setPreviewHealthFactor(null);
      setIsPreviewLoading(false);
      return;
    }
    
    previewSupply(value);
  };

  const handleMaxClick = () => {
    const maxAmount = mode === 'supply' ? 
      (balance ? formatBalance(balance.formatted) : 0) : 
      formatBalance(userSupplied);
    
    setAmount(maxAmount.toString());
    previewSupply(maxAmount.toString());
  };

  // 修改实际交易函数
  const handleSupply = async () => {
    if (!currentAccount || !selectedAsset || !amount) return;

    try {
      setIsSubmitting(true);
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(amount) * 1e9));

      if (mode === 'supply') {
        // 原有的 supply 逻辑保持不变
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::supply_testsui`,
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              await preparePaymentCoin(`${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`, amountValue, tx),
              tx.pure.u64(amountValue),
            ],
          });
        } else {
          // ... 原有的其他代币 supply 逻辑保持不变 ...
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = selectedAsset.type.toLowerCase() > testSuiType.toLowerCase();

          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::supply_token_${comparison ? 'a' : 'b'}`,
            typeArguments: [selectedAsset.type],
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId), 
              tx.object(selectedAsset.cetusPoolId!),
              await preparePaymentCoin(selectedAsset.type, amountValue, tx),
              tx.pure.u64(amountValue),
            ],
          });
        }
      } else {
        // withdraw 逻辑
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::withdraw_testsui`,
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              tx.pure.u64(amountValue),
            ],
          });
        } else {
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = selectedAsset.type.toLowerCase() > testSuiType.toLowerCase();

          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::withdraw_token_${comparison ? 'a' : 'b'}`,
            typeArguments: [selectedAsset.type],
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              tx.object(selectedAsset.cetusPoolId!),
              tx.pure.u64(amountValue),
            ],
          });
        }
      }

      await signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            try {
              console.log(`${mode === 'supply' ? '存款' : '提款'}成功，交易哈希:`, result.digest);
              await suiClient.waitForTransaction({
                digest: result.digest,
              });
              await Promise.all([
                onTransactionSuccess(),
                refetchBalance()
              ]);
              setAmount("");
              setIsSubmitting(false);
              setPreviewHealthFactor(null);
              setIsPreviewLoading(false);
            } catch (error) {
              console.error('等待交易确认错误:', error);
              setIsSubmitting(false);
            }
          },
          onError: (error) => {
            console.error(`${mode === 'supply' ? '存款' : '提款'}交易错误:`, error);
            setIsSubmitting(false);
          },
        }
      );
    } catch (error) {
      console.error(`${mode === 'supply' ? '存款' : '提款'}函数错误:`, error);
      setIsSubmitting(false);
    }
  };

  const handleSupplyClick = () => {
    if (!currentAccount) {
      // 触发钱包连接按钮点击
      document.querySelector<HTMLButtonElement>('.wallet-button')?.click();
      return;
    }
    handleSupply();
  };

  // 清理 effect
  useEffect(() => {
    return () => {
      if (previewController) {
        previewController.abort();
      }
    };
  }, []);

  // 添加一个辅助函数来获取健康因子的颜色
  const getHealthFactorColor = (value: string) => {
    if (value === "∞") return "green";
    const num = parseFloat(value);
    if (num >= 2) return "green";
    if (num >= 1.1) return "orange";
    return "red";
  };

  // 添加一个函数来检查输入值是否有效
  const isValidAmount = (value: string) => {
    if (!value || value === "0") return false;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return false;
    if (!/^\d*\.?\d*$/.test(value)) return false;
    
    const maxAmount = mode === 'supply' ? 
      (balance ? parseFloat(balance.formatted) : 0) : 
      parseFloat(userSupplied);
    
    if (numValue > maxAmount) return false;
    return true;
  };

  // 添加一个辅助函数来格式化余额
  const formatBalance = (value: string) => {
    const num = parseFloat(value);
    return Math.floor(num * 100) / 100; // 向下取整到2位小数
  };

  // 修改切换到 withdraw 的函数
  const handleWithdrawClick = () => {
    setMode('withdraw');
    setAmount('');
    setPreviewHealthFactor(null);
    setIsPreviewLoading(false);
    if (previewController) {
      previewController.abort();
      setPreviewController(null);
    }
  };

  if (!currentAccount) {
    return (
      <Box className="panel-content" p="4">
        <Text size="5" weight="bold" mb="4">
          Supply {selectedAsset?.symbol || "Asset"}
        </Text>
        <Button 
          className="action-button submit-button" 
          size="3" 
          onClick={handleSupplyClick}
        >
          Connect Wallet
        </Button>
      </Box>
    );
  }

  if (isLoadingPosition) {
    return (
      <Box className="panel-content" p="4">
        <Flex justify="center" align="center" style={{ height: '200px' }}>
          <ClipLoader size={24} />
        </Flex>
      </Box>
    );
  }

  return (
    <Box className="panel-content" p="4">
      <Flex align="center" gap="2" mb="4">
        {mode === 'withdraw' && (
          <Button 
            variant="ghost" 
            size="1"
            onClick={() => {
              setMode('supply');
              setAmount('');
              setPreviewHealthFactor(null);
              setIsPreviewLoading(false);
              if (previewController) {
                previewController.abort();
                setPreviewController(null);
              }
            }}
            style={{ 
              padding: '4px',
              fontSize: '24px',
              lineHeight: '24px',
              height: '32px',
              cursor: 'pointer'
            }}
          >
            ←
          </Button>
        )}
        <Text size="5" weight="bold">
          {mode === 'supply' ? 'Supply' : 'Withdraw'} {selectedAsset?.symbol || "Asset"}
        </Text>
      </Flex>
      {mode === 'supply' && (
        <Flex justify="between" mb="4">
          <Text>Supply Balance: {userSupplied}</Text>
          <Button 
            variant="soft" 
            size="1" 
            className="action-button secondary"
            onClick={handleWithdrawClick}
          >
            Withdraw
          </Button>
        </Flex>
      )}
      <Box className="amount-input-container" mb="4">
        <Flex justify="between" mb="2">
          <Text>Amount</Text>
          <Text>Balance: {mode === 'supply' ? 
            (balance?.formatted || "0") : 
            userSupplied
          }</Text>
        </Flex>
        <Flex className="amount-input" align="center" gap="2">
          <input 
            type="text" 
            placeholder="0.00" 
            value={amount}
            onChange={handleAmountChange}
          />
          <Button variant="soft" size="1" onClick={handleMaxClick}>
            MAX
          </Button>
        </Flex>
      </Box>
      <Box className="transaction-overview">
        <Text size="3" weight="bold" mb="2">Transaction Overview</Text>
        <Flex justify="between" mb="2">
          <Text>Supply APY</Text>
          <Text>{selectedAsset?.supplyRate || "0%"}</Text>
        </Flex>
        <Flex justify="between" mb="2">
          <Text>Health Factor</Text>
          {isPreviewLoading ? (
            <ClipLoader size={12} />
          ) : (
            <Text>
              {healthFactor === "0" ? (
                <>
                  <span>-</span>
                  {previewHealthFactor && (
                    <>
                      {" → "}
                      <span style={{ color: getHealthFactorColor(previewHealthFactor), fontWeight: 'bold' }}>
                        {previewHealthFactor}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <>
                  <span style={{ color: getHealthFactorColor(healthFactor), fontWeight: 'bold' }}>
                    {healthFactor}
                  </span>
                  {previewHealthFactor && (
                    <>
                      {" → "}
                      <span style={{ color: getHealthFactorColor(previewHealthFactor), fontWeight: 'bold' }}>
                        {previewHealthFactor}
                      </span>
                    </>
                  )}
                </>
              )}
            </Text>
          )}
        </Flex>
        {mode === 'withdraw' && (
          <>
            {previewHealthFactor && !isHealthFactorSafe(previewHealthFactor) && (
              <Box mb="2" p="2" style={{ 
                backgroundColor: 'rgba(255, 0, 0, 0.1)', 
                border: '1px solid red',
                borderRadius: '4px',
                color: 'red'
              }}>
                <Text>Health factor below 1 is not safe</Text>
              </Box>
            )}
            {errorMessage && (
              <Box mb="2" p="2" style={{ 
                backgroundColor: 'rgba(255, 0, 0, 0.1)', 
                border: '1px solid red',
                borderRadius: '4px',
                color: 'red'
              }}>
                <Text>{errorMessage}</Text>
              </Box>
            )}
          </>
        )}
      </Box>
      <Button 
        className="action-button submit-button" 
        size="3" 
        disabled={Boolean(
          !amount || 
          !selectedAsset || 
          isSubmitting || 
          isPreviewLoading || 
          !isValidAmount(amount) ||
          errorMessage ||
          (mode === 'withdraw' && previewHealthFactor && !isHealthFactorSafe(previewHealthFactor))
        )}
        onClick={handleSupplyClick}
      >
        {isSubmitting || isPreviewLoading ? (
          <Flex align="center" gap="2">
            <ClipLoader size={16} color="white" />
            <Text>{isSubmitting ? "Processing..." : "Calculating..."}</Text>
          </Flex>
        ) : !selectedAsset ? (
          "Select an Asset"
        ) : !amount ? (
          "Enter An Amount"
        ) : (
          mode === 'supply' ? "Supply" : "Withdraw"
        )}
      </Button>
    </Box>
  );
} 