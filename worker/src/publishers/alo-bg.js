import { envCreds } from './_helpers.js';
export const aloBg = {
  getCredentials: () => envCreds('ALO_BG_EMAIL', 'ALO_BG_PASSWORD'),
  async publish({ page, property, credentials }) {
    await page.goto('https://www.alo.bg/login', { waitUntil: 'domcontentloaded' });
    throw new Error('alo.bg publisher: селекторите още не са конфигурирани');
  },
};
