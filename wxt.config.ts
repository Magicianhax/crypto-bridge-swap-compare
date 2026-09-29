import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Crypto Bridge & Swap Compare',
    description:
      'Compare crypto swap and bridge quotes from Jumper, Jumper Advanced, Bungee, Relay and Matcha side by side, fees included.',
    permissions: ['sidePanel', 'storage'],
    host_permissions: [
      'https://jumper.xyz/*',
      'https://app.bungee.exchange/*',
      'https://relay.link/*',
      'https://matcha.xyz/*',
    ],
    action: { default_title: 'Crypto Bridge & Swap Compare', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
});
