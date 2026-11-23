// Prints the WCAG contrast table used in docs/BRAND.md. Token values are copied from widget/public/merece.css.
const lum = (hex) => { const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]; };
const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => Math.round(parseInt(a.slice(i, i + 2), 16) * t + parseInt(b.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');

const light = { bg: '#fffff0', fg: '#3d2825', card: '#ffffff', sand: '#f3efdf', muted: '#6b534f', primary: '#3d2825', onPrimary: '#fffff0', lav: '#b9a5d6', peach: '#f0ae86', accentText: '#5e4496', hlText: '#8f4418', borderStrong: '#8a736e', danger: '#b3261e', success: '#2f6b3f', warning: '#7a5000', band: '#3d2825', bandFg: '#fffff0', carta: '#fce8da', cartaFg: '#3d2825', titleAccent: '#6a4c9c', tile: '#ffffff', zonas: '#eee8f7', drip: '#fffff0', cierre: '#fce8da', footer: '#f3efdf', drawer: '#fffff0', btn: '#b9a5d6' };
const dark = { bg: '#2a1a18', fg: '#fffff0', card: '#3d2825', sand: '#4a332f', muted: '#d9c9c0', primary: '#f0ae86', onPrimary: '#3d2825', lav: '#b9a5d6', peach: '#f0ae86', accentText: '#b9a5d6', hlText: '#f0ae86', borderStrong: '#a28d87', danger: '#ff8a80', success: '#86d69e', warning: '#f2c46b', band: '#241513', bandFg: '#fffff0', carta: '#56261c', cartaFg: '#fffff0', titleAccent: '#b9a5d6', tile: '#f0e2c8', zonas: '#5c3828', drip: '#7a4024', cierre: '#efe0b8', footer: '#5c3828', drawer: '#5c3828', btn: '#f0ae86' };
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
    row('Text on button (lavender / peach fill)', '#3d2825', T.btn, 4.5),
    row('Title on the carta (ink, unlit 90%)', mix(T.cartaFg, T.carta, 0.9), T.carta, 3), row('Lavender title on the carta (unlit 90%)', mix(T.titleAccent, T.carta, 0.9), T.carta, 3),
    row('Lavender title on the hero color (unlit 90%)', mix(T.titleAccent, T.drip, 0.9), T.drip, 3),
    row('Text on product card / tile', '#3d2825', T.tile, 4.5), row('Muted text on product card / tile', '#6b534f', T.tile, 4.5), row('Card note (#5e4496) on card / tile', '#5e4496', T.tile, 4.5),
    row('Text on lavender zones section', T.fg, T.zonas, 4.5), row('Text on footer', T.fg, T.footer, 4.5), row('Muted text on footer', T.muted, T.footer, 4.5),
    row('Footer link on footer', label === 'Light' ? T.accentText : T.hlText, T.footer, 4.5), row('Text on drawer', T.fg, T.drawer, 4.5), row('Muted text on drawer', T.muted, T.drawer, 4.5),
    row('Text on closing section', '#3d2825', T.cierre, 4.5),
    row('Focus ring on page', label === 'Light' ? '#3d2825' : '#b9a5d6', T.bg, 3),
  ];
  console.log(rows.join('\n'));
}
