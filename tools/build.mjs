// Builds the static site: node tools/build.mjs
// Pages in src/pages use <!-- include:name --> to pull in src/partials/name.html,
// or the generated swatch groups (finish-swatches) built from src/data/swatches.json.
// Output goes to public/, together with a copy of assets/.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, rmSync, cpSync } from 'node:fs';
import { join, basename } from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const out = join(root, 'public');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

const data = JSON.parse(readFileSync(join(root, 'src/data/swatches.json'), 'utf8'));
const generated = {
  // Finish tabs on the products page, as on the original site: Mill finish, Brushed, Bright.
  // Each panel shows the finish photo and its shades. Without JavaScript all panels stay visible.
  'finish-tabs': () => {
    const keys = Object.keys(data.finishes);
    const tabs = keys.map((key, i) =>
      `          <button class="tab" type="button" role="tab" id="tab-${key}" aria-controls="panel-${key}" aria-selected="${i === 0}"${i === 0 ? '' : ' tabindex="-1"'}>${esc(data.finishes[key].label)}</button>`).join('\n');
    const panels = keys.map((key) => {
      const f = data.finishes[key];
      const items = data.swatches[key].map((s, n, all) =>
        `              <li><button class="swatch-button" type="button" data-sample="${s.image}" aria-label="Preview ${esc(f.label)} shade ${n + 1} of ${all.length}" aria-pressed="false"><img src="${s.image}" alt="" width="300" height="300" loading="lazy"></button></li>`).join('\n');
      return `        <div class="tab-panel" tabindex="0" role="tabpanel" id="panel-${key}" aria-labelledby="tab-${key}">
          <figure class="tab-finish">
            <img class="rounded" src="${f.image}" alt="${esc(f.imageAlt)}" width="420" height="420" loading="lazy">
            <figcaption><h3>${esc(f.label)}</h3><p>${esc(f.desc)}</p></figcaption>
          </figure>
          <div class="tab-shades">
            <ul class="chart-grid" aria-label="${esc(f.label)} shades">
${items}
            </ul>
          </div>
        </div>`;
    }).join('\n');
    return `      <div class="finish-tabs" data-tabs>
        <div class="tablist" role="tablist" aria-label="Finishes">
${tabs}
        </div>
${panels}
      </div>`;
  },
};

const partial = (name) => generated[name]
  ? generated[name]()
  : readFileSync(join(root, 'src/partials', `${name}.html`), 'utf8').replace(/\n$/, '');

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(join(root, 'assets'), join(out, 'assets'), { recursive: true });

// {{v:path}} becomes path?v=<content hash>, so browsers fetch the new file after each publish
const hashes = {};
const site = 'https://www.overland-aluminium.com';
const indexed = [];
const versioned = (path) => `${path}?v=${hashes[path] ??= createHash('sha1').update(readFileSync(join(root, path))).digest('hex').slice(0, 8)}`;

for (const file of readdirSync(join(root, 'src/pages')).filter((f) => f.endsWith('.html'))) {
  const page = basename(file, '.html');
  let html = readFileSync(join(root, 'src/pages', file), 'utf8');
  html = html.replace(/<!-- include:([\w-]+) -->/g, (_, name) => partial(name));
  // Mark the current page in the navigation
  html = html.replace(new RegExp(`data-page="${page}"`, 'g'), `data-page="${page}" aria-current="page"`);
  html = html.replace(/\{\{v:([^}]+)\}\}/g, (_, path) => versioned(path));
  // Link previews (WhatsApp, LinkedIn, email): page title unless the page sets its own, one shared image
  const url = `${site}/${file === 'index.html' ? '' : file}`;
  const title = html.match(/<title>([^<]*)<\/title>/)[1];
  html = html.replace('</head>', `${html.includes('property="og:title"') ? '' : `  <meta property="og:title" content="${title}">\n`}  <meta property="og:type" content="website">
  <meta property="og:site_name" content="Overland Anodized Aluminium">
  <meta property="og:url" content="${url}">
  <meta property="og:image" content="${site}/assets/img/share.jpg">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="Overland logo next to stacked aluminium coils">
  <meta name="twitter:card" content="summary_large_image">
  <link rel="canonical" href="${url}">
</head>`);
  writeFileSync(join(out, file), html);
  if (!html.includes('name="robots" content="noindex')) indexed.push(file === 'index.html' ? '' : file);
  console.log('built', file);
}

// Sitemap and robots.txt for search engines, listing every page that is not marked noindex
writeFileSync(join(out, 'sitemap.xml'), `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${indexed.map((path) => `  <url><loc>${site}/${path}</loc></url>`).join('\n')}
</urlset>
`);
writeFileSync(join(out, 'robots.txt'), `User-agent: *\nAllow: /\n\nSitemap: ${site}/sitemap.xml\n`);
