# ChessLab design system: "Slate" (Apple-clean)

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

Apple-style neutral grays (no blue cast) with one blue accent. The theme
setting is **Automatic** (follows the device, live), **Dark** or **Light**.
A theme swaps solid colours and `--tint` only; hairlines, fills and the alpha
ladder derive from them.

### Surfaces and text

| Token | Dark | Light | Use |
|---|---|---|---|
| `--bg` | `#000000` | `#f2f2f7` | Page background |
| `--bg2` | `#1c1c1e` | `#eeeef3` | Inputs, selects |
| `--bg3` | `#2c2c2e` | `#e5e5ea` | Deep wells |
| `--surface` | `#1c1c1e` | `#ffffff` | Cards and panels |
| `--surface-2` | `#2c2c2e` | `#f9f9fb` | Raised surface |
| `--glass` / `--glass-strong` | surface at 72% / 92% | same | Translucent nav, popovers (with `--blur`) |
| `--field` | `#767680` at 24% | at 12% | Sunken fields, clock |
| `--scrim` | black at 45% | `#f2f2f7` at 60% | Cover over blurred content |
| `--seg-active` | `#636366` | `#ffffff` | Selected segment (analysis tabs) |
| `--tint` | `235 235 245` | `60 60 67` | Channel for hairlines and fills |
| `--fill-1 … --fill-4` | tint at 3 / 6 / 10 / 16% | same | Hover and quiet fills |
| `--border` / `--border-strong` | tint at 12% / 24% | same | Hairlines |
| `--text` | `#f5f5f7` | `#1d1d1f` | Primary text |
| `--muted` | `#98989d` | `#6e6e73` | Secondary text |
| `--sub` | `#6c6c70` | `#8e8e93` | Captions |

### Accents and status

| Token | Dark | Light | Use |
|---|---|---|---|
| `--accent` | `#0a84ff` | `#0071e3` | Active state, links, icons, focus |
| `--accent-soft` | `#409cff` | `#0058b0` | Accent text on tinted backgrounds |
| `--accent-strong` | `#0a6fdc` | `#0071e3` | Fills that carry white text |
| `--accent-fill` | = `--accent-strong` | same | Primary buttons, active pills (flat, no gradient) |
| `--on-accent` | `#ffffff` | `#ffffff` | Text on accent fills |
| `--live` | `#40c8e0` | `#0a8a9c` | Live engine, "Explain" action |
| `--good` | `#30d158` | `#248a3d` | Success, wins |
| `--bad` | `#ff453a` | `#d70015` | Errors, losses |
| `--warn` | `#ff9f0a` | `#e08600` | Warnings |
| `--info` | `#64d2ff` | `#0077a8` | Coach banners |

**Alpha ladder.** `--accent-a1 … a4`, `--live-a1 … a3`, `--good-a1/a3/a4`,
`--bad-a1/a3/a4`, `--info-a1/a3/a4` = the solid colour at **8 / 16 / 30 / 50%**
via `color-mix`. a1 washes, a2 selected backgrounds, a3 borders, a4 rings.

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

System stack only (`--font`): SF Pro on Apple devices (`-apple-system`), else Inter if installed, Segoe UI, Roboto. Body letter-spacing is -0.01em, page titles -0.03em. Monospace (`--mono`: SF Mono, Menlo) for clocks, evals, move lists and numbers. Section labels are sentence case, never uppercase with tracking.

All sizes are **rem**, so Settings › Text size (90 / 100 / 112%) scales them.

| Token | Size at 100% | Use |
|---|---|---|
| `--fs-3xs` | 9px | Superscript marks |
| `--fs-2xs` | 10.5px | Tiny captions |
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
| `--radius-xs` | 6px | Tiny bars, focus outline |
| `--radius-sm` | 8px | Move-list cells, small boxes |
| `--radius-md` | 12px | Buttons, inputs, list rows, board shell |
| `--radius-lg` | 18px | Cards and panels |
| `--radius-pill` | 999px | Chips, pill tabs |

## Depth

Flat by default. Dark mode relies on surface contrast; light mode adds a faint
two-layer shadow. No glows, no gradients on buttons or bars.

| Token | Use |
|---|---|
| `--shadow-sm` | Badges, avatars, selected segment |
| `--shadow` | Cards, panels |
| `--shadow-lg` | Board shell, popovers |
| `--shadow-pop` | Big banners |
| `--ring` | Focus ring on inputs (4px accent wash) |
| `--ring-active` | Selected card, active player, current move (2px accent) |
| `--ring-inset` | Subtle inset outline |
| `--shadow-check`, `--shadow-check-peak` | King-in-check pulse |
| `--blur`, `--blur-soft` | Backdrop filter for translucent material (saturate 180%, blur 20px) |
| `--highlight`, `--glow`, `--shadow-accent*` | Neutralised (no-op) hooks, kept so a theme can bring them back |

Shadow colour comes from `--shade` (an RGB triplet).

## Motion

`--ease-out` (`cubic-bezier(0.32, 0.72, 0, 1)`, an iOS-style decelerate), `--dur-fast` 0.12s, `--dur` 0.18s, `--dur-slow` 0.3s.
Page enter is 0.2s. Buttons press to scale 0.97; cards do not lift on hover. `prefers-reduced-motion: reduce` collapses every animation
and transition to near zero.

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

`.btn` (quiet gray fill, no border), `.btn.primary` (flat `--accent-fill`, white text), `.btn.teal` (live accent), `.btn-mini` (compact). Icons sit
inside the button before the label with a 6px gap.

### Chips, banners, panels

`.chip` (+ `.green` `.red` `.blue` `.teal` `.tag-*`), `.banner` (`.ok` `.err`
`.coach` `.gold`, `.big` adds a 4px left rule), `.panel` (solid surface, hairline border, soft shadow).
