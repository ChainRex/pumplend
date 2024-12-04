import { Box, Button, Container, Flex, IconButton, Select, Text, Progress } from "@radix-ui/themes";
import { ArrowDownIcon } from "@radix-ui/react-icons";
import { useState, useRef, useEffect } from "react";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { PUMPSUI_CORE_PACKAGE_ID, TESTSUI_ICON_URL, TESTSUI_PACKAGE_ID ,
  CETUS_GLOBAL_CONFIG_ID, CETUS_POOLS_ID, CLOCK_ID, TESTSUI_METADATA_ID} from "./config";
import { useTokenList, Token } from "./hooks/useTokenList";
import ClipLoader from "react-spinners/ClipLoader";
import { useTokenBalance } from "./hooks/useTokenBalance";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';
import { asUintN, TickMath } from '@cetusprotocol/cetus-sui-clmm-sdk';
import Decimal from 'decimal.js';

// 添加错误码常量
const ERROR_CODES = {
  1001: "Insufficient SUI balance",
  1002: "Insufficient token supply - Max supply reached",
  1003: "Insufficient token balance",
  1004: "Insufficient pool balance"
} as const;

// 解析 Move 错误的辅助函数
const parseMoveError = (error: string) => {
  // 匹配错误码
  const match = error.match(/MoveAbort\(.*?, (\d+)\)/);
  if (match) {
    const errorCode = parseInt(match[1]);
    return ERROR_CODES[errorCode as keyof typeof ERROR_CODES] || "Unknown error";
  }
  return null;
};

interface TokenStatusEvent {
  parsedJson: {
    total_supply: string;
    collected_sui: string;
    status: {
      variant: string;
      fields: Record<string, unknown>;
    };
  };
  type: string;
}

// 添加一个新的 hook 来获取单个代币的状态
const useTokenStatus = (tokenType: string | undefined) => {
  return useQuery({
    queryKey: ["tokenStatus", tokenType],
    queryFn: async () => {
      if (!tokenType) return null;
      const response = await fetch(`http://localhost:3000/api/tokens/${tokenType}/status`);
      if (!response.ok) throw new Error("Failed to fetch token status");
      return response.json();
    },
    enabled: !!tokenType,
  });
};

// 添加一个新的提示组件
const CompletionNotice = () => (
  <Box className="completion-notice">
    <Flex direction="column" gap="1" align="center">
      <Text size="2" weight="bold">
        Funding Complete! 🎉
      </Text>
      <Text size="2" color="gray" align="center">
        Trading will be automatically executed through CETUS
      </Text>
    </Flex>
  </Box>
);

// 修改 FundingProgress 组件
const FundingProgress = ({ 
  token, 
  willCreatePool,
  previewCollectedSui
}: { 
  token: Token | null, 
  willCreatePool: boolean,
  previewCollectedSui?: string 
}) => {
  if (!token || token.symbol === "TESTSUI") {
    return null;
  }

  const { data: latestStatus } = useTokenStatus(token.type);
  const collectedSui = latestStatus?.collectedSui || token.collectedSui;
  const status = latestStatus?.status || token.status;

  // 如果状态是 LIQUIDITY_POOL_CREATED，返回 null（不显示进度条）
  if (status === "LIQUIDITY_POOL_CREATED") {
    return null;
  }

  // 如果状态已经是 LIQUIDITY_POOL_PENDING 或者即将创建流动性池
  if (status === "LIQUIDITY_POOL_PENDING" || willCreatePool) {
    return (
      <Box className="funding-progress">
        <Flex direction="column" gap="3">
          <Box className="liquidity-pool-notice">
            <Text size="2" weight="bold">
              {willCreatePool ? "This trade will complete funding! 🎉" : "Funding Complete! 🎉"}
            </Text>
            <Text size="2" color="gray">
              {willCreatePool 
                ? "Liquidity pool will be created automatically after the trade"
                : "Help create CETUS liquidity pool to enable trading"
              }
            </Text>
          </Box>
          <Progress className="animated-progress" value={100} />
        </Flex>
      </Box>
    );
  }

  // 正常的进度条显示逻辑
  if (status !== "FUNDING") return null;

  // 计算当前进度和预览进度
  const currentCollectedSui = BigInt(collectedSui?.toString() || "0");
  const previewAmount = previewCollectedSui ? BigInt(previewCollectedSui) : currentCollectedSui;
  const progress = Number((previewAmount * BigInt(100)) / BigInt("20000000000000"));

  // 格式化显示金额的函数
  const formatAmount = (amount: bigint) => {
    const num = Number(amount) / 1e9;
    return num < 0.00001 ? "0" : num.toFixed(2);
  };

  // 计算变化量
  const getChangeText = () => {
    if (!previewCollectedSui) return "";
    const change = previewAmount - currentCollectedSui;
    if (change === BigInt(0)) return "";
    
    const changeNum = Number(change) / 1e9;
    if (Math.abs(changeNum) < 0.00001) return "";
    
    return change > 0 
      ? ` (+${changeNum.toFixed(2)})` 
      : ` (${changeNum.toFixed(2)})`;
  };

  return (
    <Box className="funding-progress">
      <Flex direction="column" gap="2">
        <Flex justify="between">
          <Text size="2" color="gray">Funding Progress</Text>
          <Text size="2" color="gray">
            {progress.toFixed(0)}% ({formatAmount(previewAmount)}
            {getChangeText()} / 20,000 TESTSUI)
          </Text>
        </Flex>
        <Progress className="animated-progress" value={progress} />
      </Flex>
    </Box>
  );
};

// 添加一个辅助函数来比较代币类型
const compareCoinTypes = (typeA: string, typeB: string): number => {
  // 确保完整的代币类型字符串
  const fullTypeA = typeA.toLowerCase();
  const fullTypeB = typeB.toLowerCase();
  
  // 字符串比较
  if (fullTypeA > fullTypeB) return 1;
  if (fullTypeA < fullTypeB) return -1;
  return 0;
};

export function Trade() {
  const [fromAmount, setFromAmount] = useState("");
  const [toAmount, setToAmount] = useState("");
  const [selectedToken, setSelectedToken] = useState<Token | null>(null);
  const currentAccount = useCurrentAccount();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const { data: tokens, isLoading: isLoadingTokens, updateTokenStatus } = useTokenList();
  const [isTestSuiOnRight, setIsTestSuiOnRight] = useState(false);
  const suiClient = useSuiClient();
  const queryClient = useQueryClient();
  const { toasts, showToast, hideToast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [willCreatePool, setWillCreatePool] = useState(false);
  const [previewCollectedSui, setPreviewCollectedSui] = useState<string>();

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
    // 清空输入值
    setFromAmount("");
    setToAmount("");
    // 重置进度条预览状态
    setPreviewCollectedSui(undefined);
    setWillCreatePool(false);
  };

  // 处理代币支付的辅助函数
  const preparePaymentCoin = async (
    coinType: string,
    amount: bigint,
    tx: Transaction
  ) => {
    if (!currentAccount) {
      throw new Error("Please connect your wallet");
    }

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
        // 金大于所需，需要分割
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
      throw new Error("Please complete all trading information");
    }

    try {
      setIsLoading(true);
      const tx = new Transaction();
      
      const [integerPart, decimalPart = ''] = fromAmount.split('.');
      const paddedDecimal = (decimalPart + '0'.repeat(9)).slice(0, 9);
      const amountStr = integerPart + paddedDecimal;
      const amount = BigInt(amountStr);
      
      if (!isTestSuiOnRight) { // TESTSUI 在左边，买入其他代币
        const treasuryCapHolderId = selectedToken.treasuryCapHolderId;
        const collateralId = selectedToken.collateralId;
        
        if (!treasuryCapHolderId || !collateralId) {
          throw new Error("Incomplete token information");
        }

        // 准备 TESTSUI 支付
        const paymentCoin = await preparePaymentCoin(
          `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`,
          amount,
          tx
        );

        // 执行买入
        tx.moveCall({
          target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::buy`,
          typeArguments: [selectedToken.type],
          arguments: [
            tx.object(collateralId),
            tx.object(treasuryCapHolderId),
            paymentCoin,
          ],
        });

        // 如果这笔交易会触发创建流动性池，添加创建池子的调用
        if (willCreatePool) {
          // 获取完整的 TESTSUI 代币类型
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = compareCoinTypes(selectedToken.type, testSuiType);
          const isTokenCoinA = comparison > 0;

          // 添加创建流动性池的调用
          tx.moveCall({
            target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::${
              isTokenCoinA ? 'create_cetus_pool_t_sui' : 'create_cetus_pool_sui_t'
            }`,
            typeArguments: [selectedToken.type],
            arguments: [
              tx.object(collateralId),
              tx.object(treasuryCapHolderId),
              tx.object(CETUS_GLOBAL_CONFIG_ID),
              tx.object(CETUS_POOLS_ID),
              tx.object(selectedToken.metadataId!),
              tx.object(TESTSUI_METADATA_ID),
              tx.object(CLOCK_ID),
            ],
          });
        }
      } else { // TESTSUI 在边，卖出其他代币
        const treasuryCapHolderId = selectedToken.treasuryCapHolderId;
        const collateralId = selectedToken.collateralId;
        
        if (!treasuryCapHolderId || !collateralId) {
          throw new Error("Incomplete token information");
        }

        // 准备代币支付
        const paymentCoin = await preparePaymentCoin(
          selectedToken.type,
          amount,
          tx
        );

        // 执行卖
        tx.moveCall({
          target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::sell`,
          typeArguments: [selectedToken.type],
          arguments: [
            tx.object(collateralId),
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
            
            // 等交易完成
            await suiClient.waitForTransaction({
              digest: result.digest,
            });

            // 获取事件
            const events = await suiClient.queryEvents({
              query: { 
                MoveEventType: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::TokenStatusEvent<${selectedToken.type}>`
              }
            });
            
            // 查找 TokenStatusEvent
            const statusEvent = events.data.find(
              event => event.type.includes('::TokenStatusEvent<')
            ) as TokenStatusEvent | undefined;

            if (statusEvent && statusEvent.parsedJson) {
              try {
                const newTotalSupply = statusEvent.parsedJson.total_supply;
                const newCollectedSui = statusEvent.parsedJson.collected_sui;
                const newStatus = statusEvent.parsedJson.status.variant;

                console.log('New token status:', {
                  type: selectedToken.type,
                  totalSupply: newTotalSupply,
                  collectedSui: newCollectedSui,
                  status: newStatus
                });

                // 更新数据库
                await fetch(`http://localhost:3000/api/tokens/${selectedToken.type}/status`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    totalSupply: newTotalSupply,
                    collectedSui: newCollectedSui,
                    status: newStatus
                  })
                });

                // 强制刷新进度条的数据
                queryClient.invalidateQueries({
                  queryKey: ["tokenStatus", selectedToken.type],
                });

                // 立即更新本地状态
                updateTokenStatus(
                  selectedToken.type,
                  newTotalSupply,
                  newCollectedSui,
                  newStatus
                );

                // 强制��新渲染
                queryClient.invalidateQueries({
                  queryKey: ["tokenBalance"],
                });

              } catch (error) {
                console.error('Failed to update token status:', error);
              }
            }

            // 刷新余额
            await Promise.all([
              queryClient.invalidateQueries({
                queryKey: ["tokenBalance", currentAccount.address, `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`],
              }),
              selectedToken.type && queryClient.invalidateQueries({
                queryKey: ["tokenBalance", currentAccount.address, selectedToken.type],
              }),
            ]);

            // 显示成功信息
            showToast(
              isTestSuiOnRight 
                ? `Successfully sold ${fromAmount} ${selectedToken?.symbol}`
                : `Successfully used ${fromAmount} TESTSUI to buy ${selectedToken?.symbol}`,
              'success',
              result.digest
            );

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
    } catch (error: any) {
      // 检查是否 Move 错误
      const moveError = parseMoveError(error.message);
      if (moveError) {
        showToast(moveError, 'error');
      } else if (error instanceof Error) {
        showToast(error.message, 'error');
      } else {
        showToast('Transaction failed', 'error');
      }
      setIsLoading(false);
    }
  };

  // 修改 handleMaxClick 函数
  const handleMaxClick = () => {
    if (!currentAccount) return;

    const balance = !isTestSuiOnRight ? testSuiBalance?.raw : selectedTokenBalance?.raw;
    if (balance) {
      // 使用字符串操作来保持精度
      const balanceStr = balance.toString();
      const length = balanceStr.length;
      
      let newAmount: string;
      if (length <= 9) {
        // 如果长度小于9，需要在小数点后补零
        const decimals = '0'.repeat(9 - length);
        newAmount = `0.${decimals}${balanceStr}`;
      } else {
        // 如果长度大于9，在适当位置插入小数点
        const integerPart = balanceStr.slice(0, length - 9);
        const decimalPart = balanceStr.slice(length - 9);
        newAmount = `${integerPart}.${decimalPart}`;
      }
      
      setFromAmount(newAmount);
      // 调用预览交易函数
      previewTrade(newAmount);
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

  // 获取当前代币状态
  const { data: latestStatus } = useTokenStatus(selectedToken?.type);
  const status = latestStatus?.status || selectedToken?.status;

  // 修改 getSwapButtonText 函数
  const getSwapButtonText = () => {
    if (!currentAccount) {
      return "Connect Wallet";
    }
    
    if (isLoading || isPreviewLoading) {
      return <ClipLoader size={20} color="white" />;
    }
    
    return "Swap";
  };

  // 修改 handleFromAmountChange 函数
  const handleFromAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // 如果状态是 LIQUIDITY_POOL_PENDING 且用户尝试卖出，则禁止输入
    if (status === "LIQUIDITY_POOL_PENDING" && !isTestSuiOnRight) {
      return;
    }

    const newAmount = e.target.value;
    setFromAmount(newAmount);
    
    if (!newAmount) {
      setToAmount("");
      setWillCreatePool(false); // 清空输入时，重置创建流动性池的状态
      setPreviewCollectedSui(undefined);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      setIsPreviewLoading(false);
      return;
    }
    
    previewTrade(newAmount);
  };

  // 修改 handleSwapButtonClick 函数
  const handleSwapButtonClick = () => {
    if (!currentAccount) {
      document.querySelector<HTMLButtonElement>('.wallet-button')?.click();
      return;
    }

    handleTrade();
  };

  // 修改 isSwapButtonDisabled 函数
  const isSwapButtonDisabled = () => {
    if (!currentAccount) {
      return !(fromAmount && selectedToken);
    }

    if (status === "LIQUIDITY_POOL_PENDING") {
      return false; // 允许点击创建流动性池按钮
    }

    return !selectedToken || !fromAmount || isLoading || isPreviewLoading || !toAmount;
  };

  // 修改 previewTrade 函数
  const previewTrade = async (amount: string) => {
    if (!currentAccount || !selectedToken || !amount) {
      setToAmount("");
      setWillCreatePool(false);
      setPreviewCollectedSui(undefined);
      return;
    }

    // 检查输入值是否为 0
    const numericAmount = Number(amount);
    if (numericAmount === 0) {
      setToAmount("");
      setWillCreatePool(false);
      setPreviewCollectedSui(undefined);
      return;
    }

    // 如果存在上一次的请求，取消它
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    // 创建新的 AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // 开始预览计算时设置加载状态
    setIsPreviewLoading(true);

    try {
      // 检查是否已被取消
      if (abortController.signal.aborted) {
        return;
      }

      const tx = new Transaction();
      
      // 计算输入额
      const [integerPart, decimalPart = ''] = amount.split('.');
      const paddedDecimal = (decimalPart + '0'.repeat(9)).slice(0, 9);
      const amountStr = integerPart + paddedDecimal;
      const amountBigInt = BigInt(amountStr);

      // 如果转换后的 BigInt 为 0，直接返回
      if (amountBigInt === BigInt(0)) {
        setToAmount("");
        setWillCreatePool(false);
        setPreviewCollectedSui(undefined);
        return;
      }

      if (!isTestSuiOnRight) { // TESTSUI 在左边，买入其他代币
        const treasuryCapHolderId = selectedToken.treasuryCapHolderId;
        const collateralId = selectedToken.collateralId;
        
        if (!treasuryCapHolderId || !collateralId) {
          showToast('Incomplete token information', 'error');
          setToAmount("");
          return;
        }

        // 模拟 TESTSUI 支付
        const paymentCoin = await preparePaymentCoin(
          `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`,
          amountBigInt,
          tx
        );

        // 执行购买
        tx.moveCall({
          target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::buy`,
          typeArguments: [selectedToken.type],
          arguments: [
            tx.object(collateralId),
            tx.object(treasuryCapHolderId),
            paymentCoin,
          ],
        });

      } else { // TESTSUI 在右边，卖出其他代币
        const treasuryCapHolderId = selectedToken.treasuryCapHolderId;
        const collateralId = selectedToken.collateralId;
        
        if (!treasuryCapHolderId || !collateralId) {
          showToast('Incomplete token information', 'error');
          setToAmount("");
          return;
        }

        // 模拟代币支付
        const paymentCoin = await preparePaymentCoin(
          selectedToken.type,
          amountBigInt,
          tx
        );

        // 执行卖出
        tx.moveCall({
          target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::sell`,
          typeArguments: [selectedToken.type],
          arguments: [
            tx.object(collateralId),
            tx.object(treasuryCapHolderId),
            paymentCoin,
          ],
        });
      }

      tx.setSender(currentAccount.address);
      // 执行模拟交易
      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
      });

      // 再次检查是否已被取消
      if (abortController.signal.aborted) {
        return;
      }

      // 分析余额变化
      if (dryRunResult.balanceChanges) {
        const buyChange = dryRunResult.balanceChanges.find(change => 
          isTestSuiOnRight 
            ? change.coinType === `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`
            : change.coinType === selectedToken.type
        );
        const sellChange = dryRunResult.balanceChanges.find(change => 
          isTestSuiOnRight 
            ? change.coinType === selectedToken.type
            : change.coinType === `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`
        );

        if (buyChange && sellChange) {
          // 转换余额变化为可读格式
          const buyChangeAmount = BigInt(buyChange.amount);
          const sellChangeAmount = BigInt(sellChange.amount);
          const absBuyChange = buyChangeAmount < 0 ? -buyChangeAmount : buyChangeAmount;
          const absSellChange = sellChangeAmount < 0 ? -sellChangeAmount : sellChangeAmount;
          
          // 转换为带小数点的字符串
          const buyChangeStr = absBuyChange.toString().padStart(10, '0');
          const buyIntegerPart = buyChangeStr.slice(0, -9) || '0';
          const buyDecimalPart = buyChangeStr.slice(-9);
          const calculatedBuyAmount = `${buyIntegerPart}.${buyDecimalPart}`;
          
          const sellChangeStr = absSellChange.toString().padStart(10, '0');
          const sellIntegerPart = sellChangeStr.slice(0, -9) || '0';
          const sellDecimalPart = sellChangeStr.slice(-9);
          const calculatedSellAmount = `${sellIntegerPart}.${sellDecimalPart}`;

          if (!isTestSuiOnRight && Number(calculatedSellAmount) < Number(amount)) {
            // 更新输入框的值为实际可卖出的数量
            setFromAmount(calculatedSellAmount);
            // 显示提示
            showToast(
              `Maximum amount that can be sold is ${calculatedSellAmount} ${selectedToken.symbol} due to funding limit`,
              'info'
            );
          }
          
          setToAmount(calculatedBuyAmount);

          // 更新预览的 collectedSui
          if (!isTestSuiOnRight) {
            // 买入 Token 的情况
            const currentCollectedSui = BigInt(latestStatus?.collectedSui || "0");
            const sellAmountBigInt = BigInt(sellChangeStr); // 使用原始的 sellChangeStr
            const newCollectedSui = currentCollectedSui + sellAmountBigInt;
            setPreviewCollectedSui(newCollectedSui.toString());
          } else {
            // 卖出 Token 的情况
            const currentCollectedSui = BigInt(latestStatus?.collectedSui || "0");
            const buyAmountBigInt = BigInt(buyChangeStr); // 使用原始的 buyChangeStr
            const newCollectedSui = currentCollectedSui - buyAmountBigInt;
            setPreviewCollectedSui(newCollectedSui.toString());
          }
        } else {
          setToAmount("");
          setPreviewCollectedSui(undefined); // 清除预览值
        }
      }

      // 检查是否会触发创建流动性池
      const events = dryRunResult.events || [];
      const statusEvent = events.find(
        event => event.type.includes('::TokenStatusEvent<')
      ) as TokenStatusEvent | undefined;

      // 检查事件中的状态是否会变为 LIQUIDITY_POOL_PENDING
      const willTriggerPoolCreation = statusEvent?.parsedJson?.status?.variant === "LIQUIDITY_POOL_PENDING";
      setWillCreatePool(willTriggerPoolCreation);

    } catch (error: any) {
      if (error.name === 'AbortError') {
        return;
      }

      setWillCreatePool(false); // 发生错误时，重置创建流动性池的状态
      const moveError = parseMoveError(error.message);
      if (moveError) {
        setToAmount("");
        showToast(moveError, 'error');
      } else {
        console.error('Preview error:', error);
        setToAmount("");
        showToast(error.message || 'Preview failed', 'error');
      }
    } finally {
      // 只有当这个 controller 仍然是当前的 controller 时才清除加载状态
      if (abortControllerRef.current === abortController) {
        setIsPreviewLoading(false);
        abortControllerRef.current = null;
      }
    }
  };

  // 在卸载时清理
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  // 添加对钱包连接状态的监听
  useEffect(() => {
    // 钱包连接且有输入金额和选择的代币时，触发预览
    if (currentAccount && fromAmount && selectedToken) {
      previewTrade(fromAmount);
    }
  }, [currentAccount]); // 只监听 currentAccount 的变化

  return (
    <Container size="1">
      <Flex direction="column" gap="4">
        <Flex justify="between" align="center">
          <Text size="5" weight="bold">Swap</Text>
          <Button variant="ghost" size="2">
            <Text size="2">Settings</Text>
          </Button>
        </Flex>

        {/* 如果募资完成且流动性池已创建，显示完成提示 */}
        {status === "LIQUIDITY_POOL_CREATED" && <CompletionNotice />}

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
                  onChange={handleFromAmountChange}
                  disabled={status === "LIQUIDITY_POOL_PENDING" && !isTestSuiOnRight}
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
                readOnly
                style={{ cursor: 'default' }}
              />
              {isTestSuiOnRight ? <TestSuiToken /> : <OtherTokenSelect />}
            </Flex>
            <Text size="2" color="gray">$0.00</Text>
          </Flex>
        </Box>

        <FundingProgress 
          token={selectedToken} 
          willCreatePool={willCreatePool}
          previewCollectedSui={previewCollectedSui}
        />

        <Button 
          size="3" 
          className="swap-button"
          onClick={handleSwapButtonClick}
          disabled={isSwapButtonDisabled()}
        >
          {getSwapButtonText()}
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