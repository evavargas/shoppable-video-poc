// Prints the WCAG contrast table used in docs/BRAND.md. Token values are copied from widget/public/merece.css.
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');

const light = { bg: '#fffff0', fg: '#3d2825', card: '#ffffff', sand: '#f3efdf', muted: '#6b534f', primary: '#3d2825', onPrimary: '#fffff0', lav: '#b9a5d6', peach: '#f0ae86', accentText: '#5e4496', hlText: '#8f4418', borderStrong: '#8a736e', danger: '#b3261e', success: '#2f6b3f', warning: '#7a5000', band: '#3d2825', bandFg: '#fffff0' };
const dark = { bg: '#2a1a18', fg: '#fffff0', card: '#3d2825', sand: '#4a332f', muted: '#d9c9c0', primary: '#b9a5d6', onPrimary: '#3d2825', lav: '#b9a5d6', peach: '#f0ae86', accentText: '#b9a5d6', hlText: '#f0ae86', borderStrong: '#a28d87', danger: '#ff8a80', success: '#86d69e', warning: '#f2c46b', band: '#241513', bandFg: '#fffff0' };
const row = (name, a, b, need) => { const r = ratio(a, b); return `| ${name} | \`${a}\` on \`${b}\` | ${r.toFixed(1)} | ${need} | ${r >= need ? 'pass' : 'FAIL'} |`; };

for (const [label, T] of [['Light', light], ['Dark', dark]]) {
  console.log(`\n### ${label}\n\n| Pair | Colors | Ratio | Needs | |\n|---|---|---|---|---|`);
  const rows = [
    row('Text on page', T.fg, T.bg, 4.5), row('Text on card', T.fg, T.card, 4.5), row('Text on elevated surface', T.fg, T.sand, 4.5),
    row('Muted text on page', T.muted, T.bg, 4.5), row('Muted text on elevated surface', T.muted, T.sand, 4.5),
    row('Primary button label', T.onPrimary, T.primary, 4.5),
    row('Text on lavender fill', '#3d2825', T.lav, 4.5), row('Text on peach fill', '#3d2825', T.peach, 4.5),
    row('Lavender as text (accent-text) on page', T.accentText, T.bg, 4.5), row('Lavender as text on card', T.accentText, T.card, 4.5),
    row('Peach as text (highlight-text) on page', T.hlText, T.bg, 4.5), row('Peach as text on card', T.hlText, T.card, 4.5),
    row('Input and control border on page', T.borderStrong, T.bg, 3), row('Input and control border on card', T.borderStrong, T.card, 3),
    row('Danger text on page', T.danger, T.bg, 4.5), row('Success text on page', T.success, T.bg, 4.5), row('Warning text on page', T.warning, T.bg, 4.5),
    row('Text on dark band', T.bandFg, T.band, 4.5),
    row('Neon peach, tube off, on band', mix(T.peach, T.band, 0.62), T.band, 3), row('Neon lavender, tube off, on band', mix(T.lav, T.band, 0.62), T.band, 3),
    row('Focus ring on page', label === 'Light' ? '#3d2825' : '#b9a5d6', T.bg, 3),
  ];
  console.log(rows.join('\n'));
}
