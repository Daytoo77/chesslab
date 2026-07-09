# ChessLab — Training Suite (v13)

## v13 — premium visual identity (pillar 1 of the next-gen overhaul)
- **Neutral-dark design language** (Linear-inspired): near-black `#0a0b0e` base, calm opaque surfaces, hairline borders, refined shadows, tighter radii, more negative space, `:focus-visible` rings.
- **Motion** (`motion/react`): buttery page transitions between sections (`AnimatePresence mode="wait"`), scale/fade settings popover, staggered bot-card + panel entrances (CSS `rise-in` keyed off `--i`), `prefers-reduced-motion` respected.
- **Grouped sidebar** — Play / Train / Analyze sections with uppercase group labels, quieter active state (neutral fill + gold inset bar + gold icon).
- **Board glow**: last move gets a soft gold inner bloom (brighter ring on the destination), king-in-check pulses red (`check-pulse`), premoves glow blue, selected square blooms.
- **Move list**: auto-scrolls to keep the current move visible; the current-move pill glows gold; classification colors/superscripts as before.

## v12 — weakness profiling (concrete coaching, not just numbers)
- **Mistake-motif tagging**: every flagged move now gets concrete *why-it-was-bad* tags from cheap, engine-free heuristics — **Hung piece · Greedy pawn · Missed material · Missed fork · Missed mate · Allowed fork · Allowed mate · Back rank · Time trouble**. Shown as chips on each mistake card (hover for one-line coaching). Pure board geometry over the FENs already computed — no extra engine calls. (`src/motifs.js`)
- **Cross-game weakness profile**: those tags are tallied across every analyzed game into a lifetime + recent-window profile. The Dashboard shows your **Recurring weaknesses** (ranked bars, "N recent"), and the Training Plan leads with **"Your #1 leak — fix this first"** plus the matching drill. (`store.js` `weaknessProfile`, `recordWeaknesses`, `weaknessTop`/`weaknessRecent`)
- **Time-trouble detection**: imported chess.com / lichess PGNs carry `[%clk]` — ChessLab now parses it per ply and flags moves played under ~30s, so a clock blunder reads as a clock problem, not a chess one. (`parseClocks`)
- **"💬 Explain this position"**: an on-demand, engine-grounded read of the current analyzer position — who stands better, the best move and its idea, the main line, one structural fact — built only from the live engine lines + FEN (the honest offline analog of an AI position chat; never invents a move). (`narrate.js` `explainPosition`)
- The Coach's Commentary now draws its "what it cost you" section from the same structured motifs.
- _(Ideas adapted from the tintins-chess-analysis project; ChessLab's own engine + heuristics, no shared code.)_

## v11 — Training Plan (the improvement guide, made trackable)
- New **◎ Training Plan** section that turns the classic "how to get better at chess" routine into tools you actually use and track — not just advice:
  - **Weekly study plan** on the **50 / 20 / 15 / 10 / 5** split (play / analysis / tactics / strategy / endgames). Set a weekly hour goal; log time per category with one tap; each bar fills toward that category's share. Honest tracking — only what you log, persisted per day over a rolling 7-day week. (`store.js` `studyLog`/`weekStudy`, `STUDY_CATS`)
  - **Today's habits**: solve N tactics (configurable, default 10 per the guide), play one slow game (auto-ticked when a 15|10/casual game finishes), analyse a game (auto-ticked after a Game Review) — each derived from real state, with streak + weekly puzzle count.
  - **The thinking checklist** (forcing moves first), **middlegame planning steps** (imbalances → target → piece placement → candidate moves), **endgame essentials** (opposition / zugzwang / triangulation / outflanking), **opening principles** + what to favour/avoid.
- **In-game blunder-check**: the every-move checklist is one tap away on the board while you play (`✓ Blunder-check` panel in Play).
- **"Don't use the engine as a crutch"**: the Analyzer has an **Assess first** toggle — it hides the eval bar, engine lines and best-move arrow until you commit your own verdict, then **Reveal** to check yourself. Re-hides on every new position.

## v10 — design system refresh
- Deeper space-black base (`#05080f`), richer warm-gold primary + a **teal** secondary accent for live/interactive cues. Opaque panels (`#0b1120`) for clarity and performance — glass kept only for floating popovers. Full-pill active nav, gradient brand mark, tightened radii and a third text tier.

## v9.1 — Coach's Commentary (engine-grounded didactic narration)
- After Game Review, a **"🎙️ Coach's Commentary"** panel narrates the game in plain language (Leontxo-García style): the opening + plan, 2–3 turning points, what decided the game, pawn-structure features, actionable takeaways, and one verifiable named master game.
- Crucially **everything is generated from the real Stockfish analysis** already computed (eval swings, classifications, mistakes, opening, FEN-derived structure) — it never invents a move or evaluation. This is the honest, in-app answer to the popular "AI chess coach" prompts that hallucinate PGNs: here the engine supplies the truth and the app writes the lesson around it. (`src/narrate.js`)

## v9 — premium glassmorphism UI overhaul
- Full design-system pass in `index.css` (every section inherits it via shared classes — no per-section rewrites):
  - **Layered dark palette** on the #0d1322 base + an atmospheric radial glow behind everything so glass reads as glass.
  - **Glassmorphism** surfaces (translucent + `backdrop-filter: blur`) on panels, cards, sidebar, report, player bars, settings — with soft depth shadows and large (18px) rounded corners.
  - **Refined typography**: Inter/SF Pro stack, tighter heading tracking, strategic weight hierarchy, gradient-gold title accents.
  - **Single elegant accent** (muted gold): gradient primary buttons, pill tabs, a sliding gold nav indicator, glowing active states.
  - Generous padding / negative space throughout; gold ♞ brand mark; light theme + mobile bottom-nav updated to match.

## v8 — live analysis board (lichess/Chesskit-style) + symmetric layout

## v8.1 — classifier aligned to chess.com's published spec
- Confirmed the win% model (`50+50*(2/(1+e^(-0.00368208·cp))-1)`) and the standard bins (Best 0 / Excellent <2 / Good <5 / Inaccuracy <10 / Mistake <20 / Blunder ≥20) match chess.com exactly.
- **Brilliant** now allows "best OR near-best" (not strictly #1) per the spec — combined with the deep re-verify, this makes quiet positional sacrifices register: verified `23.Ng5` in a real game now flags Brilliant like chess.com, while the speculative `Bxh7+` stays non-brilliant.
- **Miss** rewritten to the spec wording: a clearly winning move was available (winBefore ≥65) and the played move dropped to equal-or-worse (winAfter ≤52), or a forced mate was thrown away.
- **Great** "only good move" gap loosened slightly (12%).


## v8 — live analysis board (lichess/Chesskit-style) + symmetric layout
- **Live engine-lines panel**: a dedicated Stockfish worker analyzes the current position continuously, streaming the **top-3 lines with evals and a live depth counter** (climbs 11→28 as you watch), in figurine notation. Updates as you step through moves. (Separate worker, so it never blocks bots/coach or the game review.)
- **Live eval bar** on the analysis board, driven by that engine — deepens in place instead of showing a one-shot shallow number.
- **Engine arrow** (★ / B): the engine's current best move drawn on the board, live.
- **Symmetric analysis layout**: the whole analyzer is now a single centered workspace — the Game Review report and the board+sidebar row share one center axis (measured: 0px offset), consistent panel widths and spacing. No more scattered panels.
- **Learn from your mistakes**: up to 5 biggest mistakes as find-the-move puzzles (was 3).
- UI updates throttled to ~5/s so the streaming engine never janks the page.

## v7 — chess.com-style Game Review UI

## v7 — chess.com-style Game Review UI
- Note: chess.com's own source (engine, Game Review algorithm, site) is **not** public on their GitHub — this is a look-and-behavior clone built from scratch, not their code, and uses no chess.com assets.
- **Redesigned Game Review** to match chess.com's report: coach speech bubble + comment, eval graph, player cards (monogram avatars), accuracy boxes, the full **circular colored classification list** (Brilliant/Great/Best/Excellent/Good/Book/Inaccuracy/Miss/Mistake/Blunder) with white–black counts, **Game Rating** per side, and **Opening / Middlegame / Endgame** phase icons.
- **Game Rating** now derived from accuracy (fitted to chess.com's own numbers), not raw ACPL — no more 2600 ratings for a beginner's clean game.
- Phase split (book/material) + per-phase icon per player; coach comment keyed on the user's weakest phase.
- **Green board (chess.com)** is now the default theme.

## v6 — chess.com-grade move classification + UI/sound pass

## v6 — chess.com-grade move classification + UI/sound pass
- **Full chess.com classification system** (was: just best/good/mistake/blunder). Every move now gets one of **Brilliant ‼ · Great ! · Best ★ · Excellent · Good · Book 📖 · Inaccuracy ?! · Miss ✗ · Mistake ? · Blunder ⁇**, using chess.com's official *expected-points-lost* thresholds on the win-probability curve (Best 0, Excellent <0.02, Good <0.05, Inaccuracy <0.10, Mistake <0.20, Blunder ≥0.20).
  - **Brilliant** = a *sound* sacrifice (net material invested ≥1.5 pts, captures netted out so winning a rook isn't a "sac"), engine's top move, you're not-losing after and weren't already winning.
  - **Great** = the only good move (clear gap to the 2nd line, via MultiPV-2).
  - **Miss** = the opponent erred and you failed to punish a winning chance (or missed a forced mate).
  - **Book** = opening theory; **Forced** = only legal move.
  - Verified: 0 false brilliancies in a quiet game, but Byrne–Fischer 1956 correctly flags **17…Be6‼**, 15…Nxc3‼ and 29…Bf8‼.
- **MultiPV-2 analysis** per position (powers Great / only-move detection); engine times bumped (fast 300 / strong 600 / deep 1200 ms).
- **Move colors + symbols** match chess.com's palette; review **plays the classification sound as you step** through moves — including a special shimmering **Brilliant** chime, plus Great / Miss / Blunder accents.
- **UI pass**: Segoe UI Variable type scale, gradient titles, mono numerics (Cascadia), refined accuracy cards and legend (only non-zero categories, with W–B counts).



Personal chess training app (React + Vite + chess.js + react-chessboard + zustand), tailored to:
- **White:** Bishop's Opening, Alien Gambit (vs Caro-Kann & French), London System
- **Black:** Caro-Kann Defence

## Run it
- **No install:** open `../ChessLab.html` (single file, offline, engine in a Web Worker).
- **Dev:** `npm install && npm run dev`
- **PWA:** `npm run build` then serve `dist/` over http(s) (e.g. `npm run preview`) → installable on a phone, works offline via service worker. (PWA features need http(s); the standalone file works everywhere but can't register the service worker.)

## v5 — Slav, Woodpecker, persistance, Coach du jour
- **ENGINE FIX (the big one):** the embedded Stockfish worker was started with a `,worker` hash suffix that silently killed its init — every session paid a 35 s timeout before falling back ("the bots don't move"). Fixed: boots in ~0.4 s, replies in ~150 ms. Local `./engine/` files are also tried first when hosted.
- **Slav Defence vs 1.d4** (new opening group, color black): 6 annotated lines — main 4...dxc4/Bf5, Exchange, 4.e3+Nh4, anti-London (...Qb6!), anti-Jobava (trade-order trap explained), anti-Colle. All legality-checked + Stockfish/cloud-eval validated (final positions within ±0.8).
- **Woodpecker mode** (Tactics): full-set cycles with per-cycle time/error tracking and progression chart.
- **My blunders**: every mistake/blunder from your analyzed games auto-becomes a personal puzzle.
- **Motif stats**: success rate per tactical motif — your weakest patterns surface automatically.
- **Daily SRS drill** (Openings): one button chains a quiz through every line due today, with a session score.
- **Play**: in-progress game survives app close (resume banner), bots play varied book openings for the first moves, and any repertoire line can be played out **vs a bot** from its final position.
- **UI**: light theme, unicode piece set, realistic noise-based move sounds, phone bottom-nav + full-width board, multipv arrows graded by opacity, **🎯 Coach du jour** daily plan on the dashboard.
- Service worker is network-first for the app shell (updates show on first reload).

## v4 — Play vs Bots + chess.com-class UX
- **▶ Play vs Bots**: 12-bot strength ladder from ~400 Elo to full-power Stockfish (UCI_Elo above 1320, Skill Level + fixed depth + dosed randomness below it). Personas, lifetime W/D/L per bot, best-win tracking.
- **Real game features**: optional clocks (3+2 / 5+0 / 10+0 / 15+10) with increments + flag detection + low-time warning, **premoves** (right-click to cancel), hints (engine arrow), takeback, draw offers (the bot consults Stockfish before accepting), resign, rematch.
- **Game Review handoff**: one click after any game sends the PGN straight into the Analyzer.
- **Online import**: fetch your latest games from **chess.com / lichess** by username (public API) and analyze them in one click.
- **Analyzer upgrades**: live **eval bar**, **★ Best** move arrow (B), **🔬 Explore** = live top-3 Stockfish lines at any position (E, MultiPV), opening name detection (130-line ECO book), figurine move list, **annotated PGN export** with [%eval] comments.
- **Board upgrades**: 6 board themes, king-in-check highlight, real **promotion picker** (auto-queen optional), right-click square marks, coordinates toggle, animation speed setting.
- **Puzzle rating**: Elo-style tactics rating (K=32 vs puzzle difficulty) with sparkline on the dashboard; per-puzzle difficulty shown.
- **⚙ Settings panel**: themes, legal-move dots, coordinates, auto-queen, animation, sounds, blindfold — all persisted.
- New sounds (game start, victory/defeat/draw fanfares, low-time tick), polished responsive CSS.

## v3.2 — Stockfish embarqué (plus aucun problème de chargement)
- **Stockfish 17.1 lite est maintenant DANS le fichier** `ChessLab.html` (~10 Mo) : aucun réseau, aucun CDN, fonctionne en double-cliquant le fichier. C'est désormais le moteur "local".
- **Play vs Coach** joue avec Stockfish bridé à ~1400 Elo (sparring réaliste) ; **les finales** sont défendues par Stockfish à pleine force.
- Tiers de secours conservés : ./engine/ local → CDN → SF10 → moteur intégré.

## v3.1
- **Stockfish 17.1 lite (NNUE)**, tiered loading: local `./engine/` (zero network when served from the project — `npm run preview`) → CDN (wasm injected into a blob worker) → Stockfish 10 asm fallback → built-in engine. The report shows which engine ran.
- **Repertoire grown to 25 lines**: + Panov, 2.c4 and KIA for the Caro-Kann; + f4 attack and anti-Philidor for the Bishop's Opening; + Grünfeld/QGD/...Bf5 setups for the London; + two more Alien Gambit branches (5...e6 declined, 7...Be6 block).

## v3 — Stockfish Game Review (chess.com-style, free)
- **Real Stockfish 10** loaded from CDN into a blob Worker (cached after first load). Offline → automatic fallback to the built-in coach engine.
- **Game Report**: accuracy % for both sides (win-probability model), **estimated performance rating** (from ACPL), average centipawn loss, per-tag counts (brilliant/best/good/inaccuracy/mistake/blunder ×2 colors).
- **Consistent grading**: one engine eval per position grades every move of both players — no "best move that's also a blunder" contradictions.
- **Clickable eval graph** (chess.com-style) with mistake markers.
- Engine time presets: fast / strong / deep.

## v2 highlights
- **Engine**: authentic PeSTO tapered piece-square tables, alpha-beta + quiescence with strict time budgets, all search in a **Web Worker** (UI never freezes). Game analysis ≈ 10 s for a 40-move game.
- **Analyzer**: every move graded (brilliant/best/good/inaccuracy/mistake/blunder), top-3 mistakes become **guess-the-move puzzles**, tactic explanations drawn as **arrows** (principal variation), keyboard ← → navigation.
- **Openings**: + London System (incl. the real poisoned-pawn punishment line), + extra Bishop's/Caro lines, **PGN import** (Lichess studies, comments become annotations), **spaced repetition (SRS)** scheduling, and **"Play this position vs Coach"** after any line.
- **Tactics**: ⚡ **Time Rush** (3 min, −10 s per miss), legal-move dots, click-to-move.
- **Endgames**: positions **randomized** (file shifts + color mirroring) so you learn geometry, not coordinates; moves graded by the **Lichess Syzygy tablebase** when online (engine fallback offline).
- **UX**: flip board everywhere, synthesized move/capture/check sounds (mutable), prominent coach banners, zustand-persisted stats incl. rush record and SRS due dates.

## Validation
All puzzles, opening lines and endgame templates are machine-checked (chess.js legality, real mates, material counts); K+P drill templates verified against an exhaustive KPK tablebase.
