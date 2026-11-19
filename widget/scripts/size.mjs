import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

for (const f of ['widget.js', 'live.js']) {
  const buf = readFileSync(new URL(`../dist/${f}`, import.meta.url));
  console.log(`${f}: ${(buf.length / 1024).toFixed(1)} KB raw, ${(gzipSync(buf).length / 1024).toFixed(1)} KB gzip`);
}
