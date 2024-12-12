import { Box, Flex, Text, Button } from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { LendingPoolData } from "../../hooks/useLendingData";
import { useTokenBalance } from "../../hooks/useTokenBalance";
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { ClipLoader } from "react-spinners";
import { Transaction } from "@mysten/sui/transactions";
import { CLOCK_ID, LENDING_STORAGE_ID, PUMPLEND_CORE_PACKAGE_ID, TESTSUI_PACKAGE_ID } from "../../config";

interface BorrowPanelProps {
  selectedAsset?: LendingPoolData;
  userBorrowed?: string;
  isLoadingPosition: boolean;
  onTransactionSuccess: () => Promise<void>;
  healthFactor?: string;
  defaultMode?: 'borrow' | 'repay';
  maxBorrowValue?: string;
}

export function BorrowPanel({ 
  selectedAsset, 
  userBorrowed = "0",
  isLoadingPosition,
  onTransactionSuccess,
  healthFactor = "0",
  defaultMode = 'borrow',
  maxBorrowValue = "0",
}: BorrowPanelProps) {
  const [mode, setMode] = useState<'borrow' | 'repay'>(defaultMode);
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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastBorrowedAmount, setLastBorrowedAmount] = useState<string>("0");

  const previewBorrow = async (value: string) => {
    if (!currentAccount || !selectedAsset || !value) {
      setPreviewHealthFactor(null);
      return;
    }

    try {
      setIsPreviewLoading(true);
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(value) * 1e9));

      if (mode === 'borrow') {
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::borrow_testsui`,
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
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::borrow_token_${comparison ? 'a' : 'b'}`,
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
      } else {
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::repay_testsui`,
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              await preparePaymentCoin(`${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`, amountValue, tx),
              tx.pure.u64(amountValue),
            ],
          });
        } else {
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = selectedAsset.type.toLowerCase() > testSuiType.toLowerCase();

          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::repay_token_${comparison ? 'a' : 'b'}`,
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
      }

      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::calculate_health_factor`,
        arguments: [
          tx.object(LENDING_STORAGE_ID),
          tx.pure.address(currentAccount.address)
        ],
      });

      tx.setSender(currentAccount.address);

      const dryRunResult = await suiClient.dryRunTransactionBlock({
        transactionBlock: await tx.build({ client: suiClient }),
      });

      const healthFactorEvent = dryRunResult.events?.find(
        event => event.type.includes('::CalculateHealthFactorEvent')
      );

      if (healthFactorEvent?.parsedJson) {
        const eventData = healthFactorEvent.parsedJson as { health_factor: string };
        const healthFactorNum = Number(eventData.health_factor) / 100;
        const healthFactorValue = healthFactorNum > 1000 ? "∞" : healthFactorNum.toFixed(2);
        setPreviewHealthFactor(healthFactorValue);
        
        if (healthFactorNum < 1) {
          setErrorMessage("Health factor would be too low");
        } else {
          setErrorMessage(null);
        }
      }

    } catch (error) {
      console.error('Preview failed:', error);
      setPreviewHealthFactor(null);
      setErrorMessage("Failed to preview transaction");
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleBorrow = async () => {
    if (!currentAccount || !selectedAsset || !amount) return;

    try {
      setIsSubmitting(true);
      const tx = new Transaction();
      const amountValue = BigInt(Math.floor(parseFloat(amount) * 1e9));

      if (mode === 'borrow') {
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::borrow_testsui`,
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
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::borrow_token_${comparison ? 'a' : 'b'}`,
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
      } else {
        if (selectedAsset.symbol === 'TESTSUI') {
          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::repay_testsui`,
            arguments: [
              tx.object(CLOCK_ID),
              tx.object(LENDING_STORAGE_ID),
              tx.object(selectedAsset.lendingPoolId),
              await preparePaymentCoin(`${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`, amountValue, tx),
              tx.pure.u64(amountValue),
            ],
          });
        } else {
          const testSuiType = `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`;
          const comparison = selectedAsset.type.toLowerCase() > testSuiType.toLowerCase();

          tx.moveCall({
            target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::repay_token_${comparison ? 'a' : 'b'}`,
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
      }

      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async () => {
            try {
              if (mode === 'borrow') {
                setLastBorrowedAmount(amount);
              }
              
              await Promise.all([
                onTransactionSuccess(),
                refetchBalance(),
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
            console.error(`${mode === 'borrow' ? '借款' : '还款'}交易错误:`, error);
            setIsSubmitting(false);
          },
        }
      );
    } catch (error) {
      console.error(`${mode === 'borrow' ? '借款' : '还款'}函数错误:`, error);
      setIsSubmitting(false);
    }
  };

  const handleBorrowClick = () => {
    if (!currentAccount) {
      document.querySelector<HTMLButtonElement>('.wallet-button')?.click();
      return;
    }
    handleBorrow();
  };

  const preparePaymentCoin = async (
    coinType: string,
    amount: bigint,
    tx: Transaction
  ) => {
    if (!currentAccount) {
      throw new Error("请先连接钱包");
    }

    const coins = await suiClient.getCoins({
      owner: currentAccount.address,
      coinType,
    });

    if (coins.data.length === 0) {
      throw new Error("余额不足");
    }

    const totalBalance = coins.data.reduce(
      (sum, coin) => sum + BigInt(coin.balance),
      BigInt(0)
    );

    if (totalBalance < amount) {
      throw new Error("余额不足");
    }

    const singleCoin = coins.data.find(coin => BigInt(coin.balance) >= amount);
    if (singleCoin) {
      return tx.object(singleCoin.coinObjectId);
    }

    console.log('没有找到单个足够大的代币，需要合并多个代币');
    const primaryCoin = tx.object(coins.data[0].coinObjectId);
    if (coins.data.length > 1) {
      tx.mergeCoins(
        primaryCoin,
        coins.data.slice(1).map(coin => tx.object(coin.coinObjectId))
      );
    }

    return primaryCoin;
  };

  const isHealthFactorSafe = (value: string | null) => {
    if (!value || value === "-" || value === "∞") return true;
    if (value === "< 1") return false;
    return parseFloat(value) >= 1;
  };

  const isValidAmount = (value: string) => {
    if (!value || value === "0") return false;
    const numValue = parseFloat(value);
    if (isNaN(numValue) || numValue <= 0) return false;
    if (!/^\d*\.?\d*$/.test(value)) return false;
    
    const maxAmount = mode === 'borrow' ? 
      (selectedAsset?.symbol === 'TESTSUI' ? 
        parseFloat(maxBorrowValue) : 
        (parseFloat(maxBorrowValue) / (selectedAsset?.price || 1)) / 3) : 
      (balance?.raw ? Number(balance.raw) / 1e9 : 0);
    
    if (numValue > maxAmount) return false;
    return true;
  };

  const getHealthFactorColor = (value: string) => {
    if (value === "∞") return "green";
    const num = parseFloat(value);
    if (num >= 2) return "green";
    if (num >= 1.1) return "orange";
    return "red";
  };


  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setAmount(value);
    setErrorMessage(null);
    
    if (previewController) {
      previewController.abort();
      setPreviewController(null);
    }
    
    if (value && !/^\d*\.?\d*$/.test(value)) {
      setPreviewHealthFactor(null);
      setIsPreviewLoading(false);
      return;
    }

    const numValue = parseFloat(value);
    
    if (isNaN(numValue) || numValue <= 0) {
      setPreviewHealthFactor(null);
      setIsPreviewLoading(false);
      return;
    }

    const maxAmount = mode === 'borrow' ? 
      (selectedAsset?.symbol === 'TESTSUI' ? 
        parseFloat(maxBorrowValue) : 
        (parseFloat(maxBorrowValue) / (selectedAsset?.price || 1)) / 3) : 
      (balance?.raw ? Number(balance.raw) / 1e9 : 0);

    if (numValue > maxAmount) {
      setPreviewHealthFactor(null);
      setIsPreviewLoading(false);
      setErrorMessage("Amount exceeds maximum available");
      return;
    }

    const timeoutId = setTimeout(() => {
      previewBorrow(value);
    }, 500);

    return () => clearTimeout(timeoutId);
  };

  const handleMaxClick = () => {
    if (!selectedAsset) return;

    const maxAmount = mode === 'borrow' ? 
      calculateAvailableAmount(false) : 
      (balance?.raw ? (Number(balance.raw) / 1e9).toString() : "0");
    
    setAmount(maxAmount);
    
    setTimeout(() => {
      previewBorrow(maxAmount);
    }, 100);
  };

  const calculateAvailableAmount = (formatted = true) => {
    if (!selectedAsset || !maxBorrowValue) return "0";
    
    if (selectedAsset.symbol === 'TESTSUI') {
      const poolAvailable = parseFloat(selectedAsset.reserves);
      const userAvailable = parseFloat(maxBorrowValue);
      const adjustedPoolAvailable = poolAvailable - parseFloat(lastBorrowedAmount);
      const adjustedUserAvailable = userAvailable - parseFloat(lastBorrowedAmount);
      const result = Math.min(adjustedPoolAvailable, adjustedUserAvailable);
      return formatted ? result.toFixed(6) : result.toString();
    }

    const userAvailable = (parseFloat(maxBorrowValue) / selectedAsset.price) / 3;
    const poolAvailable = parseFloat(selectedAsset.reserves);
    const adjustedPoolAvailable = poolAvailable - parseFloat(lastBorrowedAmount);
    const adjustedUserAvailable = userAvailable - parseFloat(lastBorrowedAmount);
    const result = Math.min(adjustedPoolAvailable, adjustedUserAvailable);
    return formatted ? result.toFixed(6) : result.toString();
  };

  useEffect(() => {
    setLastBorrowedAmount("0");
  }, [selectedAsset]);

  if (!currentAccount) {
    return (
      <Box className="panel-content" p="4">
        <Text size="5" weight="bold" mb="4">
          {mode === 'borrow' ? 'Borrow' : 'Repay'} {selectedAsset?.symbol || "Asset"}
        </Text>
        <Button 
          className="action-button submit-button" 
          size="3" 
          onClick={() => document.querySelector<HTMLButtonElement>('.wallet-button')?.click()}
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
        {mode === 'repay' && (
          <Button 
            variant="ghost" 
            size="1"
            onClick={() => {
              setMode('borrow');
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
          {mode === 'borrow' ? 'Borrow' : 'Repay'} {selectedAsset?.symbol || "Asset"}
        </Text>
      </Flex>

      {mode === 'borrow' && (
        <Flex justify="between" mb="4">
          <Text>Borrowed: {userBorrowed}</Text>
          <Button 
            variant="soft" 
            size="1" 
            className="action-button secondary"
            onClick={() => {
              setMode('repay');
              setAmount('');
              setPreviewHealthFactor(null);
              setIsPreviewLoading(false);
              if (previewController) {
                previewController.abort();
                setPreviewController(null);
              }
            }}
          >
            Repay
          </Button>
        </Flex>
      )}

      <Box className="amount-input-container" mb="4">
        <Flex justify="between" mb="2">
          <Text>Amount</Text>
          <Text>
            {mode === 'borrow' ? 
              `Available: ${calculateAvailableAmount()}` : 
              `Balance: ${balance?.formatted || "0"}`
            }
          </Text>
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
          <Text>Debt：</Text>
          <Text>
            {userBorrowed} {selectedAsset?.symbol}
            {amount && (
              <>
                {" → "}
                <span style={{ color: mode === 'borrow' ? 'rgb(255, 67, 67)' : 'rgb(0, 200, 83)' }}>
                  {mode === 'borrow' 
                    ? (parseFloat(userBorrowed) + parseFloat(amount)).toFixed(6)
                    : Math.max(0, parseFloat(userBorrowed) - parseFloat(amount)).toFixed(6)
                  } {selectedAsset?.symbol}
                </span>
              </>
            )}
          </Text>
        </Flex>
        {mode === 'borrow' && (
          <Flex justify="between" mb="2">
            <Text>Borrow APY</Text>
            <Text>{selectedAsset?.borrowRate || "0%"}</Text>
          </Flex>
        )}
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
          (previewHealthFactor && !isHealthFactorSafe(previewHealthFactor))
        )}
        onClick={handleBorrowClick}
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
          mode === 'borrow' ? "Borrow" : "Repay"
        )}
      </Button>
    </Box>
  );
} 