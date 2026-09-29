import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Quote Compare',
    description:
      "Compare swap and bridge quotes from Jumper, Jumper Advanced, Bungee, Relay and Matcha, read from each site's own page.",
    permissions: ['sidePanel', 'storage'],
    host_permissions: [
      'https://jumper.xyz/*',
      'https://app.bungee.exchange/*',
      'https://relay.link/*',
      'https://matcha.xyz/*',
    ],
    action: { default_title: 'Quote Compare', default_icon: { 16: 'icon/16.png', 32: 'icon/32.png', 48: 'icon/48.png', 128: 'icon/128.png' } },
  },
});
