import { Theme } from "@radix-ui/themes";
import { WalletProvider, ConnectButton, useSignAndExecuteTransaction, useCurrentAccount,useSuiClient } from "@mysten/dapp-kit";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { TokenMint } from "./TokenMint";
import { Trade } from "./Trade";
import { Box, Flex, Text } from "@radix-ui/themes";
import { Transaction } from "@mysten/sui/transactions";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { TESTSUI_TREASURECAP_ID,TESTSUI_PACKAGE_ID, PUMPLEND_CORE_PACKAGE_ID, LENDING_STORAGE_ID, CLOCK_ID, TESTSUI_ICON_URL, TESTSUI_METADATA_ID, API_BASE_URL } from "./config";
import { useToast } from './hooks/useToast';
import { LendingTest } from "./LendingTest";
import { Lending } from "./Lending";
import { Borrow } from "./Borrow";
import { useLendingList } from "./hooks/useLendingList";

interface AddAssetEvent {
  type_name: {
    name: string;
  };
  ltv: string;
  liquidation_threshold: string;
}

function Navigation() {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const suiClient = useSuiClient();

  const handleMintTestSui = async () => {
    if (!currentAccount) {
      showToast('请先连接钱包', 'error');
      return;
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${TESTSUI_PACKAGE_ID}::testsui::mint`,
        arguments: [
          tx.object(TESTSUI_TREASURECAP_ID),
          tx.pure.u64(100000000000000), 
          tx.pure.address(currentAccount.address)
        ],
      });

      await signAndExecute(
        {
          transaction: tx,
        },
        {
          onSuccess: (result) => {
            showToast('成功铸造 100,000 TESTSUI', 'success', result.digest);
          },
          onError: (error) => {
            showToast(error.message || '铸造失败', 'error');
          },
        }
      );
    } catch (error) {
      if (error instanceof Error) {
        showToast(error.message, 'error');
      } else {
        showToast('铸造失败', 'error');
      }
    }
  };

  const handleAddTestSuiToLending = async () => {
    if (!currentAccount) {
      showToast('请先连接钱包', 'error');
      return;
    }

    try {
      const tx = new Transaction();
      tx.moveCall({
        target: `${PUMPLEND_CORE_PACKAGE_ID}::lending_core::add_testsui_asset`,
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

              // 查找 AddAssetEvent
              const addAssetEvent = txDetails.events?.find(
                event => event.type.includes('::AddAssetEvent')
              );

              if (!addAssetEvent?.parsedJson) {
                throw new Error('未找到 AddAssetEvent');
              }

              const eventData = addAssetEvent.parsedJson as AddAssetEvent;

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
                  lendingPoolId: lendingPoolObject.objectId,
                  ltv: parseInt(eventData.ltv),
                  liquidation_threshold: parseInt(eventData.liquidation_threshold)
                }),
              });

              showToast('成功添加 TESTSUI 到借贷池', 'success', result.digest);
            } catch (error) {
              showToast('保存借贷池信息失败', 'error');
            }
          },
          onError: () => {
            showToast('添加 TESTSUI 失败', 'error');
          },
        }
      );
    } catch (error) {
      showToast('添加 TESTSUI 失败', 'error');
    }
  };

  // 获取借贷池列表,检查是否已存在 TESTSUI
  const { data: lendings } = useLendingList();
  const testSuiLendingExists = lendings?.some(
    lending => lending.type === `${TESTSUI_PACKAGE_ID}::testsui::TESTSUI`
  );

  return (
    <Flex justify="between" align="center" mb="6">
      <Flex gap="6" align="center">
        <Text size="5" weight="bold">PumpLend</Text>
        <Flex gap="4">
          <button 
            className={`nav-button ${location.pathname === '/lending' ? 'active' : ''}`}
            onClick={() => navigate("/lending")}
          >
            Lending
          </button>
          <button 
            className={`nav-button ${location.pathname === '/trade' ? 'active' : ''}`}
            onClick={() => navigate("/trade")}
          >
            Trade
          </button>
          <button 
            className={`nav-button ${location.pathname === '/createToken' ? 'active' : ''}`}
            onClick={() => navigate("/createToken")}
          >
            Create Token
          </button>
        </Flex>
      </Flex>
      
      <Flex gap="3" align="center">
        {currentAccount && !testSuiLendingExists && (
          <button className="mint-testsui-button" onClick={handleAddTestSuiToLending}>
            <PlusCircledIcon />
            <span>添加TESTSUI到借贷池</span>
          </button>
        )}
        {currentAccount && (
          <button className="mint-testsui-button" onClick={handleMintTestSui}>
            <PlusCircledIcon />
            <span>获取TESTSUI</span>
          </button>
        )}
        <ConnectButton className="wallet-button" />
      </Flex>
    </Flex>
  );
}

export default function App() {
  return (
    <Theme appearance="dark">
      <WalletProvider>
        <BrowserRouter>
          <Box p="4">
            <Navigation />
            <Routes>
              <Route path="/lending" element={<Lending />} />
              <Route path="/lendingtest" element={<LendingTest />} />
              <Route path="/trade" element={<Trade />} />
              <Route path="/createToken" element={<TokenMint />} />
              <Route path="/borrow" element={<Borrow />} />
              <Route path="/" element={<Navigate to="/trade" replace />} />
            </Routes>
          </Box>
        </BrowserRouter>
      </WalletProvider>
    </Theme>
  );
}
