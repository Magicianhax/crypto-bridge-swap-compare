import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Crypto Bridge & Swap Compare',
    description:
      'Compare swap and bridge quotes from Jumper, Jumper Advanced, Bungee, Relay, Matcha, KyberSwap, Uniswap and LlamaSwap, fees included.',
    permissions: ['sidePanel', 'storage'],
    host_permissions: [
      'https://jumper.xyz/*',
      'https://www.bungee.exchange/*',
      'https://relay.link/*',
      'https://matcha.xyz/*',
      'https://kyberswap.com/*',
      'https://app.uniswap.org/*',
      'https://swap.defillama.com/*',
    ],
    action: { default_title: 'Crypto Bridge & Swap Compare', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
});
