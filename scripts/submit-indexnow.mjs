// Pings IndexNow (Bing, Yandex, Seznam, Naver — NOT Google, which has its own
// separate pipeline via Search Console) with every URL in the just-built
// sitemap, so those engines pick up new/changed pages in hours instead of
// waiting for their next scheduled crawl.
//
//   node scripts/prerender.mjs   (writes dist/sitemap.xml)
//   node scripts/submit-indexnow.mjs
//
// Safe to run after every deploy — IndexNow de-dupes on its end, so
// resubmitting unchanged URLs is a no-op, not a penalty.
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const SITE = 'https://www.whatdstuff.com';
const HOST = 'www.whatdstuff.com';

const keyFile = readdirSync(resolve('public')).find((f) => /^[0-9a-f]{32}\.txt$/.test(f));
if (!keyFile) {
  console.error('no IndexNow key file found in public/ (expected a 32-char hex .txt file)');
  process.exit(1);
}
const key = keyFile.replace('.txt', '');

const sitemapPath = resolve('dist/sitemap.xml');
if (!existsSync(sitemapPath)) {
  console.error('dist/sitemap.xml not found — run scripts/prerender.mjs first');
  process.exit(1);
}
const xml = readFileSync(sitemapPath, 'utf8');
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

if (!urlList.length) {
  console.error('sitemap had no <loc> entries — nothing to submit');
  process.exit(1);
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    host: HOST,
    key,
    keyLocation: `${SITE}/${keyFile}`,
    urlList,
  }),
});

console.log(`submitted ${urlList.length} URLs — IndexNow responded ${res.status} ${res.statusText}`);
if (res.status >= 400) {
  console.error(await res.text().catch(() => ''));
  process.exit(1);
}
