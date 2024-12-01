import { Box, Button, Container, Flex, IconButton, Select, Text } from "@radix-ui/themes";
import { ArrowDownIcon } from "@radix-ui/react-icons";
import { useState } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PUMPSUI_CORE_PACKAGE_ID, TESTSUI_ICON_URL, TESTSUI_PACKAGE_ID } from "./config";
import { useTokenList, Token } from "./hooks/useTokenList";
import ClipLoader from "react-spinners/ClipLoader";
import { useTokenBalance } from "./hooks/useTokenBalance";
import { useQueryClient } from "@tanstack/react-query";
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

export function Trade() {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { data: tokens, isLoading: isLoadingTokens } = useTokenList();
  const [isTestSuiOnRight, setIsTestSuiOnRight] = useState(false);
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { toasts, showToast, hideToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  // 获取 TESTSUI 余额
  const { data: testSuiBalance } = useTokenBalance(
    currentAccount?.address,
    `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`
  );

  // 获取选定代币余额
  const { data: selectedTokenBalance } = useTokenBalance(
    currentAccount?.address,
    selectedToken?.type
  );

  // 获取当前代币余额
  const getTokenBalance = (isTestSui: boolean) => {
    if (!currentAccount) return null;
    
    if (isTestSui) {
      return testSuiBalance?.formatted;
    } else if (selectedToken) {
      return selectedTokenBalance?.formatted;
    }
    return null;
  };

  const handleSwap = () => {
    setIsTestSuiOnRight(!isTestSuiOnRight);
    const tempAmount = fromAmount;
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  // 处理代币支付的辅助函数
  const preparePaymentCoin = async (
    coinType: string,
    amount: bigint,
    tx: Transaction
  ) => {
    if (!currentAccount) throw new Error("Please connect your wallet");

    // 1. 获取用户的所有代币
    const coins = await suiClient.getCoins({
      owner: currentAccount.address,
      coinType,
    });

    if (coins.data.length === 0) {
      throw new Error("Insufficient token balance");
    }

    // 2. 计算总余额
    const totalBalance = coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    );

    if (totalBalance < amount) {
      throw new Error("Insufficient balance");
    }

    // 3. 如果只有一个代币对象且金额足够
    if (coins.data.length === 1 && BigInt(coins.data[0].balance) >= amount) {
      const coin = coins.data[0];
      if (BigInt(coin.balance) === amount) {
        // 金额刚好相等，直接使用
        return tx.object(coin.coinObjectId);
      } else {
        // 金额大于所需，需要分割
        const [splitCoin] = tx.splitCoins(tx.object(coin.coinObjectId), [
          tx.pure.u64(amount)
        ]);
        return splitCoin;
      }
    }

    // 4. 需要合并多个代币
    // 先合并所有代币到第一个代币
    let primaryCoin = tx.object(coins.data[0].coinObjectId);
    if (coins.data.length > 1) {
      tx.mergeCoins(
        primaryCoin,
        coins.data.slice(1).map(coin => tx.object(coin.coinObjectId))
      );
    }

    // 5. 分割出所需金额
    const [splitCoin] = tx.splitCoins(primaryCoin, [
      tx.pure.u64(amount)
    ]);
    
    return splitCoin;
  };

  const handleTrade = async () => {
    if (!currentAccount || !selectedToken || !fromAmount) {
      showToast('Please complete all trading information', 'error');
      return;
    }

    try {
      setIsLoading(true);
      const tx = new Transaction();
      
      // 新的计算方式
      const [integerPart, decimalPart = ''] = fromAmount.split('.');
      const paddedDecimal = (decimalPart + '0'.repeat(9)).slice(0, 9);
      const amountStr = integerPart + paddedDecimal;
      const amount = BigInt(amountStr);
      
      console.log('fromAmount:', fromAmount);
      console.log('Amount:', amount.toString());
      
      if (!isTestSuiOnRight) { // TESTSUI 在左边，买入其他代币
        const treasuryCapHolderId = selectedToken.treasuryCapHolderId;
        const poolId = selectedToken.poolId;
        
        if (!treasuryCapHolderId || !poolId) {
          showToast('Incomplete token information', 'error');
          return;
        }

        // 准备 TESTSUI 支付
        const paymentCoin = await preparePaymentCoin(
          `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`,
          amount,
          tx
        );
        console.log("paymentCoin", paymentCoin);
        // 执行购买
        tx.moveCall({
          target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::buy`,
          typeArguments: [selectedToken.type],
          arguments: [
            tx.object(poolId),
            tx.object(treasuryCapHolderId),
            paymentCoin,
          ],
        });

      } else { // TESTSUI 在右边，卖出其他代币
        const treasuryCapHolderId = selectedToken.treasuryCapHolderId;
        const poolId = selectedToken.poolId;
        
        if (!treasuryCapHolderId || !poolId) {
          showToast('Incomplete token information', 'error');
          return;
        }

        // 准备代币支付
        const paymentCoin = await preparePaymentCoin(
          selectedToken.type,
          amount,
          tx
        );

        // 执行卖出
        tx.moveCall({
          target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::sell`,
          typeArguments: [selectedToken.type],
          arguments: [
            tx.object(poolId),
            tx.object(treasuryCapHolderId),
            paymentCoin,
          ],
        });
      }

      await signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            showToast('Transaction submitted', 'info');
            
            await suiClient.waitForTransaction({
              digest: result.digest,
            });

            // 显示成功信息，包含交易哈希
            showToast(
              isTestSuiOnRight 
                ? `Successfully sold ${fromAmount} ${selectedToken?.symbol}`
                : `Successfully used ${fromAmount} TESTSUI to buy ${selectedToken?.symbol}`,
              'success',
              result.digest
            );

            // 刷新余额数据
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["tokenBalance", currentAccount.address, `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`],
              }),
              selectedToken.type && queryClient.invalidateQueries({
                queryKey: ["tokenBalance", currentAccount.address, selectedToken.type],
              }),
            ]);

            // 清空输入
            setFromAmount("");
            setToAmount("");
            setIsLoading(false);
          },
          onError: (error) => {
            showToast(error.message || 'Transaction failed', 'error');
            setIsLoading(false);
          },
        }
      );
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, 'error');
      } else {
        showToast('Transaction failed', 'error');
      }
      setIsLoading(false);
    }
  };

  // 处理 Max 按钮点击
  const handleMaxClick = () => {
    if (!currentAccount) return;

    const balance = !isTestSuiOnRight ? testSuiBalance?.raw : selectedTokenBalance?.raw;
    if (balance) {
      // 使用字符串操作来保持精度
      const balanceStr = balance.toString();
      const length = balanceStr.length;
      
      if (length <= 9) {
        // 如果长度小于9，需要在小数点后补零
        const decimals = '0'.repeat(9 - length);
        setFromAmount(`0.${decimals}${balanceStr}`);
      } else {
        // 如果长度大于9，在适当位置插入小数点
        const integerPart = balanceStr.slice(0, length - 9);
        const decimalPart = balanceStr.slice(length - 9);
        setFromAmount(`${integerPart}.${decimalPart}`);
      }
    }
  };

  // 固定的 TESTSUI 代币显示组件
  const TestSuiToken = () => (
    <Flex align="center" gap="2" className="token-select">
      <img src={TESTSUI_ICON_URL} alt="" className="token-icon" />
      <span>TESTSUI</span>
    </Flex>
  );

  // 其他代币选择组件
  const OtherTokenSelect = () => (
    <Select.Root 
      value={selectedToken?.symbol}
      onValueChange={(value) => {
        const token = tokens?.find(t => t.symbol === value);
        setSelectedToken(token || null);
      }}
    >
      <Select.Trigger className="token-select">
        {isLoadingTokens ? (
          <ClipLoader size={16} />
        ) : (
          <Flex align="center" gap="2">
            {selectedToken?.icon ? (
              <>
                <img src={selectedToken.icon} alt="" className="token-icon" />
                <span>{selectedToken.symbol}</span>
              </>
            ) : (
              <span>Select token</span>
            )}
          </Flex>
        )}
      </Select.Trigger>
      <Select.Content>
        {tokens?.filter(t => t.symbol !== "TESTSUI").map((token) => (
          <Select.Item key={token.symbol} value={token.symbol}>
            <Flex align="center" gap="2">
              <img src={token.icon} alt="" className="token-icon" />
              <span>{token.symbol}</span>
            </Flex>
          </Select.Item>
        ))}
      </Select.Content>
    </Select.Root>
  );

  return (
    <Container size="1">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Text size="5" weight="bold">Swap</Text>
          <Button variant="ghost" size="2">
            <Text size="2">Settings</Text>
          </Button>
        </Flex>

        {/* 第一个代币部分 */}
        <Box className="swap-box">
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center">
              <Text size="2" color="gray">Sell</Text>
              {currentAccount && (
                <Text size="2" color="gray">
                  Balance: {getTokenBalance(!isTestSuiOnRight) || "0"}
                </Text>
              )}
            </Flex>
            <Flex gap="2" align="center">
              <Flex gap="2" align="center">
                <input 
                  className="text-field"
                  placeholder="0"
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                />
                {currentAccount && (
                  <Button 
                    size="1" 
                    variant="ghost" 
                    onClick={handleMaxClick}
                    className="max-button"
                  >
                    MAX
                  </Button>
                )}
              </Flex>
              <Box style={{ width: '10px' }} />
              {isTestSuiOnRight ? <OtherTokenSelect /> : <TestSuiToken />}
            </Flex>
            <Text size="2" color="gray">$0.00</Text>
          </Flex>
        </Box>

        {/* 交换按钮 */}
        <Flex justify="center" my="-2">
          <IconButton 
            className="arrow-button"
            size="2" 
            variant="ghost" 
            onClick={handleSwap}
          >
            <ArrowDownIcon width="20" height="20" />
          </IconButton>
        </Flex>

        {/* 第二个代币部分 */}
        <Box className="swap-box">
          <Flex direction="column" gap="2">
            <Flex justify="between" align="center">
              <Text size="2" color="gray">Buy</Text>
              {currentAccount && (
                <Text size="2" color="gray">
                  Balance: {getTokenBalance(isTestSuiOnRight) || "0"}
                </Text>
              )}
            </Flex>
            <Flex gap="2" align="center">
              <input 
                className="text-field"
                placeholder="0"
                value={toAmount}
                onChange={(e) => setToAmount(e.target.value)}
              />
              {isTestSuiOnRight ? <TestSuiToken /> : <OtherTokenSelect />}
            </Flex>
            <Text size="2" color="gray">$0.00</Text>
          </Flex>
        </Box>

        <Button 
          size="3" 
          className="swap-button"
          onClick={handleTrade}
          disabled={!currentAccount || !selectedToken || !fromAmount || isLoading}
        >
          {!currentAccount 
            ? "Connect Wallet" 
            : isLoading 
              ? <ClipLoader size={20} color="white" /> 
              : "Swap"
          }
        </Button>
      </Flex>
      
      {/* 渲染 Toasts */}
      {toasts.map(toast => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => hideToast(toast.id)}
          txHash={toast.txHash}
          duration={toast.type === 'success' ? 6000 : 3000}
        />
      ))}
    </Container>
  );
} 