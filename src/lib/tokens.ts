import type { Address, Token } from '../types';

export const NATIVE: Address = '0x0000000000000000000000000000000000000000';
export const EEEE: Address = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';

export interface Chain {
  id: number;
  name: string;
  /** path segment relay.link uses for the destination chain */
  relaySlug: string;
  /** file name in public/logos/chains */
  logo: string;
}

export const CHAINS: readonly Chain[] = [
  { id: 1, name: 'Ethereum', relaySlug: 'ethereum', logo: 'ethereum.png' },
  { id: 42161, name: 'Arbitrum', relaySlug: 'arbitrum', logo: 'arbitrum.png' },
  { id: 8453, name: 'Base', relaySlug: 'base', logo: 'base.png' },
  { id: 10, name: 'Optimism', relaySlug: 'optimism', logo: 'optimism.png' },
  { id: 137, name: 'Polygon', relaySlug: 'polygon', logo: 'polygon.png' },
  { id: 56, name: 'BNB Chain', relaySlug: 'bsc', logo: 'bnb.png' },
  { id: 43114, name: 'Avalanche', relaySlug: 'avalanche', logo: 'avalanche.png' },
  { id: 59144, name: 'Linea', relaySlug: 'linea', logo: 'linea.png' },
  { id: 324, name: 'zkSync Era', relaySlug: 'zksync', logo: 'zksync.png' },
  { id: 534352, name: 'Scroll', relaySlug: 'scroll', logo: 'scroll.png' },
  { id: 81457, name: 'Blast', relaySlug: 'blast', logo: 'blast.png' },
  { id: 5000, name: 'Mantle', relaySlug: 'mantle', logo: 'mantle.png' },
  { id: 100, name: 'Gnosis', relaySlug: 'gnosis', logo: 'gnosis.png' },
  { id: 146, name: 'Sonic', relaySlug: 'sonic', logo: 'sonic.png' },
  { id: 130, name: 'Unichain', relaySlug: 'unichain', logo: 'unichain.webp' },
  { id: 80094, name: 'Berachain', relaySlug: 'berachain', logo: 'berachain.webp' },
];

/** `logo` is a file name in public/logos/tokens; wrapped tokens share the base logo. */
const t = (chainId: number, address: Address, symbol: string, name: string, decimals: number, logo: string): Token => ({
  chainId,
  address,
  symbol,
  name,
  decimals,
  logo,
});

// Every non-native address below is checked on-chain (symbol, decimals) by scripts/check-tokens.mjs.
export const TOKENS: readonly Token[] = [
  t(1, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(1, '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(1, '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(1, '0xdAC17F958D2ee523a2206206994597C13D831ec7', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(1, '0x6B175474E89094C44Da98b954EedeAC495271d0F', 'DAI', 'Dai Stablecoin', 18, 'dai.png'),
  t(1, '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', 'WBTC', 'Wrapped BTC', 8, 'wbtc.png'),
  t(1, '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 'cbBTC', 'Coinbase Wrapped BTC', 8, 'cbbtc.webp'),
  t(1, '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', 'wstETH', 'Wrapped liquid staked Ether', 18, 'wsteth.png'),
  t(1, '0x4c9EDD5852cd905f086C759E8383e09bff1E68B3', 'USDe', 'Ethena USDe', 18, 'usde.png'),
  t(1, '0x514910771AF9Ca656af840dff83E8264EcF986CA', 'LINK', 'Chainlink', 18, 'link.png'),
  t(1, '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', 'UNI', 'Uniswap', 18, 'uni.png'),
  t(1, '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1', 'ARB', 'Arbitrum', 18, 'arb.png'),
  t(1, '0x455e53CBB86018Ac2B8092FdCd39d8444aFFC3F6', 'POL', 'Polygon Ecosystem Token', 18, 'pol.png'),

  t(42161, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(42161, '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(42161, '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(42161, '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(42161, '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(42161, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 'DAI', 'Dai Stablecoin', 18, 'dai.png'),
  t(42161, '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f', 'WBTC', 'Wrapped BTC', 8, 'wbtc.png'),
  t(42161, '0x5979D7b546E38E414F7E9822514be443A4800529', 'wstETH', 'Wrapped liquid staked Ether', 18, 'wsteth.png'),
  t(42161, '0x912CE59144191C1204E64559FE8253a0e49E6548', 'ARB', 'Arbitrum', 18, 'arb.png'),
  t(42161, '0xf97f4df75117a78c1A5a0DBb814Af92458539FB4', 'LINK', 'Chainlink', 18, 'link.png'),

  t(8453, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(8453, '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(8453, '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(8453, '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(8453, '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', 'DAI', 'Dai Stablecoin', 18, 'dai.png'),
  t(8453, '0xcbB7C0000aB88B473b1f5aFd9ef808440eed33Bf', 'cbBTC', 'Coinbase Wrapped BTC', 8, 'cbbtc.webp'),
  t(8453, '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', 'cbETH', 'Coinbase Wrapped Staked ETH', 18, 'cbeth.webp'),
  t(8453, '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', 'wstETH', 'Wrapped liquid staked Ether', 18, 'wsteth.png'),
  t(8453, '0x940181a94A35A4569E4529A3CDfB74e38FD98631', 'AERO', 'Aerodrome', 18, 'aero.png'),

  t(10, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(10, '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(10, '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(10, '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(10, '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(10, '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', 'DAI', 'Dai Stablecoin', 18, 'dai.png'),
  t(10, '0x68f180fcCe6836688e9084f035309E29Bf0A2095', 'WBTC', 'Wrapped BTC', 8, 'wbtc.png'),
  t(10, '0x1F32b1c2345538c0c6f582fCB022739c4A194Ebb', 'wstETH', 'Wrapped liquid staked Ether', 18, 'wsteth.png'),
  t(10, '0x4200000000000000000000000000000000000042', 'OP', 'Optimism', 18, 'op.png'),

  t(137, NATIVE, 'POL', 'Polygon Ecosystem Token', 18, 'pol.png'),
  t(137, '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', 'WPOL', 'Wrapped POL', 18, 'pol.png'),
  t(137, '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(137, '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(137, '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(137, '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(137, '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', 'DAI', 'Dai Stablecoin', 18, 'dai.png'),
  t(137, '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6', 'WBTC', 'Wrapped BTC', 8, 'wbtc.png'),

  t(56, NATIVE, 'BNB', 'BNB', 18, 'bnb.png'),
  t(56, '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', 'WBNB', 'Wrapped BNB', 18, 'bnb.png'),
  t(56, '0x2170Ed0880ac9A755fd29B2688956BD959F933F8', 'ETH', 'Binance-Peg Ether', 18, 'eth.png'),
  t(56, '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', 'USDC', 'Binance-Peg USD Coin', 18, 'usdc.png'),
  t(56, '0x55d398326f99059fF775485246999027B3197955', 'USDT', 'Binance-Peg Tether USD', 18, 'usdt.png'),
  t(56, '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', 'DAI', 'Binance-Peg Dai', 18, 'dai.png'),
  t(56, '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c', 'BTCB', 'Binance-Peg BTC', 18, 'btcb.png'),
  t(56, '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82', 'CAKE', 'PancakeSwap', 18, 'cake.png'),

  t(43114, NATIVE, 'AVAX', 'Avalanche', 18, 'avax.png'),
  t(43114, '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', 'WAVAX', 'Wrapped AVAX', 18, 'avax.png'),
  t(43114, '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(43114, '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', 'USDt', 'Tether USD', 6, 'usdt.png'),
  t(43114, '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB', 'WETH.e', 'Bridged Wrapped Ether', 18, 'eth.png'),
  t(43114, '0x152b9d0FdC40C096757F570A51E494bd4b943E50', 'BTC.b', 'Bitcoin (Avalanche)', 8, 'btcb.png'),

  t(59144, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(59144, '0xe5D7C2a44FfDDf6b295A15c148167daaAf5Cf34f', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(59144, '0x176211869cA2b568f2A7D4EE941E073a821EE1ff', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(59144, '0xA219439258ca9da29E9Cc4cE5596924745e12B93', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(59144, '0x3aAB2285ddcDdaD8edf438C1bAB47e1a9D05a9b4', 'WBTC', 'Wrapped BTC', 8, 'wbtc.png'),

  t(324, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(324, '0x5AEa5775959fBC2557Cc8789bC1bf90A239D9a91', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(324, '0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(324, '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(324, '0x493257fD37EDB34451f62EDf8D2a0C418852bA4C', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(324, '0x5A7d6b2F92C77FAD6CCaBd7EE0624E64907Eaf3E', 'ZK', 'ZKsync', 18, 'zk.webp'),

  t(534352, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(534352, '0x5300000000000000000000000000000000000004', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(534352, '0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(534352, '0xf55BEC9cafDbE8730f096Aa55dad6D22d44099Df', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(534352, '0xd29687c813D741E2F938F4aC377128810E217b1b', 'SCR', 'Scroll', 18, 'scr.png'),

  t(81457, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(81457, '0x4300000000000000000000000000000000000004', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(81457, '0x4300000000000000000000000000000000000003', 'USDB', 'USDB', 18, 'usdb.png'),
  t(81457, '0xb1a5700fA2358173Fe465e6eA4Ff52E36e88E2ad', 'BLAST', 'Blast', 18, 'blast.png'),

  t(5000, NATIVE, 'MNT', 'Mantle', 18, 'mnt.png'),
  t(5000, '0x78c1b0C915c4FAA5FffA6CAbf0219DA63d7f4cb8', 'WMNT', 'Wrapped Mantle', 18, 'mnt.png'),
  t(5000, '0xdEAddEaDdeadDEadDEADDEAddEADDEAddead1111', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(5000, '0x09Bc4E0D864854c6aFB6eB9A9cdF58aC190D0dF9', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(5000, '0x201EBa5CC46D216Ce6DC03F6a759e8E766e956aE', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(5000, '0xcDA86A272531e8640cD7F1a92c01839911B90bb0', 'mETH', 'mETH', 18, 'meth.webp'),

  t(100, NATIVE, 'xDAI', 'xDAI', 18, 'xdai.png'),
  t(100, '0xe91D153E0b41518A2Ce8Dd3D7944Fa863463a97d', 'WXDAI', 'Wrapped xDAI', 18, 'xdai.png'),
  t(100, '0x2a22f9c3b484c3629090FeED35F17Ff8F88f76F0', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(100, '0xDDAfbb505ad214D7b80b1f830fcCc89B60fb7A83', 'USDC', 'USD Coin (Omnibridge)', 6, 'usdc.png'),
  t(100, '0x4ECaBa5870353805a9F068101A40E0f32ed605C6', 'USDT', 'Tether USD', 6, 'usdt.png'),
  t(100, '0x6A023CCd1ff6F2045C3309768eAd9E68F978f6e1', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(100, '0x9C58BAcC331c9aa871AFD802DB6379a98e80CEdb', 'GNO', 'Gnosis', 18, 'gno.png'),

  t(146, NATIVE, 'S', 'Sonic', 18, 's.png'),
  t(146, '0x039e2fB66102314Ce7b64Ce5Ce3E5183bc94aD38', 'wS', 'Wrapped Sonic', 18, 's.png'),
  t(146, '0x29219dd400f2Bf60E5a23d13Be72B486D4038894', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(146, '0x50c42dEAcD8Fc9773493ED674b675bE577f2634b', 'WETH', 'Wrapped Ether', 18, 'eth.png'),

  t(130, NATIVE, 'ETH', 'Ether', 18, 'eth.png'),
  t(130, '0x4200000000000000000000000000000000000006', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(130, '0x078D782b760474a361dDA0AF3839290b0EF57AD6', 'USDC', 'USD Coin', 6, 'usdc.png'),
  t(130, '0x8f187aA05619a017077f5308904739877ce9eA21', 'UNI', 'Uniswap', 18, 'uni.png'),

  t(80094, NATIVE, 'BERA', 'Berachain', 18, 'bera.webp'),
  t(80094, '0x6969696969696969696969696969696969696969', 'WBERA', 'Wrapped BERA', 18, 'bera.webp'),
  t(80094, '0x549943e04f40284185054145c6E4e9568C1D3241', 'USDC.e', 'Bridged USDC', 6, 'usdc.png'),
  t(80094, '0x2F6F07CDcf3588944Bf4C42aC74ff24bF56e7590', 'WETH', 'Wrapped Ether', 18, 'eth.png'),
  t(80094, '0x0555E30da8f98308EdB960aa94C0Db47230d2B9c', 'WBTC', 'Wrapped BTC', 8, 'wbtc.png'),
];

export function isNative(address: string): boolean {
  const a = address.toLowerCase();
  return a === NATIVE || a === EEEE;
}

export function sameToken(a: string, b: string): boolean {
  return (isNative(a) && isNative(b)) || a.toLowerCase() === b.toLowerCase();
}

export const chainById = (id: number): Chain | undefined => CHAINS.find((c) => c.id === id);

export const tokensFor = (chainId: number): Token[] => TOKENS.filter((x) => x.chainId === chainId);

export const findToken = (chainId: number, address: string): Token | undefined =>
  TOKENS.find((x) => x.chainId === chainId && sameToken(x.address, address));

/** The address form a venue expects: its own native placeholder for the gas token, else unchanged. */
export const venueAddress = (address: Address, native: Address): Address => (isNative(address) ? native : address);

/** USDC when the chain has it, else its first dollar stablecoin, else the gas token. */
export const defaultToToken = (chainId: number): Address => {
  const tokens = tokensFor(chainId);
  return (tokens.find((x) => x.symbol === 'USDC') ?? tokens.find((x) => x.symbol.startsWith('USD')))?.address ?? NATIVE;
};

/** Case-insensitive match on symbol or name, or an exact address; best matches first. */
export function searchTokens(chainId: number, query: string): Token[] {
  const q = query.trim().toLowerCase();
  const tokens = tokensFor(chainId);
  if (!q) return tokens;
  const rank = (x: Token): number => {
    const symbol = x.symbol.toLowerCase();
    if (symbol === q || x.address.toLowerCase() === q) return 0;
    if (symbol.startsWith(q)) return 1;
    if (symbol.includes(q) || (x.name ?? '').toLowerCase().includes(q)) return 2;
    return 3;
  };
  return tokens
    .map((x, i) => ({ x, i, r: rank(x) }))
    .filter((e) => e.r < 3)
    .sort((a, b) => a.r - b.r || a.i - b.i)
    .map((e) => e.x);
}
