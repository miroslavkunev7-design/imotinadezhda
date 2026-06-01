import { envCreds } from './_helpers.js';
export const bazarBg = {
  getCredentials: () => envCreds('BAZAR_BG_EMAIL', 'BAZAR_BG_PASSWORD'),
  async publish({ page, property, credentials }) {
    await page.goto('https://www.bazar.bg/login', { waitUntil: 'domcontentloaded' });
    throw new Error('bazar.bg publisher: селекторите още не са конфигурирани');
  },
};
