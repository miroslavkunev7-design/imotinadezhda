// Общи помощни функции за всички публикатори

export function envCreds(emailKey, passKey) {
  const email = process.env[emailKey];
  const password = process.env[passKey];
  if (!email || !password) return null;
  return { email, password };
}

export function buildDescription(property) {
  const parts = [
    property.description || property.title,
    '',
    property.area_sqm ? `Площ: ${property.area_sqm} м²` : null,
    property.rooms ? `Стаи: ${property.rooms}` : null,
    property.floor ? `Етаж: ${property.floor}${property.total_floors ? '/' + property.total_floors : ''}` : null,
    property.year_built ? `Година: ${property.year_built}` : null,
    property.address ? `Адрес: ${property.address}` : null,
    '',
    '— Агенция Имоти Надежда',
    'https://imotinadezhda.bg',
  ].filter(Boolean);
  return parts.join('\n');
}

export function getImageUrls(property) {
  const imgs = (property.property_images || [])
    .sort((a, b) => Number(b.is_cover) - Number(a.is_cover) || (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((i) => i.url);
  if (property.cover_image_url && !imgs.includes(property.cover_image_url)) {
    imgs.unshift(property.cover_image_url);
  }
  return imgs.slice(0, 20);
}

export async function downloadImages(urls, dir) {
  const fs = await import('node:fs/promises');
  const path = await import('node:path');
  await fs.mkdir(dir, { recursive: true });
  const paths = [];
  for (const [i, url] of urls.entries()) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ext = url.split('.').pop()?.split('?')[0]?.slice(0, 4) || 'jpg';
      const p = path.join(dir, `${i}.${ext}`);
      await fs.writeFile(p, buf);
      paths.push(p);
    } catch (e) {
      console.warn('Image download fail:', url, e.message);
    }
  }
  return paths;
}
