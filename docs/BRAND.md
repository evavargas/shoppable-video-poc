# Merece demo store: brand and color system

This store (`widget/public/index.html`, `merece.css`, `merece.js`) adopts the identity of the Merece bakery. It is a **separate project** from the real Merece site: nothing is synced between them, and the real site was only read to capture the brand, the catalog and the prices.

## What was taken from Merece, and what was added

| | From Merece (kept) | Added here |
|---|---|---|
| Colors | brown `#3D2825`, deep brown `#2A1A18`, ivory `#FFFFF0`, sand `#F3EFDF`, lavender `#B9A5D6`, peach `#F0AE86` | text-safe lavender and peach, stronger control borders, status colors, dark-mode elevation steps, a soft "neon" for the hand-lettered titles |
| Type | Bagel Fat One (display), Gochi Hand (hand), Roboto Mono (body) | self-hosted `woff2` files (no third-party font request), `font-display: swap`, preload for the two used above the fold |
| Shape | pill buttons, `1rem` cards, the cup icon, the wordmark (a lavender-topped M, then "erece") | hover/active/disabled states for every button, forced-colors fallbacks |
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
| `--primary` / `--on-primary` | `#3D2825` / `#FFFFF0` | `#F0AE86` / `#3D2825` | toast and small solid UI (swaps with the theme) |
| `--btn-accent` / `--on-color` | `#B9A5D6` / `#3D2825` | `#F0AE86` / `#3D2825` | **every main button** ("Elegir", "Enviar pedido"): lavender in light, peach in dark, like the Merece site |
| `--accent` / `--accent-ink` | `#B9A5D6` / `#3D2825` | same | lavender fills, badges, "Elegir" buttons |
| `--accent-text` | `#5E4496` | `#B9A5D6` | lavender you can **read** as text |
| `--highlight` / `--highlight-ink` | `#F0AE86` / `#3D2825` | same | peach fills and favorites |
| `--highlight-text` | `#8F4418` | `#F0AE86` | peach you can **read** as text |
| `--danger` / `--success` / `--warning` | `#B3261E` / `#2F6B3F` / `#7A5000` | `#FF8A80` / `#86D69E` / `#F2C46B` | status |
| `--band` / `--band-fg` | `#3D2825` / `#FFFFF0` | `#241513` / `#FFFFF0` | the demo strip and the widget's live panel |
| `--ring` | `#3D2825` | `#B9A5D6` | focus ring |

### Section colors (refreshed from the current Merece site, Nov 2026)

The Merece site changed from a dark brown menu band with neon signs to a **peach menu with drips**. The store follows it, in both themes:

| Token | Light | Dark | Where |
|---|---|---|---|
| `--carta` / `--carta-fg` | `#FCE8DA` / `#3D2825` | `#56261C` / `#FFFFF0` | the menu section |
| `--drip` | = `--bg` (ivory) | `#7A4024` | hero + video row, and the drips that fall into the menu |
| `--tile-card` | `#FFFFFF` | `#F0E2C8` | product cards (they stay light in dark mode, text stays brown) |
| `--tile-step` / `--tile-panel` | menu peach / ivory | `#F0E2C8` | step tiles, zone list |
| `--pasos` | ivory | `#7A4024` | "Pedí en tres pasos" (a gradient from the menu fades into it) |
| `--zonas` | `#EEE8F7` | `#5C3828` | delivery zones |
| `--cierre` | `#FCE8DA` | `#EFE0B8` | closing section between two wavy edges |
| `--footer` / `--drawer` | sand / ivory | `#5C3828` | footer, cart drawer and dialogs |
| `--scrim` | `#3D282566` | `#0F08069E` | behind dialogs |
| `--title-accent` | `#6A4C9C` | `#B9A5D6` | lavender hand-lettered titles on the menu |

The hand-lettered titles are no longer glowing tubes on a dark band: they are solid ink on the section color that lights a little (soft glow) when they scroll into view, and sit still under `prefers-reduced-motion`. Each title has wavy lines at its sides.

The widget follows the same colors through the `--poc-*` contract: its buttons now use `--btn-accent` (lavender / peach) with brown text, and its focus ring uses `--poc-ring` (brown / lavender) because lavender alone is too weak as a focus indicator on ivory.

Three decisions behind the changes:

- **Lavender and peach never carry text on ivory.** In the original rules they are only fills. This system adds two dedicated text colors (`--accent-text`, `--highlight-text`) so links and small labels can use the brand hues and still pass.
- **Control borders had 3.4:1; they now have 4.4:1** (light) so inputs and chips are clearly visible. Pure decoration (`--border`) stays soft on purpose.
- **Cards stay light in dark mode** (`--tile-card`), as on the Merece site, so photos and brown text keep a strong contrast; the sections around them get warmer browns (`--carta`, `--drip`, `--zonas`).

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
| Text on button (lavender / peach fill) | `#3d2825` on `#b9a5d6` | 6.2 | 4.5 | pass |
| Title on the carta (ink, unlit 90%) | `#503b37` on `#fce8da` | 8.8 | 3 | pass |
| Lavender title on the carta (unlit 90%) | `#795ca2` on `#fce8da` | 4.6 | 3 | pass |
| Lavender title on the hero color (unlit 90%) | `#795ea4` on `#fffff0` | 5.3 | 3 | pass |
| Text on product card / tile | `#3d2825` on `#ffffff` | 13.7 | 4.5 | pass |
| Muted text on product card / tile | `#6b534f` on `#ffffff` | 7.1 | 4.5 | pass |
| Card note (#5e4496) on card / tile | `#5e4496` on `#ffffff` | 7.7 | 4.5 | pass |
| Text on lavender zones section | `#3d2825` on `#eee8f7` | 11.5 | 4.5 | pass |
| Text on footer | `#3d2825` on `#f3efdf` | 11.9 | 4.5 | pass |
| Muted text on footer | `#6b534f` on `#f3efdf` | 6.1 | 4.5 | pass |
| Footer link on footer | `#5e4496` on `#f3efdf` | 6.6 | 4.5 | pass |
| Text on drawer | `#3d2825` on `#fffff0` | 13.6 | 4.5 | pass |
| Muted text on drawer | `#6b534f` on `#fffff0` | 7.0 | 4.5 | pass |
| Text on closing section | `#3d2825` on `#fce8da` | 11.6 | 4.5 | pass |
| Focus ring on page | `#3d2825` on `#fffff0` | 13.6 | 3 | pass |

### Dark

| Pair | Colors | Ratio | Needs | |
|---|---|---|---|---|
| Text on page | `#fffff0` on `#2a1a18` | 16.5 | 4.5 | pass |
| Text on card | `#fffff0` on `#3d2825` | 13.6 | 4.5 | pass |
| Text on elevated surface | `#fffff0` on `#4a332f` | 11.5 | 4.5 | pass |
| Muted text on page | `#d9c9c0` on `#2a1a18` | 10.4 | 4.5 | pass |
| Muted text on elevated surface | `#d9c9c0` on `#4a332f` | 7.2 | 4.5 | pass |
| Primary button label | `#3d2825` on `#f0ae86` | 7.3 | 4.5 | pass |
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
| Text on button (lavender / peach fill) | `#3d2825` on `#f0ae86` | 7.3 | 4.5 | pass |
| Title on the carta (ink, unlit 90%) | `#eee9db` on `#56261c` | 10.2 | 3 | pass |
| Lavender title on the carta (unlit 90%) | `#af98c3` on `#56261c` | 4.8 | 3 | pass |
| Lavender title on the hero color (unlit 90%) | `#b39bc4` on `#7a4024` | 3.2 | 3 | pass |
| Text on product card / tile | `#3d2825` on `#f0e2c8` | 10.7 | 4.5 | pass |
| Muted text on product card / tile | `#6b534f` on `#f0e2c8` | 5.5 | 4.5 | pass |
| Card note (#5e4496) on card / tile | `#5e4496` on `#f0e2c8` | 6.0 | 4.5 | pass |
| Text on lavender zones section | `#fffff0` on `#5c3828` | 10.1 | 4.5 | pass |
| Text on footer | `#fffff0` on `#5c3828` | 10.1 | 4.5 | pass |
| Muted text on footer | `#d9c9c0` on `#5c3828` | 6.4 | 4.5 | pass |
| Footer link on footer | `#f0ae86` on `#5c3828` | 5.4 | 4.5 | pass |
| Text on drawer | `#fffff0` on `#5c3828` | 10.1 | 4.5 | pass |
| Muted text on drawer | `#d9c9c0` on `#5c3828` | 6.4 | 4.5 | pass |
| Text on closing section | `#3d2825` on `#efe0b8` | 10.5 | 4.5 | pass |
| Focus ring on page | `#b9a5d6` on `#2a1a18` | 7.5 | 3 | pass |

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

## Keeping the page clear of the floating player

The floating live player sits on top of the page, so the widget tells the store when it is visible: it sets `data-poc-mini="visible"` on `<html>` and `--poc-mini-clearance` (its height) on `<html>`, and removes both when it is dismissed or the live ends. The widget never edits the page layout itself; the store decides what to do. `merece.css` adds bottom padding to the footer (or to `body` on pages without one) while the attribute is present (`clearance + env(safe-area-inset-bottom)`), so nothing at the end of the page stays hidden behind it and the footer keeps its color down to the bottom.

## Language

`<html lang="es-UY">` (or `data-lang` on the widget's div) makes the widget Spanish: buttons, screen-reader labels, the live panel and the price format (`$ 1.250,00`). One build serves both languages (`widget/src/i18n.ts`).
