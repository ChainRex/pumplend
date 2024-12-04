import { initCetusSDK, d, Percentage } from '@cetusprotocol/cetus-sui-clmm-sdk';
import { useCurrentAccount } from '@mysten/dapp-kit';

export function useCetusSwap() {
  const currentAccount = useCurrentAccount();

  const sdk = initCetusSDK({network: 'testnet',});
    
  sdk.senderAddress = currentAccount?.address || '';

  const preswap = async ({
    poolAddress,
    coinTypeA,
    coinTypeB,
    decimalsA,
    decimalsB,
    amount,
    a2b,
    byAmountIn = true
  }: {
    poolAddress: string;
    coinTypeA: string;
    coinTypeB: string;
    decimalsA: number;
    decimalsB: number;
    amount: string;
    a2b: boolean;
    byAmountIn?: boolean;
  }) => {
    if (!sdk) throw new Error('SDK not initialized');
    if (!currentAccount?.address) throw new Error('Wallet not connected');

    // 获取池子信息
    const pool = await sdk.Pool.getPool(poolAddress);
    if (!pool) throw new Error('Pool not found');
    // 预计算交换结果
    const res = await sdk.Swap.preswap({
      pool,
      currentSqrtPrice: pool.current_sqrt_price,
      coinTypeA,
      coinTypeB,
      decimalsA,
      decimalsB,
      a2b,
      byAmountIn,
      amount: amount.toString()
    });

    if (!res) throw new Error('Preswap calculation failed');

    // 计算滑点
    const slippage = Percentage.fromDecimal(d(5)); // 5% 滑点
    const toAmount = byAmountIn ? res.estimatedAmountOut : res.estimatedAmountIn;
    const amountLimit = adjustForSlippage(BigInt(toAmount), slippage, !byAmountIn);

    return {
      pool,
      estimatedAmount: toAmount,
      amountLimit: amountLimit.toString(),
      fee: res.estimatedFeeAmount
    };
  };

  const swap = async ({
    pool,
    coinTypeA,
    coinTypeB,
    amount,
    amountLimit,
    a2b,
    byAmountIn = true
  }: {
    pool: any;
    coinTypeA: string;
    coinTypeB: string;
    amount: string;
    amountLimit: string;
    a2b: boolean;
    byAmountIn?: boolean;
  }) => {
    if (!sdk) throw new Error('SDK not initialized');
    if (!currentAccount?.address) throw new Error('Wallet not connected');

    // 创建交换交易
    const swapPayload = await sdk.Swap.createSwapTransactionPayload({
      pool_id: pool.poolAddress,
      coinTypeA,
      coinTypeB,
      a2b,
      by_amount_in: byAmountIn,
      amount,
      amount_limit: amountLimit
    });

    return swapPayload;
  };

  return {
    preswap,
    swap
  };
}

// 辅助函数: 根据滑点调整金额
function adjustForSlippage(
  amount: bigint,
  slippage: Percentage,
  add: boolean
): bigint {
  const basis = BigInt(10000);
  const adjustedBasis = add
    ? basis + BigInt(slippage.numerator.toString())
    : basis - BigInt(slippage.numerator.toString());
  
  return (amount * adjustedBasis) / basis;
} 