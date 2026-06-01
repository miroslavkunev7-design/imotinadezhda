import { envCreds, buildDescription, getImageUrls, downloadImages } from './_helpers.js';
import path from 'node:path';

export const olxBg = {
  getCredentials: () => envCreds('OLX_BG_EMAIL', 'OLX_BG_PASSWORD'),
  async publish({ page, property, credentials }) {
    await page.goto('https://www.olx.bg/account/', { waitUntil: 'domcontentloaded' });
    // TODO: login + /posting/ flow с категория Недвижими имоти
    throw new Error('olx.bg publisher: селекторите още не са конфигурирани');
  },
};
