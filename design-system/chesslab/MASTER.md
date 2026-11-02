# ChessLab design system: "Slate"

This file describes what actually ships. The single source of truth is the
token block at the top of [`src/index.css`](../../src/index.css). If you change a
token there, update the table here in the same commit.

**Rules**

1. Raw values (hex, rgb, px font sizes, radii, shadows) live only in the
   `:root` / `[data-theme="light"]` token blocks. Component CSS reads tokens.
2. A theme swaps **solid** colours only. Transparent tints are derived from the
   solids (alpha ladder below), so they follow the theme automatically.
3. No emoji in the UI. Icons come from `lucide-react` through one registry,
   [`src/components/Icon.jsx`](../../src/components/Icon.jsx). Data files store a
   semantic icon *name*, never a drawing.
4. Chess glyphs are allowed only as notation: pieces on the board, figurine
   move lists (`src/figurine.js`), annotation marks (`!!`, `!`, `?!`, `?`, `??`).
5. Fully offline: system font stack, no web fonts, no runtime CDN.

---

## Colour

### Surfaces and text (dark default, light override)

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#0a0f1e` | `#eef0f5` | Page background |
| `--bg2` | `#101828` | `#f4f6fa` | Inputs, selects |
| `--bg3` | `#18213a` | `#e9ecf2` | Deep wells |
| `--surface` | `#131c31` | `#ffffff` | Opaque cards and panels |
| `--surface-2` | `#1c2740` | `#f4f6fa` | Raised surface |
| `--glass` / `--glass-strong` | surface at 72% / 92% | white at 72% / 92% | Frosted nav, popovers, sticky tabs |
| `--field` | black at 30% | white at 80% | Sunken fields: PGN box, clock |
| `--scrim` | `#0a0f1e` at 55% | `#eef0f5` at 60% | Cover over blurred content |
| `--fill-1 … --fill-4` | tint at 3 / 6 / 10 / 16% | ink at same | Hover and quiet fills |
| `--border` / `--border-strong` | slate at 12% / 24% | ink at 10% / 18% | Hairlines |
| `--text` | `#eef2fb` | `#1b2030` | Primary text |
| `--muted` | `#94a3b8` | `#5d6577` | Secondary text |
| `--sub` | `#64748b` | `#8892a4` | Labels, captions |

### Accents and status

| Token | Dark | Light | Use |
|---|---|---|---|
| `--accent` | `#6366f1` | `#4f46e5` | Primary actions, active state, focus |
| `--accent-soft` | `#a5b4fc` | `#4338ca` | Accent text and icons on dark |
| `--accent-strong` | `#4f46e5` | `#3730a3` | Bottom of `--accent-fill` |
| `--on-accent` | `#ffffff` | `#ffffff` | Text on accent fills |
| `--accent-fill` | accent → accent-strong | same | Primary buttons, active pill tabs (keeps white text at 4.5:1 or better) |
| `--live` | `#2dd4bf` | `#0d9488` | Live engine indicators, "Explain" action |
| `--good` | `#4ade80` | `#16a34a` | Success, wins, positive eval |
| `--bad` | `#f87171` | `#dc2626` | Errors, losses, negative eval |
| `--warn` | `#e58f2a` | `#e58f2a` | Warning gradients |
| `--info` | `#60a5fa` | `#2563eb` | Coach banners, info chips |

**Alpha ladder.** `--accent-a1 … a4`, `--live-a1 … a3`, `--good-a1/a3/a4`,
`--bad-a1/a3/a4`, `--info-a1/a3/a4` = the solid colour at **8 / 16 / 30 / 50%**
via `color-mix(in srgb, …, transparent)`. Use a1 for washes, a2 for selected
backgrounds, a3 for borders, a4 for glows and focus rings.

### Move classification

One `--tag` custom property per class drives text colour, chip tint and badge
fill (`.tag-*` / `.cbadge-*`). The colour coding follows the familiar Game Review
convention; the badge drawings are our own ([`ClassBadge.jsx`](../../src/components/ClassBadge.jsx)).

| Class | Token | Default | Colourblind-safe (Settings) | Badge |
|---|---|---|---|---|
| Brilliant | `--c-brilliant` | `#1baca6` | `#56b4e9` | `!!` |
| Great | `--c-great` | `#5c8bb0` | `#0072b2` | `!` |
| Best | `--c-best` | `#6aa84f` | `#009e73` | star icon |
| Excellent | `--c-excellent` | `#81b64c` | same | thumbs-up icon |
| Good | `--c-good` | `#95a75c` | same | check icon |
| Book | `--c-book` | `#a88865` | same | open-book icon |
| Inaccuracy | `--c-inacc` | `#f0c043` | `#f0e442` | `?!` |
| Miss | `--c-miss` | `#fd7e6f` | `#cc79a7` | x icon |
| Mistake | `--c-mistake` | `#e58f2a` | `#e69f00` | `?` |
| Blunder | `--c-blunder` | `#fa412d` | `#d55e00` | `??` |
| Forced | `--c-forced` | `--muted` | same | arrow icon |

### Board furniture

`--side-white` / `--side-white-ink`, `--side-black` / `--side-black-ink` (player
avatars, accuracy boxes, side dots), `--eval-track` (eval bar), `--graph-bg`,
`--graph-line`, `--graph-cursor` (eval graph). Board square colours are user
data, not tokens: see `BOARD_THEMES` in `src/settings.js`.

---

## Typography

System stack only (`--font`): Inter if installed, else SF Pro / Segoe UI /
Roboto. Monospace (`--mono`) for clocks, evals, move lists and numbers.

All sizes are **rem**, so Settings › Text size (90 / 100 / 112%) scales them.

| Token | Size at 100% | Use |
|---|---|---|
| `--fs-3xs` | 9px | Superscript marks |
| `--fs-2xs` | 10.5px | Uppercase section labels (letter-spacing 1.4 to 1.8px) |
| `--fs-xs` | 11.5px | Chips, captions |
| `--fs-sm` | 12.5px | Secondary lines |
| `--fs-base` | 13.5px | Buttons, controls, move list |
| `--fs-md` | 14.5px | Dense body, coach bubble |
| `--fs-body` | 15px | Running text (`body`) |
| `--fs-lg` | 17px | Brand, accuracy boxes |
| `--fs-xl` | 20px | Clocks, rush bar |
| `--fs-2xl` | 22px | Game-over title, mobile page title |
| `--fs-3xl` | 30px | Page titles |
| `--fs-4xl` | 36px | Big stat numbers |

---

## Space

Tokens are named by their pixel value on a 2/4px grid:
`--space-2, 4, 6, 8, 10, 12, 14, 16, 20, 24, 28, 32, 40, 48, 80`, plus
`--nav-clearance` (90px, room under content for the phone bottom nav).

Component sizes (widths, heights of fixed elements) stay literal; padding,
margin and gap always use a space token.

## Shape

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 4px | Tiny bars, focus outline |
| `--radius-sm` | 6px | Move-list cells, small boxes |
| `--radius-md` | 10px | Buttons, inputs, cards in lists |
| `--radius-lg` | 14px | Panels, board shell |
| `--radius-pill` | 999px | Chips, pill tabs |

## Depth

| Token | Use |
|---|---|
| `--shadow-sm` | Badges, avatars |
| `--shadow` | Cards, panels |
| `--shadow-lg` | Board shell, popovers |
| `--shadow-pop` | Big banners |
| `--highlight` | 1px top inner highlight on glass panels |
| `--glow` | Accent halo around the board |
| `--ring` | Focus ring on inputs |
| `--ring-active` | Selected card / active player / current move |
| `--ring-inset` | Active tab, active nav item |
| `--shadow-accent`, `--shadow-accent-hover` | Primary button lift |
| `--shadow-check`, `--shadow-check-peak` | King-in-check pulse |
| `--blur`, `--blur-soft` | Backdrop filters for glass |

Shadow colour comes from `--shade` (an RGB triplet), so light mode softens every
shadow at once.

## Motion

`--ease-out` (expo-out), `--dur-fast` 0.12s, `--dur` 0.15s, `--dur-slow` 0.25s.
Page enter is 0.2s. `prefers-reduced-motion: reduce` collapses every animation
and transition to near zero, including the ambient background drift.

---

## Components

### Icons

`<Icon name="tactics" size={18} />` from `src/components/Icon.jsx`. Stroke icons,
2px stroke (3px inside badges), `aria-hidden` unless a `label` is passed.
Icon-only buttons must carry `aria-label`. Registered names cover pages,
actions, review tabs, statuses and every mistake motif key. Add new names there;
never import lucide directly in a section.

### Bot avatars

`<BotAvatar bot={b} />` (`src/components/BotAvatar.jsx`): a monogram tile whose
hue walks from green (400) through blue and violet to crimson (3200), plus a
five-step strength meter. Generated, so no image assets.

### Side dot

`<SideDot side="w|b" />`: small disc that marks the colour a player or opening
line belongs to.

### Buttons

`.btn` (quiet fill), `.btn.primary` (`--accent-fill`, white text,
`--shadow-accent`), `.btn.teal` (live accent), `.btn-mini` (compact). Icons sit
inside the button before the label with a 6px gap.

### Chips, banners, panels

`.chip` (+ `.green` `.red` `.blue` `.teal` `.tag-*`), `.banner` (`.ok` `.err`
`.coach` `.gold`, `.big` adds a 4px left rule), `.panel` (frosted glass in dark,
solid surface in light).
