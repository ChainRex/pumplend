import { Theme } from "@radix-ui/themes";
import { WalletProvider, ConnectButton, useSignAndExecuteTransaction, useCurrentAccount } from "@mysten/dapp-kit";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { TokenMint } from "./TokenMint";
import { Trade } from "./Trade";
import { Box, Flex, Text } from "@radix-ui/themes";
import { Transaction } from "@mysten/sui/transactions";
import { PlusCircledIcon } from "@radix-ui/react-icons";
import { TESTSUI_TREASURECAP_ID,TESTSUI_PACKAGE_ID } from "./config";
import { useToast } from './hooks/useToast';
import { LendingTest } from "./LendingTest";
import { Lending } from "./Lending";
import { Borrow } from "./Borrow";

function Navigation() {
  const { mutate: signAndExecute } = useSignAndExecuteTransaction();
  const currentAccount = useCurrentAccount();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

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

  return (
    <Flex justify="between" align="center" mb="6">
      <Flex gap="6" align="center">
        <Text size="5" weight="bold">PumpSui</Text>
        <Flex gap="4">
          <button 
            className={`nav-button ${location.pathname === '/lending' ? 'active' : ''}`}
            onClick={() => navigate("/lending")}
          >
            Lending
          </button>
          <button 
            className={`nav-button ${location.pathname === '/lendingtest' ? 'active' : ''}`}
            onClick={() => navigate("/lendingtest")}
          >
            Lending Test
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
