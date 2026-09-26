// Checks every link, image, video and anchor in the built site against the local server.
// Run with the preview server on: node tools/check-links.mjs
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const pub = join(root, 'public');
const base = `http://localhost:${process.env.PORT || 5173}`;

const pages = [];
const styles = [];
(function walk(dir) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.html')) pages.push(p);
    else if (f.endsWith('.css')) styles.push(p);
  }
})(pub);

const bad = [];
let count = 0;
const cache = new Map();
const get = async (url) => {
  if (!cache.has(url)) cache.set(url, fetch(url).then(async (r) => ({ status: r.status, text: r.headers.get('content-type')?.includes('html') ? await r.text() : '' })));
  return cache.get(url);
};

for (const p of pages) {
  // Resolve links against the page's own address; works for both page.html and folder/index.html layouts
  const pageUrl = '/' + relative(pub, p).split('\\').join('/');
  const html = readFileSync(p, 'utf8');
  if (html.includes('<!-- include:')) bad.push(`${pageUrl}: unresolved include`);
  const refs = [...html.matchAll(/(?:href|src|poster)="([^"]+)"/g), ...html.matchAll(/url\(([^)]+)\)/g)]
    .map((m) => m[1]).filter((u) => !/^(https?:|mailto:|tel:)/.test(u));
  for (const u of refs) {
    count++;
    const full = new URL(u, base + pageUrl);
    const target = full.href.split('#')[0];
    const res = await get(target);
    if (res.status !== 200) { bad.push(`${pageUrl} -> ${u} (${res.status})`); continue; }
    if (full.hash && !res.text.includes(`id="${full.hash.slice(1)}"`)) bad.push(`${pageUrl} -> ${u} (anchor missing)`);
  }
}

// Fonts and background images are part of the site too. Resolve CSS URLs
// relative to their stylesheet, so a missing local font fails the check.
for (const p of styles) {
  const stylesheetUrl = '/' + relative(pub, p).split('\\').join('/');
  const css = readFileSync(p, 'utf8');
  for (const match of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
    const ref = match[1];
    if (/^(?:https?:|data:|#)/.test(ref)) continue;
    count++;
    const url = new URL(ref, base + stylesheetUrl);
    const response = await get(url.href);
    if (response.status !== 200) bad.push(`${stylesheetUrl} -> ${ref} (${response.status})`);
  }
}

console.log(`pages: ${pages.length}, references: ${count}`);
console.log(bad.length ? bad.join('\n') : 'all ok');

const html = pages.map((p) => readFileSync(p, 'utf8')).join('');
const unused = readdirSync(join(root, 'assets/img/site')).filter((f) => !html.includes(f));
console.log('unused site photos:', unused.length ? unused.join(', ') : 'none');
process.exitCode = bad.length || unused.length ? 1 : 0;
