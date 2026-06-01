import { envCreds } from './_helpers.js';
export const homeBg = {
  getCredentials: () => envCreds('HOME_BG_EMAIL', 'HOME_BG_PASSWORD'),
  async publish({ page, property, credentials }) {
    await page.goto('https://www.home.bg/login', { waitUntil: 'domcontentloaded' });
    throw new Error('home.bg publisher: селекторите още не са конфигурирани');
  },
};
