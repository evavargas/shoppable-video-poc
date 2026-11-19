# Merece demo store: brand and color system

This store (`widget/public/index.html`, `merece.css`, `merece.js`) adopts the identity of the Merece bakery. It is a **separate project** from the real Merece site: nothing is synced between them, and the real site was only read to capture the brand, the catalog and the prices.

## What was taken from Merece, and what was added

| | From Merece (kept) | Added here |
|---|---|---|
| Colors | brown `#3D2825`, deep brown `#2A1A18`, ivory `#FFFFF0`, sand `#F3EFDF`, lavender `#B9A5D6`, peach `#F0AE86` | text-safe lavender and peach, stronger control borders, status colors, dark-mode elevation steps, a brighter unlit neon |
| Type | Bagel Fat One (display), Gochi Hand (hand), Roboto Mono (body) | self-hosted `woff2` files (no third-party font request), `font-display: swap`, preload for the two used above the fold |
| Shape | pill buttons, `1rem` cards, the cup icon, the tilted wordmark | hover/active/disabled states for every button, forced-colors fallbacks |
| Themes | light by default, a toggle, no forced dark from the system | the choice is remembered, and the **widget follows it with no JavaScript** (see below) |
| Voice | rioplatense Spanish (voseo) | the widget itself now speaks Spanish on a Spanish page |

## Tokens

All colors live as CSS custom properties in `widget/public/merece.css`. Components never write a hex value.

| Token | Light | Dark | Role |
|---|---|---|---|
| `--bg` | `#FFFFF0` | `#2A1A18` | page |
| `--card` | `#FFFFFF` | `#3D2825` | elevation 1 |
| `--surface-2` | `#F3EFDF` | `#4A332F` | elevation 2 |
| `--fg` | `#3D2825` | `#FFFFF0` | text |
| `--muted-fg` | `#6B534F` | `#D9C9C0` | secondary text |
| `--border` / `--border-strong` | `#DDD5BE` / `#8A736E` | `#5A423D` / `#A28D87` | decoration / the edge of an input or control |
| `--primary` / `--on-primary` | `#3D2825` / `#FFFFF0` | `#B9A5D6` / `#3D2825` | main button (swaps with the theme) |
| `--accent` / `--accent-ink` | `#B9A5D6` / `#3D2825` | same | lavender fills, badges, "Elegir" buttons |
| `--accent-text` | `#5E4496` | `#B9A5D6` | lavender you can **read** as text |
| `--highlight` / `--highlight-ink` | `#F0AE86` / `#3D2825` | same | peach fills and favorites |
| `--highlight-text` | `#8F4418` | `#F0AE86` | peach you can **read** as text |
| `--danger` / `--success` / `--warning` | `#B3261E` / `#2F6B3F` / `#7A5000` | `#FF8A80` / `#86D69E` / `#F2C46B` | status |
| `--band` / `--band-fg` | `#3D2825` / `#FFFFF0` | `#241513` / `#FFFFF0` | dark sections (menu, neon signs) |
| `--ring` | `#3D2825` | `#B9A5D6` | focus ring |

Three decisions behind the changes:

- **Lavender and peach never carry text on ivory.** In the original rules they are only fills. This system adds two dedicated text colors (`--accent-text`, `--highlight-text`) so links and small labels can use the brand hues and still pass.
- **Control borders had 3.4:1; they now have 4.4:1** (light) so inputs and chips are clearly visible. Pure decoration (`--border`) stays soft on purpose.
- **Dark bands get deeper in dark mode** (`#241513` instead of the same brown as the cards). Before, cards on the brown band had the same color as the band and disappeared; now they lift off it by elevation.

## Contrast (WCAG 2.2, computed by `node scripts/contrast-table.mjs`)

Text needs 4.5:1, large text and the edge of a control need 3:1. Every pair below passes.

### Light

| Pair | Colors | Ratio | Needs | |
|---|---|---|---|---|
| Text on page | `#3d2825` on `#fffff0` | 13.6 | 4.5 | pass |
| Text on card | `#3d2825` on `#ffffff` | 13.7 | 4.5 | pass |
| Text on elevated surface | `#3d2825` on `#f3efdf` | 11.9 | 4.5 | pass |
| Muted text on page | `#6b534f` on `#fffff0` | 7.0 | 4.5 | pass |
| Muted text on elevated surface | `#6b534f` on `#f3efdf` | 6.1 | 4.5 | pass |
| Primary button label | `#fffff0` on `#3d2825` | 13.6 | 4.5 | pass |
| Text on lavender fill | `#3d2825` on `#b9a5d6` | 6.2 | 4.5 | pass |
| Text on peach fill | `#3d2825` on `#f0ae86` | 7.3 | 4.5 | pass |
| Lavender as text (accent-text) on page | `#5e4496` on `#fffff0` | 7.6 | 4.5 | pass |
| Lavender as text on card | `#5e4496` on `#ffffff` | 7.7 | 4.5 | pass |
| Peach as text (highlight-text) on page | `#8f4418` on `#fffff0` | 6.9 | 4.5 | pass |
| Peach as text on card | `#8f4418` on `#ffffff` | 7.0 | 4.5 | pass |
| Input and control border on page | `#8a736e` on `#fffff0` | 4.4 | 3 | pass |
| Input and control border on card | `#8a736e` on `#ffffff` | 4.4 | 3 | pass |
| Danger text on page | `#b3261e` on `#fffff0` | 6.5 | 4.5 | pass |
| Success text on page | `#2f6b3f` on `#fffff0` | 6.3 | 4.5 | pass |
| Warning text on page | `#7a5000` on `#fffff0` | 7.0 | 4.5 | pass |
| Text on dark band | `#fffff0` on `#3d2825` | 13.6 | 4.5 | pass |
| Neon peach, tube off, on band | `#ac7b61` on `#3d2825` | 3.8 | 3 | pass |
| Neon lavender, tube off, on band | `#8a7693` on `#3d2825` | 3.3 | 3 | pass |
| Focus ring on page | `#3d2825` on `#fffff0` | 13.6 | 3 | pass |

### Dark

| Pair | Colors | Ratio | Needs | |
|---|---|---|---|---|
| Text on page | `#fffff0` on `#2a1a18` | 16.5 | 4.5 | pass |
| Text on card | `#fffff0` on `#3d2825` | 13.6 | 4.5 | pass |
| Text on elevated surface | `#fffff0` on `#4a332f` | 11.5 | 4.5 | pass |
| Muted text on page | `#d9c9c0` on `#2a1a18` | 10.4 | 4.5 | pass |
| Muted text on elevated surface | `#d9c9c0` on `#4a332f` | 7.2 | 4.5 | pass |
| Primary button label | `#3d2825` on `#b9a5d6` | 6.2 | 4.5 | pass |
| Text on lavender fill | `#3d2825` on `#b9a5d6` | 6.2 | 4.5 | pass |
| Text on peach fill | `#3d2825` on `#f0ae86` | 7.3 | 4.5 | pass |
| Lavender as text (accent-text) on page | `#b9a5d6` on `#2a1a18` | 7.5 | 4.5 | pass |
| Lavender as text on card | `#b9a5d6` on `#3d2825` | 6.2 | 4.5 | pass |
| Peach as text (highlight-text) on page | `#f0ae86` on `#2a1a18` | 8.8 | 4.5 | pass |
| Peach as text on card | `#f0ae86` on `#3d2825` | 7.3 | 4.5 | pass |
| Input and control border on page | `#a28d87` on `#2a1a18` | 5.3 | 3 | pass |
| Input and control border on card | `#a28d87` on `#3d2825` | 4.4 | 3 | pass |
| Danger text on page | `#ff8a80` on `#2a1a18` | 7.3 | 4.5 | pass |
| Success text on page | `#86d69e` on `#2a1a18` | 9.6 | 4.5 | pass |
| Warning text on page | `#f2c46b` on `#2a1a18` | 10.2 | 4.5 | pass |
| Text on dark band | `#fffff0` on `#241513` | 17.5 | 4.5 | pass |
| Neon peach, tube off, on band | `#a2745a` on `#241513` | 4.3 | 3 | pass |
| Neon lavender, tube off, on band | `#806e8c` on `#241513` | 3.8 | 3 | pass |
| Focus ring on page | `#b9a5d6` on `#2a1a18` | 7.5 | 3 | pass |


The neon signs are decorative (`aria-hidden`, the real heading is a separate `h2`), but they are legible even with the tube "off" (3.3:1) instead of fading into the band.

## Theming the widget from the outside

The widget lives in a Shadow DOM, so the store's CSS cannot reach into it. **Custom properties are the exception: they inherit across the shadow boundary.** The widget reads a small public contract, all optional (neutral defaults are built in):

| Variable | What it controls |
|---|---|
| `--poc-accent`, `--poc-accent-ink`, `--poc-accent-text` | main buttons, selected states, links |
| `--poc-surface`, `--poc-ink`, `--poc-muted` | panels, sheets and the product bar under the video |
| `--poc-line`, `--poc-line-strong` | separators and the edge of selects |
| `--poc-highlight`, `--poc-highlight-ink` | the pinned-product card |
| `--poc-band`, `--poc-band-ink` | the live panel (chat and poll) |
| `--poc-skeleton` | loading placeholders |
| `--poc-radius`, `--poc-pill` | corner radius of cards and of buttons |
| `--poc-font`, `--poc-font-display` | body font and the font of titles and product names |

`merece.css` maps its own tokens to these in `:root` and again under `html.dark`, so toggling the theme class restyles the widget instantly. No JavaScript talks to it. The `theme.accent` color in the Firestore config is only the fallback when the page sets none.

## Language

`<html lang="es-UY">` (or `data-lang` on the widget's div) makes the widget Spanish: buttons, screen-reader labels, the live panel and the price format (`$ 1.250,00`). One build serves both languages (`widget/src/i18n.ts`).
