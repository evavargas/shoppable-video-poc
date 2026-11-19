// Turns scripts/merece-catalog.json into Shopify-shaped storefront files:
//   widget/public/products/{handle}.js   what the widget reads (like Shopify's /products/{handle}.js, prices in cents)
//   widget/public/products.json          what the demo page reads for its grid (like Shopify's /products.json)
// Every combination of a product's options becomes a variant, exactly like Shopify does.
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', 'widget', 'public');
const catalog = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'merece-catalog.json'), 'utf8'));
const dir = join(root, 'products');
mkdirSync(dir, { recursive: true });
for (const f of readdirSync(dir)) if (f.endsWith('.js')) rmSync(join(dir, f)); // regenerate from scratch

const cartesian = (lists) => lists.reduce((acc, list) => acc.flatMap((a) => list.map((v) => [...a, v])), [[]]);
let variantId = 51000;
let productId = 7000;
const all = [];

for (const [i, p] of catalog.products.entries()) {
  const opts = (p.options ?? []).map((k) => catalog.options[k]);
  const combos = opts.length ? cartesian(opts.map((o) => o.values)) : [[]];
  const available = p.available !== false;
  const variants = combos.map((values, n) => ({
    id: variantId++,
    title: values.length ? values.join(' / ') : 'Default Title',
    option1: values[0] ?? null,
    option2: values[1] ?? null,
    option3: values[2] ?? null,
    available,
    price: p.price * 100,
    position: n + 1,
  }));
  const product = {
    id: productId++,
    handle: p.handle,
    title: p.title,
    description: p.description ?? '',
    product_type: p.type,
    tags: [p.type, ...(p.advanceHours ? [`anticipacion-${p.advanceHours}h`] : [])],
    price: p.price * 100,
    available,
    featured_image: p.image ? `/media/merece/products/${p.image}.jpg` : null,
    options: opts.length ? opts.map((o, n) => ({ name: o.name, position: n + 1, values: o.values })) : [{ name: 'Title', position: 1, values: ['Default Title'] }],
    variants,
    position: i + 1,
  };
  writeFileSync(join(dir, `${p.handle}.js`), JSON.stringify(product, null, 2) + '\n');
  all.push(product);
}

writeFileSync(join(root, 'products.json'), JSON.stringify({ currency: catalog.currency, products: all }, null, 1) + '\n');
console.log(`${all.length} products, ${variantId - 51000} variants`);
