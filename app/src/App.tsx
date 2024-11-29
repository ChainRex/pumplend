import { ConnectButton } from "@mysten/dapp-kit";
import { Box, Container, Flex, Heading } from "@radix-ui/themes";
import { TokenMint } from "./TokenMint";

function App() {
  return (
    <>
      <Flex
        position="sticky"
        px="4"
        py="2"
        justify="between"
        style={{
          borderBottom: "1px solid var(--gray-a2)",
        }}
      >
        <Box>
          <Heading>pump.sui</Heading>
        </Box>

        <Box>
          <ConnectButton />
        </Box>
      </Flex>

      <TokenMint />
    </>
  );
}

export default App;
