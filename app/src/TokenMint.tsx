import { Box, Button, Container, Flex, Text } from "@radix-ui/themes";
import * as Form from "@radix-ui/react-form";
import { useCurrentAccount, useSuiClient, useSignAndExecuteTransaction } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useState } from "react";
import ClipLoader from "react-spinners/ClipLoader";
import { PUMPSUI_CORE_PACKAGE_ID } from "./config";
export function TokenMint() {
  const currentAccount = useCurrentAccount();
  const suiClient = useSuiClient();
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const [tokenName, setTokenName] = useState("");
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [tokenLogo, setTokenLogo] = useState("");
  const [description, setDescription] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleMintToken = async () => {
    try {
      if (!currentAccount) {
        console.error("请先连接钱包");
        return;
      }

      setIsLoading(true);

      // 调用后端API编译合约
      const response = await fetch('http://localhost:3000/api/compile-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: tokenName,
          symbol: tokenSymbol,
          description: description,
          logoUrl: tokenLogo
        })
      });

      if (!response.ok) {
        throw new Error('编译失败');
      }

      const { bytecode, dependencies } = await response.json();

      // 创建新的交易块
      const tx = new Transaction();
      tx.setSender(currentAccount.address);
      
      // 添加发布模块的交易
      const [upgradeCap] = tx.publish({
        modules: [bytecode],
        dependencies
      });

      tx.transferObjects([upgradeCap], currentAccount.address);

      // 签名并执行交易
      signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: async (result) => {
            await suiClient.waitForTransaction({ digest: result.digest });
            console.log("代币部署成功:", result);
            
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
            console.log("交易详情:", txDetails);

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
              
              // 使用 TreasuryCap 创建交易池
              await createPool(tokenType, treasuryCapObject.objectId);
            }
            
            setIsLoading(false);
          },
          onError: (error) => {
            console.error("部署代币时出错:", error);
            setIsLoading(false);
          },
        },
      );

    } catch (e) {
      console.error("部署代币时出错:", e);
      setIsLoading(false);
    }
  };

  const createPool = async (coinType: string, treasuryCapId: string) => {
    try {
      if (!currentAccount) return;

      const tx = new Transaction();
      
      // 调用 create_pool 函数，传入 TreasuryCap 对象
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
            await suiClient.waitForTransaction({ digest: result.digest });
            console.log("交易池创建成功:", result);
          },
          onError: (error) => {
            console.error("创建交易池时出错:", error);
          },
        },
      );
    } catch (error) {
      console.error("创建交易池时出错:", error);
    }
  };

  return (
    <Container size="1" mt="6">
      <Flex direction="column" gap="6">
        <Box>
          <Text size="5" weight="bold" align="center">
            代币发行
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
                  placeholder="代币名称"
                  value={tokenName}
                  onChange={(e) => setTokenName(e.target.value)}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="tokenSymbol">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="代币符号"
                  value={tokenSymbol}
                  onChange={(e) => setTokenSymbol(e.target.value)}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="tokenLogo">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="代币Logo链接"
                  value={tokenLogo}
                  onChange={(e) => setTokenLogo(e.target.value)}
                />
              </Form.Control>
            </Form.Field>

            <Form.Field name="description">
              <Form.Control asChild>
                <input 
                  className="text-field"
                  placeholder="代币描述"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </Form.Control>
            </Form.Field>

            <Button 
              size="3" 
              variant="solid" 
              type="submit"
              disabled={!currentAccount || isLoading}
            >
              {isLoading ? <ClipLoader size={20} /> : "发行代币"}
            </Button>
          </Flex>
        </Form.Root>
      </Flex>
    </Container>
  );
} 