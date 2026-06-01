import { envCreds, buildDescription, getImageUrls, downloadImages } from './_helpers.js';
import path from 'node:path';

// ⚠️ СЕЛЕКТОРИ — placeholder. Настрой ги при първо стартиране с HEADLESS=false.
// Реалните URL/селектори трябва да се потвърдят с реален акаунт.

export const imotBg = {
  getCredentials: () => envCreds('IMOT_BG_EMAIL', 'IMOT_BG_PASSWORD'),

  async publish({ page, property, credentials }) {
    // 1. Login
    await page.goto('https://www.imot.bg/login', { waitUntil: 'domcontentloaded' });
    if (await page.locator('input[name="usr"]').count()) {
      await page.fill('input[name="usr"]', credentials.email);
      await page.fill('input[name="pwd"]', credentials.password);
      await page.click('input[type="submit"]');
      await page.waitForLoadState('networkidle');
    }

    // 2. Нова обява
    await page.goto('https://www.imot.bg/pcgi/imot.cgi?act=8&act1=1', { waitUntil: 'domcontentloaded' });

    // 3. TODO: попълни формата според реалната структура
    // await page.selectOption('select[name="ime_grad"]', property.cities?.name ?? '');
    // await page.fill('input[name="cena"]', String(property.price));
    // await page.fill('input[name="kvadratura"]', String(property.area_sqm ?? ''));
    // await page.fill('textarea[name="text"]', buildDescription(property));

    // 4. Снимки
    // const imgs = await downloadImages(getImageUrls(property), path.join('sessions', '_tmp_imot'));
    // await page.setInputFiles('input[type="file"]', imgs);

    // 5. Submit
    // await page.click('input[type="submit"][value*="Публикувай"]');
    // await page.waitForLoadState('networkidle');

    throw new Error('imot.bg publisher: селекторите още не са конфигурирани — виж коментарите в публикатора');
    // return { url: page.url() };
  },
};
