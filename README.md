# ChessLab — Training Suite (v21)

## Parity benchmarking (chess.com behavioral parity)
- Corpus file: `/home/runner/work/chesslab/chesslab/benchmark/corpus.json`
- Run benchmark gate: `npm run test:parity`
- Generate JSON report: `npm run benchmark:review`

## v21 — content expansion (roadmap phase 8)
- **Puzzle difficulty tiers**: Beginner/Club/Advanced/Master chips in Tactics → Practice, backed by the existing rating estimator. A **🎲 Next in tier** button picks a random puzzle from the tier while avoiding the last 8 you've seen (anti-repetition ring buffer) — falls back gracefully if a tier is small.
- **Endgame curriculum path**: the 5 drills are now grouped **Basic → Practical → Advanced**, with a **📍 Next up** banner that always points at the first drill you haven't cleared yet in that order — a real progression instead of a flat list. (No new endgame positions invented — just organizing what was already validated.)
- **Opening trap notes**: a **⚠️ Common traps** panel surfaces the punisher/refutation lines already in your repertoire (e.g. "Punishing 3...Nxe4?!", the Qh5 refutation) right above the full line list, so the "know this or lose a piece" moments are one click away instead of buried alphabetically.
- 14 new tests (46 total, all green) for the tier/anti-repetition picker and the curriculum/trap-finder logic.

## v20 — session mode, backups, visual controls, mobile polish

## v20 — session mode, backups, visual controls, mobile polish (phases 3, 5, 6, 7)
- **⏱ Session mode** (Training Plan): start a guided 15/30/45-minute block — tactics → game review → openings → endgames, pro-rated. Live progress bar, "you are here" segment with one-click jump, and the time is credited to your weekly study plan automatically when you finish (or end early — partial credit). Survives reloads: the session is persisted, so closing the tab doesn't lose it.
- **Progress backup** (Settings): **⬇ Export** downloads all your stats/settings as one JSON; **⬆ Import** restores it (validated before anything is touched — corrupt or foreign files are rejected without changes). Your Gemini key is *always stripped from exports* and the importing device's own key survives, so backup files are safe to move between devices.
- **Visual controls** (Settings): 6 new board themes (Amethyst, Deep Forest, Slate, Coral, Desert Sand, Arctic Ice — 12 total), **board highlight intensity** (subtle/normal/bold), **text size** (compact/normal/large), and a **colorblind-safe classification palette** (Okabe-Ito) that survives specificity wars with the default tokens.
- **Mobile pass**: 44px-class touch targets in the bottom nav, buttons, workspace tabs and move lists on small screens.
- Test suite grew to **32 tests** (session planning/progress math, backup round-trip + rejection paths) — all green, enforced by CI.



## v19 — quality gates + the personal-coach loop (roadmap phases 1–2)
- **Tests + CI**: 22 zero-dependency unit tests (`npm test`, plain `node --test`) covering the motif classifier, win% math, coach context builders, and the new queue/trends logic; a GitHub Actions workflow now builds and tests every push/PR.
- **🎯 "Do this now" queue** (top of the Training Plan): one ranked list combining SRS-due opening lines, your remaining daily tactics, your #1 recurring weakness (weighted by how *recently* it bites), and the analyze/slow-game habits. One click jumps you into the right tool, preloaded.
- **Analyzer → training bridge**: every mistake card now has **🧩 Drill this** (jumps to Tactics preloaded with that pattern — curated fork/mate/back-rank puzzles when they exist, your own harvested blunders when they don't) and **💥 My blunders**.
- **Motif trends**: the Dashboard weakness panel now shows **↘ improving / ↗ rising** per motif by comparing the newer half of your recent games against the older half — you can see whether the drilling works.
- Deferred from the roadmap (deliberately): the big Play/Analyzer/Openings file-split refactor — it needs this test safety net in place first.



## v18 — organised opening study + play on your phone
- **Opening Explorer reorganised** the same way as the Analyzer: the board is pinned on the left with a **tabbed panel** on the right — **Lines · Moves · Idea · Coach** while studying (Quiz / Test tabs replace them in those modes). The AI coach is now one click away *while the board stays in view* — no scrolling required to ask it a question mid-line.
- **Play on your phone**: ChessLab is now hosted at **https://daytoo77.github.io/chesslab/** — open it in any mobile browser and tap "Add to Home Screen" for an installable, offline-capable app icon. This hosted build ships with no API key baked in (unlike the local `ChessLab.html`); paste your own free Gemini key into Settings once per device to enable the AI coach there.

## v17 — organised analysis workspace + a bigger repertoire
- **Game Analyzer reorganised**: the board is now pinned on the left (sticky) with a **tabbed panel** on the right — **Report · Engine · Mistakes · Moves · Coach**. No more scrolling past a tall report to reach the board and controls; you pick the panel you need and the board never moves. Stacks cleanly on mobile.
- **+4 lines for every opening** (20 new, all legality-checked with chess.js and engine-verified):
  - **Bishop's Opening**: vs 2...Bc5 (Pianissimo), vs 2...Nc6 (Nc3), vs 2...Be7 (Hungarian), and the 3.d4 **Urusov Gambit**.
  - **Vienna**: quiet 3.g3 vs 2...Nf6 and vs ...Bc5, 3.g3 vs 2...Nc6, and the Na4 bishop-pair grab vs 2...Bc5.
  - **Alien Gambit**: the four ways Black *declines* the Nxf7 gambit (Classical 4...Bf5, Karpov 4...Nd7, 3...Nf6 Advance, 3...g6 Modern) — your sound plan when Black won't cooperate.
  - **Caro-Kann**: Advance Short System & the ...c5 break, Classical Karpov 4...Nd7 and Forgács 4...Nf6 5...exf6.
  - **Slav**: Chebanenko 4...a6, Schlechter ...g6, Semi-Slav Meran, and early ...Bf5 vs 3.Nf3.

## v16 — dark purple theme + an AI coach inside the Opening Explorer

## v16 — dark purple theme + an AI coach inside the Opening Explorer
- **Dark purple theme**: deep violet-black surfaces (`#0b0716`), a luminous purple accent (`#b07dff`), purple aurora glow, purple board highlights and move-list pills. (Replaces the v15 navy+gold skin per request.)
- **AI Coach in opening study**: the Gemini coach now lives in the **Opening Explorer** too. As you step through a line, ask it to *"explain the position we're in"*, *"what are both sides trying to do?"*, or *"why is the next move played?"* — it's grounded in the current FEN, the moves played, the repertoire's own expert notes, and the intended continuation, so it explains the real position instead of guessing. Verified: at 1.e4 it explains the Vienna intent; deeper in the gambit it correctly recommends the repertoire's `fxe5`.
  - `CoachChat` was generalized to take a `getContext()` provider; the analyzer passes engine data, the opening trainer passes repertoire data (`buildOpeningContext`). The coach uses engine lines when present and standard opening principles when studying.
- **Fix**: the local build's coach-key auto-seed now uses a unique marker so it actually injects (the old guard tripped on the app bundle's own `geminiKey` string and silently skipped seeding).

## v15 — warm navy theme, the Vienna, and a self-configuring coach

## v15 — warm navy theme, the Vienna, and a self-configuring coach
- **Theme redo**: the flat near-black look is gone — deep warm navy surfaces, stronger gold glow, softer radii, atmospheric gold/teal light. (Same structure and motion as v13/v14, new skin.)
- **Vienna Game repertoire** (8 lines, replaces the London as the second White weapon): Vienna Gambit main line + 5...Nxc3 attack setup, the 3...exf4? and 3...d6 punishments, the Bc4 f4-clamp vs 2...Nc6, the 4.Qg4 poison vs ...Bc5 — **including the critical lesson that 5.Qxg7?? loses to ...Bxf2+/...Ng4+** (engine-verified at −3.5; the line teaches the correct 5.Qg3) — and a central-strike line vs 2...Bc5.
- **Extra lines**: Caro-Kann vs the Fantasy (3.f3) and vs 2.Bc4?!; Slav vs the Colle. Every new line replayed for legality with chess.js and its final position engine-checked; annotations state honest evals ("balanced but easier to play") instead of fantasy claims.
- **Robustness fix**: page transitions no longer gate on exit animations (`mode="wait"` could freeze navigation when the tab was throttled — enter-only animation now).
- The local `ChessLab.html` build self-configures the AI coach key from a post-build step that lives outside this repo — the key is never in the source.



## v14 — next-gen analysis + the AI Coach (pillars 2 & 3)
- **Interactive eval chart**: hover to scrub — crosshair, live tooltip (move, classification, eval), critical turning points marked in their classification colors (blunder/miss/mistake/brilliant/great); white/black advantage areas split around the midline. Click still seeks the board.
- **Animated accuracy rings**: circular progress rings for White/Black fill and count up when a Game Review lands.
- **Animated engine arrows**: board arrows draw in and gently pulse (`arrow-in`/`arrow-pulse`).
- **🧑‍🏫 AI Coach (Gemini)**: a chat panel beside the analysis board. Every question ships with a fresh *engine-data block* — FEN, live Stockfish lines, evals, move tags — and the system prompt forbids ungrounded claims, so answers explain rather than hallucinate. Ask "why couldn't I take that pawn?" and it answers from the actual lines.
  - **Bring your own key**: paste a free Google AI Studio key in Settings (or in the coach panel itself). The key is stored **only in your browser's localStorage** — never bundled in the app, never in this repo.
  - Respects "assess first" mode (the coach hides with the rest of the engine until you commit your verdict). The offline engine-grounded explainer remains the no-key fallback.



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
