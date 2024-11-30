import { Box, Button, Container, Flex, Text } from "@radix-ui/themes";
import * as Form from "@radix-ui/react-form";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import { PUMPSUI_CORE_PACKAGE_ID } from "./config";
import { Toast } from './components/Toast';
import { useToast } from './hooks/useToast';

export function TokenMint() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const { toasts, showToast, hideToast } = useToast();

  const handleMintToken = async () => {
    try {
      if (!currentAccount) {
        showToast("Please connect your wallet", "error");
        return;
      }

      // 去除前后空格并验证
      const trimmedName = tokenName.trim();
      const trimmedSymbol = tokenSymbol.trim();
      const trimmedLogo = tokenLogo.trim();
      const trimmedDescription = description.trim();

      if (!trimmedName || !trimmedSymbol) {
        showToast("Please enter token name and symbol", "error");
        return;
      }

      setIsLoading(true);
      showToast("Compiling token contract...", "info");

      // 调用后端API编译合约
      const response = await fetch('http://localhost:3000/api/compile-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: trimmedName,
          symbol: trimmedSymbol,
          description: trimmedDescription,
          logoUrl: trimmedLogo
        })
      });

      if (!response.ok) {
        throw new Error('Failed to compile token contract');
      }

      const { bytecode, dependencies } = await response.json();
      showToast("Contract compiled successfully", "info");

      // 创建新的交易块
      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      
      // 添加发布模块的交易
      const [upgradeCap] = tx.publish({
        modules: [bytecode],
        dependencies
      });

      tx.transferObjects([upgradeCap], currentAccount.address);

      showToast("Publishing token contract...", "info");

      // 签名并执行交易
      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            showToast("Token contract published", "info");
            await suiClient.waitForTransaction({
              digest: result.digest,
            });
            
            // 获取交易详情
            const txDetails = await suiClient.getTransactionBlock({
              digest: result.digest,
              options: {
                showEffects: true,
                showEvents: true,
                showInput: true,
                showObjectChanges: true,
              },
            });

            // 查找 TreasuryCap 对象
            const createdObjects = txDetails.objectChanges?.filter(
              (change) => change.type === "created"
            );
            const treasuryCapObject = createdObjects?.find(
              (obj) => obj.objectType.includes("::TreasuryCap<")
            );
            
            // 获取模块 ID
            const publishedModule = txDetails.objectChanges?.find(
              (change) => change.type === "published"
            );

            if (publishedModule && treasuryCapObject) {
              const moduleId = publishedModule.packageId;
              const tokenType = `${moduleId}::${tokenSymbol.toLowerCase()}::${tokenSymbol.toUpperCase()}`;
              
              showToast("Creating pool...", "info");
              // 使用 TreasuryCap 创建交易池
              await createPool(tokenType, treasuryCapObject.objectId);
            } else {
              throw new Error("Failed to get token information");
            }
          },
          onError: (error) => {
            showToast(error.message || "Failed to publish token", "error");
            setIsLoading(false);
          },
        },
      );

    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, "error");
      } else {
        showToast("Failed to create token", "error");
      }
      setIsLoading(false);
    }
  };

  const createPool = async (coinType: string, treasuryCapId: string) => {
    try {
      if (!currentAccount) return;

      const tx = new Transaction();
      
      tx.moveCall({
        target: `${PUMPSUI_CORE_PACKAGE_ID}::pumpsui_core::create_pool`,
        typeArguments: [coinType],
        arguments: [tx.object(treasuryCapId)],
      });

      await signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({
              digest: result.digest,
            });
            
            // 获取交易详情
            const txDetails = await suiClient.getTransactionBlock({
              digest: result.digest,
              options: {
                showEffects: true,
                showEvents: true,
                showInput: true,
                showObjectChanges: true,
              },
            });

            // 查找 Pool 和 TreasuryCapHolder 对象
            const createdObjects = txDetails.objectChanges?.filter(
              (change) => change.type === "created"
            );

            const poolObject = createdObjects?.find(
              (obj) => obj.objectType.includes("::Pool<")
            );

            const treasuryCapHolderObject = createdObjects?.find(
              (obj) => obj.objectType.includes("::TreasuryCapHolder<")
            );

            if (poolObject && treasuryCapHolderObject) {
              // 更新代币信息
              await fetch('http://localhost:3000/api/tokens', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  name: tokenName,
                  symbol: tokenSymbol,
                  type: coinType,
                  icon: tokenLogo,
                  treasuryCapHolderId: treasuryCapHolderObject.objectId,
                  poolId: poolObject.objectId
                })
              });

              // 显示成功消息，使用 tokenUrl 而不是 txHash
              showToast(
                `Token ${tokenSymbol} created successfully`,
                "success",
                undefined,
                `https://suiscan.xyz/testnet/coin/${coinType}`
              );

              // 清空表单
              setTokenName("");
              setTokenSymbol("");
              setTokenLogo("");
              setDescription("");

              // 在这里停止加载动画
              setIsLoading(false);
            }
          },
          onError: (error) => {
            showToast(error.message || "Failed to create pool", "error");
            setIsLoading(false);
          },
        },
      );
    } catch (error) {
      showToast("Failed to create pool", "error");
      setIsLoading(false);
    }
  };

  return (
    <Container size="1" mt="6">
      <Flex direction="column" gap="6">
        <Box>
          <Text size="5" weight="bold" align="center">
            Create Token
          </Text>
        </Box>

        <Form.Root onSubmit={(e) => {
          e.preventDefault();
          handleMintToken();
        }}>
          <Flex direction="column" gap="4">
            <Form.Field name="tokenName">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="Token Name"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                  onBlur={(e) => setTokenName(e.target.value.trim())}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="tokenSymbol">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="Token Symbol"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                  onBlur={(e) => setTokenSymbol(e.target.value.trim())}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="tokenLogo">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="Token Logo URL"
                  value={tokenLogo}
                  onChange={(e) => setTokenLogo(e.target.value)}
                  onBlur={(e) => setTokenLogo(e.target.value.trim())}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="description">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="Token Description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  onBlur={(e) => setDescription(e.target.value.trim())}
                />
              </Form.Control>
            </Form.Field>

            <Button 
              size="3" 
              className="swap-button"
              type="submit"
              disabled={!currentAccount || isLoading}
            >
              {isLoading ? <ClipLoader size={20} color="white" /> : "Create Token"}
            </Button>
          </Flex>
        </Form.Root>

        {/* 渲染 Toasts */}
        {toasts.map(toast => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => hideToast(toast.id)}
            txHash={toast.txHash}
            tokenUrl={toast.tokenUrl}
            duration={toast.type === 'success' ? 6000 : 3000}
          />
        ))}
      </Flex>
    </Container>
  );
} 