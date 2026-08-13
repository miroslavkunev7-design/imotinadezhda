import { envCreds, buildDescription, getImageUrls, downloadImages } from './_helpers.js';
import path from 'node:path';

export const imotiNet = {
  getCredentials: () => envCreds('IMOTI_NET_EMAIL', 'IMOTI_NET_PASSWORD'),
  async publish({ page, property, credentials }) {
    await page.goto('https://www.imoti.net/bg/login', { waitUntil: 'domcontentloaded' });
    // TODO: login + add-listing flow
    throw new Error('imoti.net publisher: селекторите още не са конфигурирани');
  },
};
