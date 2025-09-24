import React, { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Center,
  Flex,
  Heading,
  Image,
  Input,
  SimpleGrid,
  Text,
  Spinner,
  useToast,
} from '@chakra-ui/react';
import { Alchemy, Network, Utils } from 'alchemy-sdk';
import { utils as ethersUtils } from 'ethers';

function App() {
  const toast = useToast();

  // Use Vite env variable
  const ALCHEMY_API_KEY = import.meta.env.VITE_ALCHEMY_API_KEY;

  const [userAddress, setUserAddress] = useState('');
  const [walletAddress, setWalletAddress] = useState('');
  const [erc20Balances, setErc20Balances] = useState([]);
  const [tokenDataObjects, setTokenDataObjects] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [hasQueried, setHasQueried] = useState(false);
  const [recentAddresses, setRecentAddresses] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem('recentAddresses');
    if (saved) setRecentAddresses(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem('recentAddresses', JSON.stringify(recentAddresses));
  }, [recentAddresses]);

  function isValidEthereumAddress(addr) {
    return /^0x[a-fA-F0-9]{40}$/.test(addr);
  }

  async function resolveENS(name) {
    try {
      const alchemy = new Alchemy({
        apiKey: import.meta.env.VITE_ALCHEMY_API_KEY,
        network: Network.ETH_SEPOLIA,
      });
      const resolved = await alchemy.core.resolveName(name);
      return resolved;
    } catch (err) {
      console.error("ENS resolution error:", err);
      return null;
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setError('❌ MetaMask not installed');
      return;
    }
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      const acc = accounts[0];
      setWalletAddress(acc);
      setUserAddress(acc);
      toast({
        title: 'Wallet connected',
        description: acc,
        status: 'success',
        duration: 3000,
        isClosable: true,
      });
      setError('');
    } catch (err) {
      console.error(err);
      setError('❌ Connection failed');
    }
  }

  async function fetchErc20Balances() {
    setError('');
    setHasQueried(false);
    setLoading(true);
    setErc20Balances([]);
    setTokenDataObjects([]);

    let input = userAddress.trim();

    if (input === '') {
      setError('❌ Address or ENS required');
      setLoading(false);
      return;
    }

    if (input.endsWith('.eth')) {
      const resolved = await resolveENS(input);
      if (!resolved) {
        setError(`❌ Failed to resolve ENS name: ${input}`);
        setLoading(false);
        return;
      }
      input = resolved;
      setUserAddress(input);
    }

    if (!isValidEthereumAddress(input)) {
      setError('❌ Enter a valid Ethereum address');
      setLoading(false);
      return;
    }

    if (!ALCHEMY_API_KEY) {
      setError('❌ Missing Alchemy API key. Ensure VITE_ALCHEMY_API_KEY is defined in .env');
      setLoading(false);
      return;
    }

    try {
      const alchemy = new Alchemy({
        apiKey: ALCHEMY_API_KEY,
        network: Network.ETH_SEPOLIA,
      });

      const data = await alchemy.core.getTokenBalances(input);
      setErc20Balances(data.tokenBalances);

      const metadataPromises = data.tokenBalances.map((token) =>
        alchemy.core.getTokenMetadata(token.contractAddress)
      );
      const metadata = await Promise.all(metadataPromises);
      setTokenDataObjects(metadata);

      setHasQueried(true);

      const addrLower = input.toLowerCase();
      if (!recentAddresses.includes(addrLower)) {
        setRecentAddresses(prev => [addrLower, ...prev].slice(0, 5));
      }

    } catch (err) {
      console.error('Fetch error:', err);
      setError(`❌ Error fetching balances: ${err.message || err.toString()}`);
    } finally {
      setLoading(false);
    }
  }

  function handleRecentClick(addr) {
    setUserAddress(addr);
    setError('');
    setHasQueried(false);
  }

  return (
    <Box w="100vw" minH="100vh" bg="gray.900" color="white" p={[4,8]} fontFamily="mono">
      <Center mb={10} flexDirection="column">
        <Heading fontSize={[24,36]}>ERC‑20 Token Indexer (Sepolia)</Heading>
        <Text mt={2} color="gray.300" textAlign="center" maxW="600px">
          Enter address or ENS name, or connect wallet to see ERC‑20 tokens held.
        </Text>
      </Center>

      <Flex direction="column" align="center" mb={8} maxW="700px" mx="auto" gap={4}>
        <Button
          onClick={connectWallet}
          bg="orange.400"
          color="black"
          _hover={{ bg: 'orange.500' }}
          w={['100%', 'auto']}
        >
          🦊 Connect Wallet
        </Button>
        {walletAddress && (
          <Text fontSize="sm" color="green.300" wordBreak="break-all" textAlign="center">
            ✅ Connected: {walletAddress}
          </Text>
        )}

        <Input
          placeholder="Enter Ethereum address or ENS (e.g. vitalik.eth)"
          value={userAddress}
          onChange={(e) => {
            setUserAddress(e.target.value);
            setError('');
          }}
          bg="white"
          color="black"
          fontSize={[14,18]}
          p={4}
          w="100%"
          maxW="600px"
          borderRadius="md"
        />

        <Button
          onClick={fetchErc20Balances}
          bg="blue.500"
          color="white"
          _hover={{ bg: 'blue.600' }}
          w={['100%', 'auto']}
          isDisabled={loading}
        >
          {loading ? 'Fetching balances...' : 'Fetch ERC‑20 Balances'}
        </Button>

        {error && (
          <Text color="red.400" fontWeight="bold" textAlign="center" mt={2}>
            {error}
          </Text>
        )}

        {recentAddresses.length > 0 && (
          <Box mt={6} w="100%" maxW="600px" bg="gray.800" p={3} borderRadius="md" userSelect="none">
            <Text mb={2} fontWeight="bold" color="gray.300">Recent lookups:</Text>
            <Flex wrap="wrap" gap={3}>
              {recentAddresses.map(addr => (
                <Button
                  key={addr}
                  size="sm"
                  variant="outline"
                  colorScheme="teal"
                  onClick={() => handleRecentClick(addr)}
                >
                  {addr}
                </Button>
              ))}
            </Flex>
          </Box>
        )}
      </Flex>

      {loading && (
        <Flex direction="column" align="center" mt={8}>
          <Spinner size="xl" color="blue.300" />
          <Text mt={4}>Fetching token balances…</Text>
        </Flex>
      )}

      {!loading && hasQueried && erc20Balances.length === 0 && (
        <Text color="gray.400" textAlign="center" mt={8}>
          No ERC‑20 tokens found for this address.
        </Text>
      )}

      {!loading && erc20Balances.length > 0 && (
        <SimpleGrid columns={[1,2,3,4]} spacing={6} px={[4,12]} maxW="90vw" mx="auto">
          {erc20Balances.map((token, i) => {
            const metadata = tokenDataObjects[i];
            const balance = Utils.formatUnits(token.tokenBalance, metadata?.decimals || 18);

            return (
              <Box
                key={token.contractAddress + token.tokenBalance}
                p={4}
                bg="blue.600"
                borderRadius="md"
                boxShadow="md"
                wordBreak="break-word"
                minW="200px"
              >
                <Text><b>Symbol:</b> {metadata?.symbol || 'N/A'}</Text>
                <Text><b>Balance:</b> {balance}</Text>
                <Text><b>Contract:</b> {token.contractAddress}</Text>
                {metadata?.logo && (
                  <Image
                    src={metadata.logo}
                    alt={`${metadata.symbol} logo`}
                    boxSize="40px"
                    mt={2}
                    objectFit="contain"
                  />
                )}
              </Box>
            );
          })}
        </SimpleGrid>
      )}
    </Box>
  );
}

export default App;
