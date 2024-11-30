import { Theme } from "@radix-ui/themes";
import { WalletProvider, ConnectButton } from "@mysten/dapp-kit";
import { BrowserRouter, Routes, Route, useNavigate, Navigate, useLocation } from "react-router-dom";
import { TokenMint } from "./TokenMint";
import { Trade } from "./Trade";
import { Box, Flex, Text } from "@radix-ui/themes";

function Navigation() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <Flex justify="between" align="center" mb="6">
      <Flex gap="6" align="center">
        <Text size="5" weight="bold">PumpSui</Text>
        <Flex gap="4">
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
      
      <ConnectButton className="wallet-button" />
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
              <Route path="/trade" element={<Trade />} />
              <Route path="/createToken" element={<TokenMint />} />
              <Route path="/" element={<Navigate to="/trade" replace />} />
            </Routes>
          </Box>
        </BrowserRouter>
      </WalletProvider>
    </Theme>
  );
}
