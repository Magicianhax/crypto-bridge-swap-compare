import { defineConfig } from 'wxt';

export default defineConfig({
  manifest: {
    name: 'Quote Compare',
    description:
      "Compare swap and bridge quotes from Jumper, Jumper Advanced, Bungee, Relay and Matcha, read from each site's own page.",
    permissions: ['sidePanel', 'storage', 'tabs'],
    host_permissions: [
      'https://jumper.xyz/*',
      'https://app.bungee.exchange/*',
      'https://relay.link/*',
      'https://matcha.xyz/*',
    ],
    action: { default_title: 'Quote Compare' },
  },
});
