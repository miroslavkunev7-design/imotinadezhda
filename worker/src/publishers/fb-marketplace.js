import { envCreds } from './_helpers.js';
export const fbMarketplace = {
  getCredentials: () => envCreds('FB_EMAIL', 'FB_PASSWORD'),
  async publish({ page, property, credentials }) {
    await page.goto('https://www.facebook.com/login', { waitUntil: 'domcontentloaded' });
    // ⚠️ Facebook агресивно блокира автоматизация — нужни са допълнителни мерки (residential proxy, ръчно потвърждение).
    throw new Error('Facebook Marketplace: автоматизацията е рискова — препоръчвам ръчно публикуване');
  },
};
