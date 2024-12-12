import { Box, Button, Container, Flex, Text } from "@radix-ui/themes";
import * as Form from "@radix-ui/react-form";
import {
  useCurrentAccount,
  useSuiClient,
  useSignAndExecuteTransaction,
} from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import { PUMPLEND_CORE_PACKAGE_ID, API_BASE_URL } from "./config";
import { Toast } from "./components/Toast";
import { useToast } from "./hooks/useToast";

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
      const response = await fetch(`${API_BASE_URL}/compile-token`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          symbol: trimmedSymbol,
          description: trimmedDescription,
          logoUrl: trimmedLogo,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to compile token contract");
      }

      const { bytecode, dependencies } = await response.json();
      showToast("Contract compiled successfully", "info");

      // 创建新的交易块
      const tx = new Transaction();
      tx.setSender(currentAccount.address);

      // 添加发布模块的交易
      const [upgradeCap] = tx.publish({
        modules: [bytecode],
        dependencies,
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
              (change) => change.type === "created",
            );
            const treasuryCapObject = createdObjects?.find((obj) =>
              obj.objectType.includes("::TreasuryCap<"),
            );

            // 获取模块 ID
            const publishedModule = txDetails.objectChanges?.find(
              (change) => change.type === "published",
            );

            // 查找 Metadata 对象
            const metadataObject = createdObjects?.find((obj) =>
              obj.objectType.includes("::CoinMetadata<"),
            );

            if (publishedModule && treasuryCapObject && metadataObject) {
              const moduleId = publishedModule.packageId;
              const tokenType = `${moduleId}::${tokenSymbol.toLowerCase()}::${tokenSymbol.toUpperCase()}`;

              showToast("Creating pool...", "info");
              // 使用 TreasuryCap 创建交易池
              await createPool(
                tokenType,
                treasuryCapObject.objectId,
                metadataObject.objectId,
              );
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

  const createPool = async (
    coinType: string,
    treasuryCapId: string,
    metadataId: string,
  ) => {
    try {
      if (!currentAccount) return;

      const tx = new Transaction();

      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::pump_core::create_collateral`,
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

            // 查找 Collateral 和 TreasuryCapHolder 对象
            const createdObjects = txDetails.objectChanges?.filter(
              (change) => change.type === "created",
            );

            const collateralObject = createdObjects?.find((obj) =>
              obj.objectType.includes("::Collateral<"),
            );

            const treasuryCapHolderObject = createdObjects?.find((obj) =>
              obj.objectType.includes("::TreasuryCapHolder<"),
            );

            if (collateralObject && treasuryCapHolderObject) {
              // 更新代币信息
              await fetch(`${API_BASE_URL}/tokens`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  name: tokenName,
                  symbol: tokenSymbol,
                  type: coinType,
                  icon: tokenLogo,
                  treasuryCapHolderId: treasuryCapHolderObject.objectId,
                  collateralId: collateralObject.objectId,
                  metadataId: metadataId,
                  totalSupply: "0",
                  collectedSui: "0",
                  status: "FUNDING",
                }),
              });

              // 显示成功消息，使用 tokenUrl 而不是 txHash
              showToast(
                `Token ${tokenSymbol} created successfully`,
                "success",
                undefined,
                `https://suiscan.xyz/testnet/coin/${coinType}`,
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

  // 添加新的辅助函数
  const getButtonText = () => {
    if (!currentAccount) {
      return "Connect Wallet";
    }
    return isLoading ? <ClipLoader size={20} color="white" /> : "Create Token";
  };

  // 修改按钮禁用状态的判断函数
  const isButtonDisabled = () => {
    const trimmedName = tokenName.trim();
    const trimmedSymbol = tokenSymbol.trim();
    const trimmedLogo = tokenLogo.trim();
    const trimmedDescription = description.trim();

    // 检查所有字段是否都已填写
    const allFieldsFilled =
      trimmedName && trimmedSymbol && trimmedLogo && trimmedDescription;

    if (!currentAccount) {
      // 如果未连接钱包，只有在所有字段都填写后才可点击
      return !allFieldsFilled;
    }
    return isLoading || !allFieldsFilled;
  };

  // 添加按钮点击处理函数
  const handleButtonClick = () => {
    if (!currentAccount) {
      // 如果未连接钱包，触发钱包连接
      document.querySelector<HTMLButtonElement>(".wallet-button")?.click();
      return;
    }
    handleMintToken();
  };

  return (
    <Container size="1" mt="6">
      <Flex direction="column" gap="6">
        <Box>
          <Text size="5" weight="bold" align="center">
            Create Token
          </Text>
        </Box>

        <Form.Root
          onSubmit={(e) => {
            e.preventDefault();
            handleButtonClick();
          }}
        >
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
              disabled={isButtonDisabled()}
            >
              {getButtonText()}
            </Button>
          </Flex>
        </Form.Root>

        {/* 渲染 Toasts */}
        {toasts.map((toast) => (
          <Toast
            key={toast.id}
            message={toast.message}
            type={toast.type}
            onClose={() => hideToast(toast.id)}
            txHash={toast.txHash}
            tokenUrl={toast.tokenUrl}
            duration={toast.type === "success" ? 6000 : 3000}
          />
        ))}
      </Flex>
    </Container>
  );
}
