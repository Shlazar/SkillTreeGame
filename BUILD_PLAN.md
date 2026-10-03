# BUILD_PLAN.md: Sky Reaper, from the current build to FINAL_DESIGN.md

This plan breaks FINAL_DESIGN.md into small tasks. Do them **in order, one at a time**.
Each task lists the design section it follows, the files to change, and checks that must pass before you commit.
Tasks tagged **[VISUAL]** are the ones where the look and the effects matter most. After a [VISUAL] task the owner may ask Claude to review your screenshots.

---

## How to work

### Before the first task
1. Read these files completely, in this order:
   - `FINAL_DESIGN.md`: what to build. It wins over the older docs (`DESIGN.md`, `FIRST_10_MIN.md`, `PROGRESSION_OPTIONS.md`).
   - `STYLE_GUIDE.md`: how it must look and feel, and how the code is written.
   - `tools/README.md`: the headless test tool and the `window.__sr` test API.
   - This file.
2. Look at every image in `docs/style/`. They show the look you must match. **Never regenerate, overwrite or delete them** (see STYLE_GUIDE section 0).
3. Run `git status`. The design docs and `tools/` may still be uncommitted on `demo-first-10`. **Never delete, revert or overwrite them.** If they are not committed yet, ask the owner to commit them (or ask if you may commit them) before you branch.
4. Create your branch: `git checkout demo-first-10` then `git checkout -b final-design`.

### For every task
1. Do **one** task only. Keep the change focused on that task.
2. Build and run the standard checks (see "Standard checks" below).
3. Run the task's own checks. Write any new scenario as a file in `tools/scenarios/` (create the folder). Name it after the task, for example `tools/scenarios/t3_3_rockets.js`, and commit it so it can be run again later. Outputs go to `tools/out/`, which git ignores.
4. **Open and look at every screenshot you take.** Compare it with `docs/style/`. Zoom into small effects with `python tools/crop.py in.png out.png x y w h 4`. Shot mode never prints errors, so run the same setup in run mode first and check `qaErrors` is `[]`. Delete an old PNG before you take a new shot with the same name (see tools/README.md). If you cannot view images, say so in your report. Then the owner or Claude must look at them before you go on.
5. Commit. `index.html` is tracked, so commit it too. Use one commit per task. The message starts with the task id, then says plainly what changed, for example: `T3.3 Heli Rockets: per-bullet roll, bad-luck timer, forced first rocket, smoke trail and blast`. Use the commit trailer the owner asks for, if any.
6. Report in simple English (see "Report format").

### Rules
- **Never change a design decision.** If the design looks wrong or two parts disagree, stop and ask the owner. Then go on with another task.
- **Some details have no number in the design.** Then choose a value that fits, put it in a config table with a comment ending in `(proposal)`, and list it in your report.
- **Do not change what is not in the task.** Never "clean up" other code on the side.
- At the end of each phase, stop and send a phase report with a set of screenshots. Wait for the owner before you start the next phase.
- The game must build and run after **every** task. A half-done feature must stay hidden, not broken.

### Standard checks (run after every task)
From the repo folder:
```
node tools/qa.js run tools/examples/run_loop.js
node tools/qa.js run tools/examples/run_smoke.js
```
- `run_loop` must print `"qaErrors":[]` and the mode list `["title","depot","play","summary","depot"]`. If a task changes this flow on purpose (Phase 1 does), update `tools/examples/run_loop.js` in the same task and say so in your report.
- `run_smoke` must print `"qaErrors":[]`, and `__sr.stats()` must still work. When you remove a field it reads (for example `G.gun`), update `stats()` in `src/main.js` in the same task.
- After any task that adds sprites, run `__sr.late()` at the end of a 30 s run. It must not be higher than the baseline you noted in T0.1 (today it is 1 after the first frames). `late()` counts late atlas **pages** (512x512 each), not sprites (see Trap 2).
- After any task that adds drawing or effects, run the busy-fight scenario of `tools/README.md` section 6. `__sr.bench(60)` must stay under 8 ms, and one new system may add at most about 1 ms over the T0.1 baseline.

### Report format (after each task)
```
TASK: T2.3 Tree visibility rules
CHANGED: src/tree.js (nodeState rewritten), src/depot.js (flags), src/test_f.js (treeShown helper)
CHECKS: run_loop OK, run_smoke OK, qaErrors []. tools/scenarios/t2_3_vis.js -> {start:[...5 ids], afterBuy:[...]}
SCREENSHOTS: tools/out/t2_3_start.png (only VIPER + 4 nodes, as docs/style/tree.png), tools/out/t2_3_gold.png
PROPOSALS: none
QUESTIONS: none
```

---

## Known traps in the current code (read before you code)

1. **File order and boot.** `build.py` joins the files of `ORDER` into one script, in one scope, with `'use strict'`. Add every new file to `ORDER`. `main.js` calls `boot()` the moment it loads. So files that come **after** `main.js` in `ORDER` (`loot.js`, `tut.js`, `cannon.js`, `test_*.js`) load after the boot. If boot touches a top-level `const`/`let` from those files, you get a "cannot access before initialization" error. Only `function` declarations are ready early. **Put new game files before `main.js`.** Put test helpers after `main.js`, in `src/test_f.js`: they use `Object.assign(window.__sr, {...})`, and `window.__sr` exists only after boot. (`stationtab.js` uses `queueMicrotask` to get around this. Do not copy that.)
2. **Sprites and the atlas.** Every sprite is drawn in code at start-up. Small sprites are copied into one big atlas (`atl()` / `blit()` in `core.js`). Writing to the atlas after the first frame is slow, so late sprites go to small "late pages", which run out after 24. **Make new sprites at start-up**, inside `initSprites()` in `sprites.js` before `warmAtlas()`, or at load time in a file before `main.js` (like `bakeJet()` in `planes.js`). Call `atl(c)` on each one yourself: `warmAtlas()` only visits `ZS`, `TRAIN`, `FOOT`, `SURV`, `PROPS`, `SCN`, `STATION`, `SAFE` and the `GLOW_COLS` glows. `__sr.late()` returns the number of late pages (`LATE.length`). It is already 1 in the unchanged game after the first frames; it must not grow. Only small sprites go into the atlas (`w*h <= 4096`, or `h <= 12 and w <= 512`, core.js:79). Big ones (bombers) are drawn straight, which is fine.
3. **Unit numbers live in `G.up`.** A run reads its numbers from `G.up`, built once in `newGame()` by `runUp(demo)`, which calls `treeUp(L, up)` in `tree.js`. Put each node's number per level in `UP` (for example `UP.hrate(l)`), and copy it into `up` in `treeUp`. The tooltip's NOW > NEXT line uses the same `UP` function, so the tree and the game always agree. **Never call `lv()` inside run code.** The heli reads `heliRate()`, `heliDmg()` and `heliRange()` at the end of `horde.js` (from `G.up.rate`, `G.up.dmg` and `G.up.heliRange`).
4. **The demo behind the title and the Depot** is a real `G` with `G.demo = true`, built with `runUp(true)`, where every level is 0. New update code must handle `G.demo` (no pay, no tips, no sound spam). To show a new unit in the demo, switch it on with `demo ||` in `runUp`, like `ram: demo || ...` today.
5. **Tutorial moments.** Features call `tutEvent(name, data)` and guard the call with `if (typeof tutEvent === 'function')` (`tut.js` loads later). Add the handler to the `ev` table inside `tutEvent()`. Show tips with `tip(key, msg, at)`. It shows a tip once per save (`SAVE.seen`), and `TUT.tipQ` already keeps it to one tip at a time.
6. **The save.** `SAVE_KEY = 'sky-reaper-save-1'` and `SAVE_V = 1` are in `depot.js`. `loadSave()` throws away a save with another `v`. When the save shape changes, bump `SAVE_V` and read each new field safely in `loadSave()`, as it does now with `num()`/`obj()`. Old saves then start fresh. That is fine for this build, but say it in your report. `qa.js` clears `localStorage` before each scenario.
7. **The font** (`art.js`, `GL`) has capital letters, digits and `. , : ! ? + - / % ' ( ) > < = # * [ ] & $ ×` only. Every other character draws as `?`. **There is no star glyph.** Draw stars as sprites. `ICON.star` (sprites.js:684) already exists and is already in the atlas; scale or recolour it at start-up for the leg stars (T1.8, T6.7).
8. **`explode()` (the 105mm) hurts the train** when the blast is close and `player` is true. **Do not use it for friendly weapons.** For the look, use `boomFx()`, `addBoom()`, `juiceBoom()`, `rings`, `lights`, `stampScorch()`. For damage, use `queryEll()` plus `hitZombie()`/`kill()`. `kill(z, 'he', x, y, dist)` throws the body away from the blast, so use cause `'he'` for blast kills, and always pass `x, y` and `dist`. **Never call `hitZombie(z, dmg, 'he')`**: a lethal hit then calls `kill(z, 'he', 0, 0, 0)` (game.js:985) and the body flies away from world point (0, 0). Use the pattern of `strafeFire()` (planes.js:276-282): `if (z.hp <= dmg) kill(z, 'he', x, y, d); else { JUICE.from = [x, y]; hitZombie(z, dmg, 'boom'); }`. See STYLE_GUIDE 4.8.
9. **Effect limits.** `part()` returns `null` above 2600 particles (about 260 glowing ones). `flames` is capped at 30 in its callers. Keep new effects inside these limits.
10. **Headless time.** `__sr.sim(sec)` steps the game **without drawing**. `__sr.frames(n)` runs whole frames with drawing. Anything that is made in draw code does not happen during `sim()`. Game logic uses `G.t`/`dt`. UI animation uses `realT`. To freeze a screenshot moment, call `__sr.frames(n)` and then `__sr.hold(true)`. `stats().fps` and `worstMs` are always 0 headless (only the real `loop()` updates them); use `bench` and `cost` instead.
11. **The top bar is `y < 19`.** Many input handlers check `p.y >= 19`. After T4.1 the plane band at the bottom must also be kept out of world clicks.
12. **Keys today:** Space = 105mm (`tryHE`), `e` = Turbo Ram, `q` = Strafing Run, `a` and `1-9` = heli selection (`heliKey`), `t` = camera, `m` = mute. WASD pans the tree, but only in the Depot. The design moves them to Q/W/E/R = planes and Space = Ram.
13. **`G.people`** (station survivors) is read by the zombies (`preyNear`, the zombie hunt in `updateZombies`) and by `explode()`. Keep it as an empty array when stations stop having survivors.
14. **Pixel style.** Round every draw position to whole pixels. Never turn on smoothing for sprites. Take colours from `P`/`U` (`sprites.js`) or reuse the colours already used for the same kind of effect. Bullets show **no tracer lines**: muzzle flash stars (`starFlash`, `drawMuzzle`) and hit sparks (`hitSpark`) instead. See STYLE_GUIDE.md.
15. **Comment style.** Each file starts with a header comment that says what it holds. Config tables have one comment line saying what each number is, with its units (px, s, px/s). Write comments in simple English and say "why". No external libraries, no image files.
16. **One scope, so names can clash.** All files share one scope. Before you add a top-level name, grep it (`grep -n "NAME" src/*.js`). A second `const` with the same name is a SyntaxError and the whole build stops. Names like `FIRES`, `CARS`, `DL`, `TREES`, `VZ`, `HITS`, `BOOMS`, `NEAR` and `KILLED` are already taken. `FIRES` (render.js:39) is the list of burning scenery wrecks that `render()` refills from the chunk plans every frame; `CARS` (render.js:39) is the train's cars as draw-list entries.
17. **The root node's id is `'root'`.** Many places find it by id: tree.js (the big double frame, FREE/OWNED, "THE ROOT", the buy sound) and tut.js (`lv('root')`). Keep the id `'root'`; only its name and look change (T2.1).

---

## Test helpers you will add

Create `src/test_f.js` in the first task that needs one of these helpers (T1.3 for `leg` and `legState`), and add it to `ORDER` after `test_t.js` then. Add the other helpers to it as tasks need them (T1.4 adds `win` and `setLeg`). `give` stays in `main.js` and is extended in T1.1. The planned names (keep them):

| Helper | Returns / does | Added in |
|---|---|---|
| `__sr.give(scrap, surv, gold)` | adds money (extend the one in `main.js`) | T1.1 |
| `__sr.leg(n, replay)` | starts leg `n` (1-12) now; `replay` = true rides it as a replay | T1.3 |
| `__sr.legState()` | `{leg, t, len, result, replay, events: [names fired], stars, gold, surv, scrap, wall}` | T1.3 |
| `__sr.win()` | moves the train to just before its station stop | T1.4 |
| `__sr.setLeg(n)` | marks legs before `n` as won (the furthest station = start of leg `n`) | T1.4 |
| `__sr.treeShown()` | the ids of the nodes shown now, with their state | T2.3 |
| `__sr.treeOverlap()` | node pairs closer than 1.2 cells | T2.1 |
| `__sr.units()` | the unit part of `G.up` (rockets, pods, hellfire, planes, cars, gadgets) | T3.3 |
| `__sr.rockets()` | `{shots, rockets, first: s of the first rocket, maxGap: longest s between two}` | T3.3 |
| `__sr.fires()` | the burning ground list (`BURN`) | T3.5 |
| `__sr.planes()` | per plane: `{id, slot, ready, cd, charges}` | T4.2 |
| `__sr.strike(key, sx, sy, ang)` / `__sr.smart(key)` | an aimed strike / a double-tap strike | T4.2 |
| `__sr.ramCd()` | the Ram's cooldown seconds left (a new field) | T5.3 |
| `__sr.wallState()` | `{hp, max, broken, trainStopped}` | T6.3 |

Do not name a helper after one that exists (for example `__sr.ram` already presses the Ram). Run `QA_DONE(Object.keys(window.__sr).sort())` to list them.

---

## Phase 0: Remove what the design removes (the game keeps working)

### T0.1 Baseline
- **Goal:** know the current state before you change anything.
- **Design:** none.
- **Files:** none. Do not change code.
- **Do:**
  - Create the branch. Run the standard checks.
  - Take `node tools/qa.js shot tools/examples/shot_fight.js tools/out/base_fight.png` and `node tools/qa.js shot tools/examples/shot_tree.js tools/out/base_tree.png`.
  - Run the busy-fight scenario of `tools/README.md` section 6 and note `bench(60)`, `cost(20)`, `landBench(5)` and `late()`. These are your baselines (today about 3.3 ms, 2.7 ms render, 2.2 ms per chunk, and `late()` = 1).
- **Done when:** both checks show `qaErrors: []`, you have looked at both screenshots, and the baselines are in your report. There is no commit.

### T0.2 Remove the Station tab (the grid panel)
- **Goal:** the Depot has only the SKILL TREE tab. The station build grid is gone.
- **Design:** 3.3, 11.
- **Files:**
  - **First, move `rclick`** (stationtab.js:506-514, a general right-click input that scenarios use) into `src/test_h.js`, with the same code.
  - Then delete `src/stationtab.js` and remove it from `ORDER` in `build.py`.
  - `depot.js`: `drawDepot` (no `drawStationTab`), `depotKey` (no `stationKey`; Tab does nothing for now), `drawDepotTop` (no STATION tab button), `setTab`, `depotHint`.
  - `ui.js`: the call to `drawHoldBar` near line 165, and any use of `drawWaveArrows`.
  - `tut.js`: references to the station tab.
  - `tools/README.md`: move `rclick` to 5.8, delete 5.14, delete the `queueMicrotask` sentence in section 3, and remove the `'station'` tab from `depot(tab)` in 5.2.
- **Done when:** the standard checks pass. `__sr.depot('tree')` works. `__sr.rclick` still exists. A shot of the Depot shows one tab and no padlocked STATION tab. `grep -n "stationKey\|drawStationTab\|drawHoldBar\|startHint" src/*.js` finds nothing.

### T0.3 Remove station holds and towers
- **Goal:** the train no longer stops to hold stations, and nothing is built at stations. For now the train **rolls through** stations: a short `banner()` with the station name, and no stop. Phase 1 makes the station the end of a leg.
- **Design:** 3.3, 11.
- **Files:**
  - `station.js`: remove `updateHold`, `laneWave`, `placeStationDead`, `trainLeaves`, `refillHouses`, `HOLD_LATER`, the hold parts of `HOLD`, the grid (`FARM_MAP`, `GRID_C`, `tileAt`, `gridToWorld` only if unused), and the survivors at the house. **Keep** `buildStop`'s look: the platform `STATION.slab`, the lamps, the house, and `dressStop()`. **Keep** the braking-point check (station.js, near line 280), but never switch a station to `'braking'` for now: stations are rolled through.
  - `towers.js`: delete it and remove it from `ORDER`. **Keep the corn round stations:** move `buildCorn` and the corn sprites into `station.js`.
  - `game.js`: `step()`: **keep the braking code** (game.js:1220-1225, the `st.state === 'braking'` branch); T1.3 and T6.3 reuse it. Remove only the hold branch (`st.state === 'hold'`) and its call to `updateHold`. `endGame`: no `refillHouses`.
  - `render.js`: remove `drawTowerFx()`.
  - `tut.js`: remove `hold_start`, `p_nest`, `survivor_grabbed`, `survivor_lost`, `waiting()`, the `r_farm`/`r_mill` radio lines, and the end card trigger on `station_held`. Keep `drawEndCard`, you will reuse it in T6.9.
  - `main.js`: in `stats()`, the `station` line.
  - Keep `G.people = []` working (Trap 13).
- **Done when:** the standard checks pass. A scenario rides with the bot past FARM STOP (`__sr.start(); __sr.hp(9999); __sr.bot(true)`, then 60 times `__sr.sim(1)`): `__sr.G.station.state` is never `'braking'` or `'hold'`, `stats().km > 1.05` at the end, and `qaErrors` stays empty. (Do not check that the speed never drops: the Dead Wall at 0.75 km can stop the train.) `grep -n "updateTowers\|buildTowers\|holdNow\|trainLeaves" src/*.js` finds nothing.

### T0.4 Remove Chain Shot, Wingman and Extra Heli
- **Goal:** one heli always. The Chain Shot code is gone (Heli Rockets replace it in T3.3).
- **Design:** 6.1, 11.
- **Files:**
  - `skills.js`: delete `chainFrom`, `zaps`, `drawZaps`, `SK.chain`, `UP.chain`. `roundKills` keeps only the hit-stop.
  - `render.js`: no `drawZaps()`.
  - `tree.js`: delete the nodes `chain`, `wingman`, `extra`. Set `he` to `p: 'hdmg'` until T0.5 deletes it (it hung on `wingman`), so it does not float with no line.
  - `game.js` `runUp`: `helis: 1` (also in the demo), and no `chain`.
  - `sprites.js`: delete `NODE_ART.chain`.
  - `helis.js`: delete `NODE_ART.wingman` and `NODE_ART.extra` (helis.js:154-160, the `Object.assign(NODE_ART, ...)`).
  - `tut.js`: delete `chain_first`, `t_all` (select all helis), and the wingman (`g_wing`) block of `tutTag` (tut.js:356-361).
  - `test_a.js`: remove `chain` and `zaps` from `skills()`.
- **Done when:** the standard checks pass. `stats().helis.length === 1` in the run and in the demo. `grep -n "chain\b\|chainFrom\|wingman\|zaps\|g_wing" src/*.js` finds nothing (except words in comments that you also fixed).

### T0.5 Turn off the 105mm, the Rail Cannon and the Cow Catcher (full game)
- **Goal:** these move to the full game. **Keep their code** (`cannon.js`, `fireHE`/`explode`/`heFire`, `plow`), because the full game will use it, but make it unreachable in the demo.
- **Design:** 10.2, 11.
- **Files:**
  - `tree.js`: delete the nodes `he`, `reload`, `gun`, `gunspd`, `power`, `cow`, `horn`, `autoram`. **Re-parent `ram` to `armor`** (where FINAL_DESIGN 7.4 puts TURBO RAM); `ramtime` and `charge` keep `p: 'ram'`. No node may be left with a deleted parent.
  - `game.js` `runUp`: `he: false`, `gun: 0`, `cow: false`, also in the demo.
  - `main.js`: Space no longer calls `tryHE()`. Leave Space free for now; T5.3 binds it to the Ram.
  - `helis.js`: the 105 parts of `drawUnitCards` and `HUI.arm` must not show.
  - `loot.js`: `rollLoot` no longer gates crates on `G.up.gun`; crates come back as leg events in Phase 6, so for now no crates.
  - `tut.js`: delete `t_he`, `p_gun`, `p_railbrute`, and the 105 summary line.
  - `game.js` `autopilot`/`botPlay`: no 105.
- **Done when:** the standard checks pass. Space in a run does nothing and gives no error. No 105 card. A 30 s bot run has `stats().gun.shots === 0`, or remove that field from `stats()` and say so. `__sr.treeNodes()` has no node whose parent is missing (check it in the scenario).

### T0.6 Remove the old station nodes, the old first-run Ram taste and PRESS E
- **Goal:** no station nodes. No first-run "Ram taste" with the cracked boiler. No PRESS E slow-motion prompt. (The Turbo Ram becomes a plain unlock in T5.3.)
- **Design:** 6.4, 7.4, 11.
- **Files:**
  - `tree.js`: delete `farm`, `nestspd`, `wire`, `mortar`, `syncGiven`, and the `given`/`station` node kinds.
  - `game.js`: remove `G.taste`, the taste part of `scatter()`, `startGame`'s taste block, `ramEnd`'s taste/crack branch, `CFG.ram.taste`/`tasteDur`/`prompt`, the PRESS E part of `updateWalls`, `G.prompt`, `promptLead`, and the prompt part of `camLead`.
  - `main.js` `oneFrame`: no prompt slow-down.
  - `ui.js`: `drawPrompt`.
  - `UP.nest` and `CFG.nest`/`CFG.wire`.
  - `SAVE.flags.taste`/`pressE` uses.
- **Done when:** the standard checks pass. The first run of a fresh save starts with no Ram, no gate crowd and no boiler radio. `grep -n "taste\|pressE\|G.prompt" src/*.js` finds nothing. `__sr.treeNodes()` has no node whose parent is missing.

### T0.7 Phase 0 check
- **Goal:** prove the game still plays.
- **Do:**
  1. Run the standard checks.
  2. Take a 60 s bot run (`__sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(60)`) and print `stats()`.
  3. Take shots of a fight and of the Depot tree.
  4. Send the phase report.
- **Done when:** `qaErrors: []` everywhere, the fight shot looks like `base_fight.png` (same horde, heli, effects), and the tree shows the remaining nodes with no gaps or broken lines.

---

## Phase 1: Legs, stations, the three currencies, the save

### T1.1 Save version 2
- **Goal:** a save shaped for legs and three currencies.
- **Design:** 3, 4, 8.2.
- **Files:** `depot.js` (`SAVE_V = 2`, `freshSave`, `loadSave`, `hasProgress`), `main.js` (`give`, `reach`, `reset` in `__sr`).
- **New SAVE fields:**
  - `gold`
  - `leg`: the next leg to ride, 1..12; 13 = the demo is done.
  - `legs`: by leg number, `{won, stars: [bool, bool, bool], paid: {itemId: true}}`. `paid` is the list of gold items already paid.
  - `rescues`: ids of survivors you lifted.
  - `rescueDue`: ids of missed survivors who wave again.
  - `chest`: 0 = none, 1 = locked, 2 = opened.
  - `hangar`: the plane id in each slot.
  - `flags`: one-off moments, for example `survShown`, `goldShown`, `silverSeen`, `boomSeen`, `rocketShown`.
  - `loadSave` reads each field safely.
- **Keep the old fields for now.** Many files still read `reached`, `held`, `best`, `start`, `towers` and `house`: depot.js (`stationOpen`, `startsOpen`, `pickStart`, BEST KM, START), game.js (`startGame`, `oldBest`, `bankRun`, `endGame`), ui.js (`drawRoute`, the title line), loot.js:100 (the SOS rescue needs `SAVE.held` 'farm'), tut.js, station.js. `SAVE.held.includes` on `undefined` crashes the Depot, the tree (`nodeState` calls `stationOpen` at tree.js:183) and the title. So keep these fields in `freshSave` until T1.3 and T1.8 remove their readers. T1.8 then deletes them (see there).
- **Done when:** the standard checks pass. `__sr.save()` on a fresh game shows the new fields. Edit `localStorage` to an old v1 save, boot: the game starts fresh with no error. `__sr.give(10, 1, 5)` returns `{scrap:10, surv:1, gold:5}`.

### T1.2 The line: 13 stops and 12 legs
- **Goal:** one table that describes the line.
- **Design:** 3.1, 3.3, 8.3.
- **Files:** new `src/legs.js`. Put it in `ORDER` after `station.js` and before `main.js`.
- **Do:**
  - Make `STOPS`: the DEPOT, then the 12 stations of 8.3 with `id`, `name`, `kind` (`'big'`, `'small'`, `'end'`) and `km`.
  - Make `LEGS[1..12]`: `{from, to, len (px of rails), stars (false for legs 1-2), rescue (leg 4, 8, 10), finale (leg 12), events: []}`.
  - A leg is about 60 s at `CFG.train.cruise` (40 px/s), so about 2400 px (proposal). Leg 12 rides 60 s, then holds 30 s at the gate (T6.9).
  - Compute each station's `km` from the leg lengths.
  - Keep `STATIONS` only where other code still needs it, or replace those uses.
- **Done when:** the standard checks pass. A run scenario prints `STOPS.map(s => s.name + ' ' + s.kind)`, which matches 8.3 (B = big, S = small), and `LEGS.length` gives 12 legs. (Your scenario cannot see `STOPS` directly; add a small helper to `test_f.js`, which you create in T1.3, or create it here.)

### T1.3 One run = one leg
- **Goal:** a run starts at the station where the leg begins and ends when the train stops at the next station (won) or breaks (lost). No more "ride until it breaks", no safe zone at 4 km, no NEW BEST km.
- **Design:** 3.1, 11.
- **Files:**
  - `game.js`: `newGame(demo, leg)` builds one leg. The start is at `from`, with the train 60 px after its stop, as today. The goal is the `to` station's stop. `startGame(leg)`. `G.leg`, `G.replay`.
  - When the train stops at the goal: `G.result = 'won'`, `mode = 'ending'`, then `endGame()`.
  - Remove `ride()`'s NEW BEST, `G.oldBest`/`newBest`, `buildSafeZone` (keep the function, T6.9 reuses it), `CFG.line.end`, and the km parts of `drawRoute`/`nextLabel`. These become "NEXT: RED BARN 380 M".
  - `station.js`: `buildLine(leg)` builds the start stop and the end stop only. The end stop brakes the train, with the `'braking'` code you kept in T0.3.
  - `main.js` `__sr.start()` = ride `SAVE.leg`.
  - New `src/test_f.js` (in `ORDER` after `test_t.js`) with `leg(n, replay)` and `legState()`.
- **Done when:** the standard checks pass, with `run_loop` updated if needed. Scenario: `__sr.start(); __sr.hp(9999); __sr.bot(true); __sr.sim(90)` → `legState().result === 'won'`, `SAVE.leg === 2`. Scenario: `__sr.start(); __sr.lose(); __sr.sim(6)` → mode `'summary'`, `SAVE.leg === 1`, scrap banked.

### T1.4 Station rewards and the big station camp [VISUAL]
- **Goal:** the train pulls in and the reward pops up.
  - **Big station**, first arrival: +1 survivor. A survivor climbs aboard with a gold `floatText`, `SFX.saved()` and the `+1` pop of `lootPaid`.
  - **Small station**, first arrival: +6 gold, with coins flying to the counter.
  - **Leg 2, Cornfield Halt:** a locked gold chest instead. It opens when the gold counter first appears in leg 3.
  - A big station shows a **survivor camp** next to the house: tents, a fire barrel and people waving. Draw the new sprites at start-up in `sprites.js`/`scenery.js`, call `atl()` on each, and place them with `dressStop()`.
- **Design:** 3.3, 4 (Gold timing), 8.3.
- **Files:** `station.js`, `scenery.js` (`dressStop`), `sprites.js` (camp sprites, before `warmAtlas()`), `legs.js`, `depot.js` (`chest`), `test_f.js` (`win`, `setLeg`).
- **Survivor counter interpretation (ask the owner if unsure):** the survivor is saved to `SAVE.surv` at arrival and the station pop shows it. The *counter* itself appears later, after the first scrap buy (T1.7).
- **Done when:**
  - Scenario wins leg 1 → `SAVE.surv === 1`. Win leg 1 again as a replay → still 1.
  - Win leg 2 → `SAVE.gold === 0`, `SAVE.chest === 1`.
  - Shots: `t1_4_big.png`, the train at Millbrook with the camp and the reward pop, frozen with `frames` + `hold`, and `t1_4_small.png`.
  - The camp matches the world style in `docs/style/` (bright, clean, dark outlines). `__sr.late()` is not above the T0.1 baseline.

### T1.5 Replays and retries: what pays
- **Goal:** the rules of 3.6.
  - Until a leg is won, rides are first rides or retries: everything pays, but each gold item pays **once** (`SAVE.legs[n].paid`).
  - Replays of a won leg pay scrap only: no survivors, no stars, golden zombie = 10 scrap, golden crate = 25 scrap.
  - Missed stars are never earned on a replay.
- **Design:** 3.6, 12 (decision 1).
- **Files:** `legs.js` (a `payGold(itemId, amount, scrapIfNot)` helper that all gold sources call), `game.js` (`G.replay`), `station.js` (no reward on a replay).
- **Done when:** a scenario pays the same gold item twice in one leg → only once. A retry after a loss pays 0 gold for that item and gives its scrap instead. A replay of leg 1 gives 0 survivors. Print the numbers.

### T1.6 Scrap pay per kill, no distance or station pay
- **Goal:** scrap comes only from kills, piles/crates, walls and silver zombies.
  - Kill pay: walker 1, runner 1, brute 5, silver 15 (proposal numbers of 9.1). Today a kill pays `z.value * CFG.pay.kill`, and `CFG.pay.kill = 0.4` (game.js:36). So: set `CFG.pay.kill = 1`, set the `CFG.types` values to walker 1, runner 1, brute 5, and set `SILVER_PAY` (horde.js:760) to 15.
  - Remove distance pay and station pay: `CFG.pay.dist`, `stop` and `stopAgain`, the pay in `ride()`, and the `G.pay.dist` and `G.pay.stop` counters.
  - Keep the fractional pay pot `G.killAcc` in `kill()`: you may need it in T6.8.
  - Add the run's gold `G.gold`, and bank it in `bankRun()` with `G.banked.gold`.
- **Design:** 4, 9.1.
- **Files:** `game.js` (`CFG.types[].value`, `CFG.pay`, `kill()`, `ride()`, `bankRun()`), `horde.js` (`SILVER_PAY`), `ui.js` (`sumPlan` rows).
- **Known conflict, tell the owner:** today a 30 s bot run kills about 190 zombies. At 1 scrap a kill, leg 1 would pay about 400, but 9.1 wants 80. Do not shrink the horde in this task. T6.8 settles it with the owner.
- **Done when:** `stats().pay` has no `dist` or `stop`. Killing 10 walkers with `__sr.spawn` + `__sr.hit` → `G.cash` grows by 10. One brute → +5.

### T1.7 Currency counters, colours and tips [VISUAL]
- **Goal:** three counters that appear one at a time.
  - **Scrap:** always shown, with the tip "KILLS GIVE SCRAP. SCRAP BUYS UPGRADES." on the first kill.
  - **Survivors:** shown in the Depot after the first scrap buy, with the tip "SURVIVORS CREW NEW UNITS. EACH NEW UNIT COSTS 1." Set `SAVE.flags.survShown`.
  - **Gold:** shown on the first golden zombie catch in leg 3, with the tip "GOLD BUYS SPECIAL NODES." Set `SAVE.flags.goldShown`, and open the chest (+6 gold) at that moment.
  - The colour shows the currency, as in 4: scrap blue (`U.blue`), survivors orange (`U.amber`), gold gold (`U.gold`). See STYLE_GUIDE 2.7. Today the scrap counter is gold and survivors are green, so change both, and say so in your report so the owner can confirm. The kill pop-ups (`addTotal(..., U.gold)` in `kill()`) and the flying coins (`drawCoins`) change to the scrap colour too.
  - Make a small gold coin icon `ICON.goldS` (5x5, `strSpr` + `NPAL`, in `initSprites()`, with `atl()`), and recolour `ICON.boltS`/`ICON.survS` if needed.
- **Design:** 4, 2 (One new thing at a time).
- **Files:** `ui.js` (`drawHUD`), `depot.js` (`drawDepotTop`, `countMoney`, `SHOWN`), `sprites.js` (icons), `game.js` (`kill()` pop colour), `tut.js` (the tips; Phase 7 moves all tips together, here just the three currency tips).
- **Done when:** in a fresh save the HUD shows only scrap. Scenario: one buy → the survivor counter appears with its tip. A gold catch → the gold counter appears with its tip and the chest pops +6. Shots: `t1_7_hud.png` (all three counters, crop 4x), `t1_7_depot.png`. Coins still fly to the right counter (`drawCoins` targets).

### T1.8 The Depot: line map, START button, loss message [VISUAL]
- **Goal:** the Depot of 8.2.
  - **Line map** along the top: stations as dots (big and small look different), legs as lines, 3 small star sprites (`ICON.star`, Trap 7) under each won leg from leg 3, and the current leg highlighted. A click on an old leg selects it as a replay labelled "SCRAP ONLY".
  - **Tabs:** TREE now; HANGAR comes in T4.7.
  - **START:** for example "RIDE TO RED BARN", or "REPLAY: SCRAP ONLY".
  - **After a loss:** "THE TRAIN BROKE. YOU KEEP 143 SCRAP." Then START retries.
  - Remove `pickStart`/`startsOpen` and the START FROM picker.
  - **The game starts directly in leg 1:** from the title, a new save goes straight into leg 1; CONTINUE goes to the Depot.
  - **Remove the old save fields now.** Make `stationOpen()` (depot.js:66) return a constant `false`, or remove it together with its uses in tree.js:183, tree.js:278 and tut.js:363. Remove the other readers of `SAVE.reached`, `SAVE.held`, `SAVE.best`, `SAVE.start`, `SAVE.towers` and `SAVE.house` (see T1.1; for loot.js:100, the SOS rescue no longer needs `SAVE.held`, T6.5 rebuilds rescues). Then delete those fields from `freshSave`. Update `__sr.reach` in `main.js` (remove it, or make it call `setLeg`), and `stats()` (`best`).
- **Design:** 8.2, 3.6.
- **Files:** `depot.js` (`drawDepotTop`, `drawDepotBottom`, `depotHint`, `depotKey` with Enter = start, `stationOpen`, `freshSave`), `ui.js` (`titleGo`, `drawTitle`, `drawRoute`), `legs.js`, `tree.js`, `tut.js`, `loot.js`, `main.js`.
- **Done when:**
  - A scenario with `setLeg(5)` and stars in some legs takes the shot `t1_8_depot.png`. Check it shows the stations, the stars, the selected leg and the START label.
  - `__sr.click()` on leg 2 → START says "REPLAY" and `G.replay` is true after start.
  - A title → new game scenario ends in `mode 'play'` with `G.leg === 1`.
  - Test at 1280x720 and at 640x360 (`shot ... 640 360`): nothing overlaps.
  - `grep -n "SAVE.reached\|SAVE.held\|SAVE.best\|SAVE.start\|SAVE.towers\|SAVE.house" src/*.js` finds nothing.

### T1.9 The leg summary
- **Goal:** the summary screen shows the leg: WON or TRAIN LOST, scrap by source, survivors, gold and stars. It no longer shows km and distance.
- **Design:** 3.5, 3.6, 8.2. The design does not name this screen. Keep it short. **Ask the owner** if it should be skipped; the default is to keep it.
- **Files:** `ui.js` (`sumPlan`, `drawSummary`), `game.js` (`endGame` `G.sum`, `nearMiss` with station names, `wallStop` text without E).
- **Done when:** shots of a won summary and a lost one. The lost one says, for example, "RED BARN WAS 380 M AWAY!". The ENTER and click flow to the Depot still works (`run_loop`).

### T1.10 Example scenario for legs
- **Goal:** a reference scenario for legs. (The helpers `give`, `leg`, `setLeg`, `legState` and `win` already exist from T1.1, T1.3 and T1.4.)
- **Files:** a new `tools/examples/run_leg.js` (rides leg 1 with the bot and `hp(9999)` and prints `legState()`), `tools/examples/run_loop.js` if needed, and `tools/README.md` (add `run_leg.js` to section 4 and the `test_f.js` helpers to section 5).
- **Done when:** `node tools/qa.js run tools/examples/run_leg.js` prints a won leg 1 with `qaErrors: []`.

### T1.11 Phase 1 check
- Ride legs 1-3 in one scenario (`setLeg`, `leg(n)`, bot, `hp(9999)`). Print `SAVE` after each.
- Shots: the HUD, the Depot map, the big station reward.
- Send the phase report.

---

## Phase 2: The new tree (same screen, new content)

### T2.1 Cost tracks and the node table
- **Goal:** every demo node of 7.4 in one `NODES` table. Keep the current tree screen code (`drawTreeTab`, `drawTreeNode`, `drawInfo`, lines, sparks, buy effects).
- **Design:** 7.2, 7.3, 7.4.
- **Files:** `tree.js` (`NODES`, a new `TRACKS` const), node icons in `NODE_ART`. `NODE_ART` is filled in three places: `sprites.js`, `helis.js:154` and `tree.js:874`. Make a 12x12 icon for each node, drawn with `NPAL` letters in the style of the existing icons.
- **Do:**
  - `TRACKS = {A: [15,23,34,51,76,114,171,256], B: [...], ...}`, exactly as in 7.3. A node's `cost` is `TRACKS.C.slice(0, 4)` for "C, 4 levels".
  - `+1 Turret` costs `[40, 100]`.
  - Gold costs come from the table, for example ROCKETS `[4,6,8,10,12]`.
  - Unlocks cost `[1]` with `cur: 'surv'`. Gold nodes use `cur: 'gold'`.
  - `p` = the "Sits next to" node.
  - **The root keeps the id `'root'`** (Trap 17). Set its name to VIPER, owned from the start (`freshSave`: `nodes: {root: 1}`).
  - Layout of 7.2: VIPER in the middle, HELI north (negative y), TRAIN east (cars up-right, gadgets down-right), AIR south, SALVAGE west. Each unit's nodes form a short chain: unlock → damage → speed → area → special. Unlock nodes have `star: true`, the big double frame.
  - Add the FULL GAME teases: Door Gunner, Apache, Rail Cannon Car, Cow Catcher, Mine Layer, Twin MG Car, Auto Pilot ×3, Hangar Slot 3, Hangar Slot 4, B-2, AC-130. Give them `k: 'tease'`; they are never for sale.
  - Remove the old content (`bonus`, `bonusP`, `scav`, `radio`, `cool`, `feed`, `heavy`, `twin`, `strafeN`, ...) and its `UP` entries that nothing reads. Remove the `winch` node (T3.1 makes the winch built in).
  - Add `__sr.treeOverlap()` to `test_f.js`.
- **Done when:** a scenario counts the nodes by kind: **9 unlocks, 10 gold specials, 3 charges, 37 scrap nodes**. It also sums `cost` over the 37 scrap nodes, which must be about **8,800**; print the exact sum. It sums the gold costs, which must be **206**. `__sr.treeOverlap()` returns the node pairs closer than 1.2 cells: it must return `[]`. `__sr.infoFit().bad` must be `[]`. No node has a missing parent.

### T2.2 Colours and prices by currency [VISUAL]
- **Goal:** blue = scrap, orange = survivors, gold = gold, grey with a lock = FULL GAME tease.
  - `NODE_KIND` gets the kinds `scrap` / `surv` / `gold` / `tease`, and `root` stays. Take the values from STYLE_GUIDE 2.7: `scrap` = today's `up` values, `surv` = today's `big` values, `gold` = `#ffd36a #a07a30 #2e2410 #ffb040`, `tease` is drawn as locked (frame `#202838`, hover `#3a4458`, `ICON.lock`). The old pink `spec` kind goes. Change the `n.k === 'spec'` checks too (the kind name in `drawInfo`, tree.js:818).
  - `canPay`, `buyNode`, `priceOf` handle three currencies.
  - The tooltip shows the price with its icon (`ICON.boltS`, `ICON.survS`, `ICON.goldS`).
  - The tooltip's kind label is UPGRADE / NEW UNIT / SPECIAL / FULL GAME.
  - The `boughtFx` float colour follows the currency.
  - A tease's tooltip foot says "FULL GAME".
- **Design:** 7.1, 4.
- **Files:** `tree.js` (`NODE_KIND`, `canPay`, `buyNode`, `boughtFx`, `drawInfo`, `drawTreeNode`).
- **Done when:** a scenario gives money, buys one node of each currency, and hovers each (`__sr.hoverNode`). Take 4 shots, crop the tooltips at 3x, and compare the node look with `docs/style/tree.png` and `docs/style/depot.png`. Buying a gold node lowers `SAVE.gold` only. `grep -n "'spec'" src/*.js` finds nothing.

### T2.3 Visibility: free picking and the reveal order
- **Goal:** the rules of 7.1.
  - A node shows when its parent is owned (level ≥ 1). Every shown node can be bought if you can pay. No other gating.
  - At the very start only VIPER and the 4 ★start nodes show (Gun Damage, Fire Rate, Train Armor, Scrap Magnet). The A-10 is an orange unlock next to the root, so it shows once survivors are shown.
  - Orange nodes show only after `SAVE.flags.survShown`. Gold nodes show only after `SAVE.flags.goldShown`.
  - Silver Hunt shows after the first silver zombie (`flags.silverSeen`), Boom Hunt after the first explosive zombie (`flags.boomSeen`), Gold Hunt after `goldShown`.
  - Teases show grey with a lock when their parent is owned.
  - Rewrite `nodeState`; remove the `hidden`/`soon`/`locked`/`later` states and `needOf`.
- **Design:** 7.1, 7.4 notes, 8.2 (First Depot visit).
- **Files:** `tree.js` (`nodeState`, `shownAs`, `grew`), `test_f.js` (`treeShown`).
- **Done when:** `__sr.treeShown()` on a fresh save = exactly the 5 nodes. After `give(100,0,0)`, buying Gun Damage → Gun Range is still hidden, because its parent is Fire Rate; buying Fire Rate → Gun Range shows. After the survivor flag → MG CAR, TURBO RAM, STEAM VENT (with Armor owned) and the A-10 show. Shots: `t2_3_start.png`, `t2_3_mid.png`. New nodes grow in with the existing line-grow effect.

### T2.4 Depot hints and the goal line for the new tree
- **Goal:** `summaryGoal`, `treeHint`, `tutHint`, `tutTag` speak about the new nodes. Example: "NEXT NEW UNIT: A-10 (1 SURVIVOR)". There is no "CLICK THE TRAIN. IT'S FREE." anymore, because VIPER is owned.
- **Design:** 8.2.
- **Files:** `tree.js`, `tut.js`.
- **Done when:** the summary and Depot shots show sensible lines on a fresh save, after a few buys, and with everything bought. `grep -n "h_star\|CLICK THE TRAIN\|OPEN THE SKILL TREE" src/*.js` finds nothing.

### T2.5 Phase 2 check
- Shots of the tree at the start, mid-game (`give` plus buys) and with everything bought, at zoom 1 and at the widest zoom.
- Send the phase report. Units bought in the tree do nothing in a run yet (T2.6 wires the SALVAGE and Armor nodes; the units come in Phases 3-5). Say so.

### T2.6 Train Armor, Scrap Magnet, Salvage Crew [VISUAL]
- **Goal:** the three SALVAGE/TRAIN stat nodes of 7.4 work in a run, each with a visible sign (design rule "See the change").
  - **Train Armor:** +15% train health per level. `UP.hp(l) = CFG.train.hp * (1 + 0.15 * l)` (today it adds a flat amount per level). Keep the armor plates on the engine as today.
  - **Scrap Magnet:** +25% loot pickup radius per level. `UP.pickup(l) = CFG.heli.pickup * (1 + 0.25 * l)`. Loot inside the radius flies to the heli (reuse `G.lootFly` in loot.js).
  - **Salvage Crew:** +8% scrap from everything per level. `G.up.salvage = 0.08 * l`; it multiplies all scrap, through the `G.killAcc` pot and the loot pay. At level ≥ 1 its `addTotal` pops use the scrap colour `U.blue` and are one size bigger.
  - Copy each value into `up` in `treeUp`, and use the same `UP` functions in the tooltips (NOW > NEXT).
- **Design:** 2, 7.4 (SALVAGE, TRAIN).
- **Files:** `game.js` / `tree.js` (`UP`, `treeUp`), `loot.js`, `game.js` (`kill()` pay).
- **Done when:** `stats().up` shows the 3 values at level 0 and at max. A scenario at Salvage Crew 3 kills 10 walkers and gets about +24% scrap. A shot shows the blue pops.

---

## Phase 3: The heli (VIPER) and its weapons

### T3.1 VIPER start state and controls
- **Goal:** the start heli of 6.1.
  - About **4 shots/s**, and a walker dies in **2 hits**. Proposal: walker `hp: 2`, damage 1. Check that runner and brute hits still feel right.
  - The design has no Cooling node, so the gun never overheats: set the heat per round to 0 and remove the OVERHEAT text and the `p_hot` tip. **Confirm this with the owner.**
  - With one heli, **right click works with no selection**: the heli is always selected. Right click on a zombie = focus it until it dies; this exists, `order 'attack'`. Right click on the ground = fly there.
  - Remove the select tasks (`t_sel`, `t_attack` stays as a tip in Phase 7) and the "CLICK A HELI FIRST" message.
  - **The winch is built in.** Set `CFG.winch.hover = 2` (about 2 s). There is no winch node, and today the winch is gated on `G.up.winch` (loot.js), which `runUp` sets from the deleted node. So in `runUp` (game.js, near line 122) set `winch: true` (also in the demo), and remove the NEEDS THE WINCH text in `drawLoot` (loot.js, near line 357).
- **Design:** 5, 6.1.
- **Files:** `game.js` (`CFG.mg.rate`, `CFG.types`, `CFG.winch`, `runUp`, `UP.rate`), `helis.js` (`heliRight`, `heliShot`, `updateHelis`), `loot.js` (`drawLoot`), `tut.js`.
- **Done when:**
  - Scenario: `spawn(0, ...)` 20 walkers in range, sim 10 s, count `G.shots`/s ≈ 4 (±0.5), and each walker took 2 hits (log `z.hp`).
  - `__sr.rclickH(x, y)` with nothing selected moves the heli.
  - `__sr.lootStats().winch === true`.
  - The muzzle flash and the hit sparks still look as in `docs/style/` (shot `t3_1_gun.png`, crop 4x on the heli, compare with `docs/style/heli.png`).

### T3.2 Gun Damage, Fire Rate, Gun Range, with visible signs [VISUAL]
- **Goal:** each level of these changes the numbers: +20% damage, +12% rate, +15% range, through `UP` and `treeUp` as today. Each also has a small visible sign (design rule 2):
  - **Damage:** a bigger hit flash. Scale `hitSpark`/`starFlash` size with `G.up.heliDmg`.
  - **Range:** a wider ring. Draw a faint dotted range ring on the ground round the heli for the first 3 s of each leg, and while the right button is held (proposal).
- **Design:** 2, 6.1, 7.4.
- **Files:** `tree.js` (`UP.hdmg`/`hrate`/`hrange` numbers), `horde.js` (`hitSpark`, `starFlash`), `helis.js` (`drawHeliGround` for the ring).
- **Done when:** the tooltips show NOW > NEXT right (`__sr.hoverNode`). `stats().up` changes as expected. Shots at damage 0 and 8: the hit flash is clearly bigger. Range 0 and 4: the ring is clearly wider.

### T3.3 Heli Rockets [VISUAL]
- **Goal:** each heli bullet has a chance to be a **rocket**: 5/8/11/14/18% by level, rolled per bullet.
  - **Bad luck:** if 6 s pass with no rocket, the next shot is a rocket.
  - **Forced first rocket:** in the first leg after you buy Rockets, the first rocket fires within 3 s of the start (`SAVE.flags.rocketShown`).
  - A rocket flies a little slower than a bullet (proposal 0.25 s), leaves a **short smoke trail**, and ends in a **big blast** that kills zombies in an area (proposal 16 px). It never hurts the train (Trap 8). Use the blast damage pattern of Trap 8.
  - It replaces the old Chain Shot as the feel of power.
- **Design:** 6.1 (Heli Rockets).
- **Files:**
  - New `src/heliweap.js` (before `main.js`): rocket rounds, plus the pods and hellfire of T3.4-T3.7.
  - `helis.js` `heliShot` (the roll).
  - `game.js` `updateRounds`: a new round kind `'rocket'`.
  - Look: follow STYLE_GUIDE 4.10 ("A rocket in flight" and "A medium blast"): `part()` smoke, `addBoom`, `rings`, `lights`, `stampScorch`, `addShake`.
  - Sound: a new `SFX.rocket` in `audio.js` made with `tone`/`nz`.
  - `test_f.js`: `units()`, `rockets()`.
- **Done when:**
  - `__sr.rockets()` after a 60 s run at level 1: `first <= 3` in the first leg after the buy; `maxGap <= 6.2`; `rockets/shots` between 4% and 12% (the bad-luck rule raises it).
  - At level 5, about 18-25%.
  - A second leg: the forced first rocket is not forced again (`first` can be > 3).
  - Shots `t3_3_trail.png` (frozen mid-flight) and `t3_3_blast.png`, cropped 4x. The trail is short and pixel-crisp, and the blast is bigger and brighter than a hit spark.

### T3.4 Rocket Pods [VISUAL]
- **Goal:** the unit (1 survivor): every 8 s a salvo of 4 small rockets at the **biggest crowd near the heli**.
  - The rockets leave the pods on the heli's stub wings, staggered by about 0.08 s. The heli sprite already has pods: use their positions with `turnXY(h.hd, ...)`.
  - **Pod Damage:** +25%. **Pod Reload:** 8 > 7 > 6 > 5.5 > 5 s. **Pod Salvo:** +1 rocket, up to 7.
- **Design:** 6.1, 7.4.
- **Files:** `heliweap.js`, `tree.js` (`UP` + `treeUp`), `helis.js` (a small pod flash in `drawHelis`).
- **Biggest crowd:** reuse the crowd search in `updatePlanes` (the demo part: count with `queryEll`) as a shared helper `bestCrowd(x, y, R, r)`. Put it in `heliweap.js`; the planes and the Katyusha use it later.
- **Done when:** a 60 s run with pods owned: `units().pods.salvos` ≈ 7. Each salvo has 4 rockets (5 at Salvo 1). Shot of a salvo in flight.

### T3.5 Burning ground and NAPALM [VISUAL]
- **Goal:** a burning ground system, plus Napalm.
  - **Name it `BURN`, not `FIRES`.** `FIRES` already exists (render.js:39, the burning scenery wrecks; Trap 16), and a second `const FIRES` stops the build. Use `const BURN = []`, `updateBurn(dt)`, `drawBurn()` and `drawBurnFx()`.
  - `BURN` holds patches of fire on the ground with a place, a size, a time left and damage per second. They hurt zombies inside them every 0.25 s and are drawn with flickering flames (reuse `drawFlame`), glow (`light()` in the additive pass) and a scorch mark (`stampScorch`). Give the list its own cap (proposal 60 patches).
  - It will also be used by the F-4, Fire Bombs and Fire Wall.
  - **NAPALM** (gold 12): pod rockets leave burning ground for 3 s.
- **Design:** 6.1, 6.2, 7.4.
- **Files:** new `src/fire.js` (before `main.js`), `render.js` (`drawBurn()` in layer 8, with the other flames; `drawBurnFx()` in the additive pass), `game.js` `step()` (`updateBurn(dt)`), `test_f.js` (`fires()` returns `BURN`).
- **Done when:** `__sr.fires()` shows patches after a salvo. Zombies walking in die (count kills with cause `'fire'`). Patches vanish after 3 s. The particle count stays under the caps (`__sr.fx()`). Shot: the pods with napalm hitting a crowd.

### T3.6 Hellfire [VISUAL]
- **Goal:** the unit (1 survivor): every 10 s, 1 guided missile at the **toughest target in range**, in this order: Dead Wall (from T6.3; until then skip it) > brute > golden zombie > the zombie with the most hp.
  - The missile climbs a little, turns toward the target in a curve, leaves a white smoke trail, and makes a big blast (STYLE_GUIDE 4.10, "A big explosion").
  - **Hellfire Damage:** +30%. **Reload:** 10 > 9 > 8 > 7 > 6 s. **Blast:** +20%.
- **Design:** 3.4 (aims at walls first), 6.1, 7.4.
- **Files:** `heliweap.js`, `tree.js`.
- **Done when:** a scenario with 1 brute and 30 walkers in range: the first missile hits the brute. A golden zombie with no brute: it hits the golden one. Shot of a missile mid-curve.

### T3.7 DOUBLE HELLFIRE
- **Goal:** gold 12: 2 missiles at **2 different** targets.
- **Design:** 6.1, 7.4.
- **Files:** `heliweap.js`.
- **Done when:** a scenario with 2 brutes: both are hit in the same salvo.

### T3.8 Phase 3 check
- A 60 s leg with every heli node maxed: `stats()`, `rockets()`, `units()`.
- Performance: the busy-fight scenario of `tools/README.md` section 6 with every heli node maxed. `__sr.bench(60)` must be under 8 ms; if it is over 12 ms, find the cause and fix it. Report `bench(60)`, `cost(20)` and the T0.1 baseline.
- Shots of the heli fighting with everything.
- Send the phase report.

---

## Phase 4: Planes

### T4.1 The plane band below the play area [VISUAL]
- **Goal:** a band about **18 px tall at the bottom** that the world never covers. The world view ends above it.
  - Add a view height `VH` (H minus the band), and use it wherever world code means "the screen". Find the places with `grep -n "\bH\b" src/game.js src/horde.js src/helis.js src/planes.js src/render.js src/loot.js src/ui.js src/tut.js`. Examples: `placeCamera`/`camBase`, `offView`, `viewChunks`, the render clip, `jetEdge`, `addStream` edges, `autopilot`, `inView` in `tut.js`, `drawArrows`, the card row in `drawWeapons`. Grep `VH` first (Trap 16).
  - Clicks in the band never move the heli (Trap 11).
  - The band shows only once you own at least one plane (proposal).
  - Draw it dark like the top bar (`drawHUD` colours: `rgba(6,7,9,0.88)`, line `#24272e`).
- **Design:** 6.2 (How ready planes are shown).
- **Files:** `core.js` or `game.js` (`VH`), the files above, and new `src/air.js` for the band drawing (before `main.js`).
- **Done when:** a shot with a plane owned: the band is visible, the train and the zombies are never under it, and the edge arrows stop above it. With no plane: there is no band and the picture is the same as before.

### T4.2 Plane framework: slots, cooldowns, charges, aiming
- **Goal:** the shared plane logic.
  - A `PLANES` table: `a10`, `f4`, `b52`, `b2`, each with a start cooldown and a floor.
  - Every plane starts each leg **ready**. Cooldowns, not uses. Charges are 1, or 2 with +1 Charge.
  - **Keys:** Q and W (and E, R later) follow the slots in `SAVE.hangar`; until you own more planes than slots, planes fill the slots by themselves.
  - A click on a plane in the band also starts aiming.
  - **While aiming:** the preview follows the mouse, game time runs at 50% (in `oneFrame`, like the old prompt slow-down), left click = confirm, right click = cancel (the heli does **not** move).
  - **The same key twice** (within about 0.35 s, proposal) = smart strike at the biggest crowd (`bestCrowd`, no aiming).
  - **In the band:** ready planes fly a slow small loop in their own spot with their key letter. With 2 charges a plane shows "2"; after one strike "1" and a tiny clock filling for the used charge. After the last charge the spot shows only a tiny dim icon with a filling clock. When ready it **swooshes back in from below** with a sound (`SFX`).
  - Move the Strafing Run's `STRAF`, `tryStrafe`, `strafeDown`/`Up`/`Cancel` and `drawStrafeCard` into this framework, and remove the old STRAFE card.
- **Design:** 5, 6.2.
- **Files:** `air.js`, `planes.js`, `main.js` (keys `q w e r`; remove `'e'` = Ram and `'q'` = strafe), `ui.js` (`drawWeapons`), `test_f.js` (`planes`, `strike`, `smart`).
- **Done when:**
  - `__sr.planes()` at leg start: all ready.
  - After `strike('q', ...)`: `cd === 25`, and ready again after 25 s of `sim`.
  - Double tap with `__sr.press('q')` twice → a strike lands at the biggest crowd. A scenario puts a crowd of 40 on one side; the strike point is within 30 px of it.
  - Right click while aiming → no strike, heli order unchanged.
  - Shots of the band: ready, used, 2 charges.

### T4.3 The strike show [VISUAL]
- **Goal:** every plane strike looks like 6.2 (What the strike looks like).
  1. A red marker blinks on the ground.
  2. The plane's shadow races in from the screen edge.
  3. The plane roars over, high, **bigger than the heli**, with jet trails.
  4. It hits along its path and leaves on the other side.
  - Planes cannot be hit. Reuse `drawPlaneShadows`, the trail parts of `updatePlanes` and `drawPlanes`. Add the marker (copy `drawShellMarks()`, STYLE_GUIDE 4.10) and a roar sound.
- **Design:** 6.2.
- **Files:** `planes.js`, `air.js`, `audio.js`.
- **Done when:** a sequence of 4 shots (marker, shadow coming, plane over, after) with `frames` + `hold`. Compare with `docs/style/strafe.png` for the jet look.

### T4.4 A-10 (from the Strafing Run) [VISUAL]
- **Goal:** the existing jet becomes the A-10 unit (1 survivor): **1 thin strafe line, 25 s cooldown**.
  - **A-10 Damage:** +25%. **A-10 Cooldown:** 25 > 22 > 19 > 16 > 14 > 12 s. **Wider Line:** 1 > 2 > 3 > 4 gun lines; replace `UP.strafeW` with line count, each line like today's band. **BOMB RUN** (gold 12): 4 bombs at the end (`dropBombs` drops 3 today). **A-10 +1 Charge** (gold 15).
  - The aim preview is a line, and you drag to turn it: reuse `drawStrafeAim` and `strafeDir`.
  - Remove `twin`, MORE RUNS and `G.up.strafe` as a count.
- **Design:** 6.2, 7.4, 11.
- **Files:** `planes.js`, `tree.js`.
- **Done when:** `planes()` shows A-10 cd 25 at level 0 and 12 at level 5. Bomb Run drops 4 (`strafeState().bombs`). Shots of 1 line and 4 lines.

### T4.5 F-4 [VISUAL]
- **Goal:** the unit (1 survivor): a napalm fire line that burns 4 s, 30 s cooldown.
  - A new F-4 sprite: a swept-wing jet, drawn like `jetRaw()` and baked at headings like `bakeJet()`, at load time, with `atl()` on each.
  - The fire line uses `BURN` (T3.5).
  - **Fire Damage:** +25%. **F-4 Cooldown:** 30 > 27 > 24 > 21 > 18 > 15 s. **Longer Fire:** +20% length, +1 s burn. **FIRE WALL** (gold 15): burns 12 s and **zombies do not walk through it** (they stop or turn at the line in `updateZombies`). **F-4 +1 Charge** (gold 18).
  - The aim preview is a fire line.
- **Design:** 6.2, 7.4.
- **Files:** `planes.js` (or new `src/f4.js`, before `main.js`, if `planes.js` gets too big), `fire.js`, `horde.js` (the Fire Wall block), `tree.js`.
- **Done when:** a scenario with a Fire Wall across a stream: no zombie crosses in 12 s (count positions). Shots of the F-4 pass and the burning line.

### T4.6 B-52 [VISUAL]
- **Goal:** the unit (1 survivor): **8 small bombs in a long lane**, 45 s cooldown.
  - A new big B-52 sprite (8 engines, long wings; bigger than the A-10). Bombs fall in a row along its path.
  - **More Bombs:** +2 bombs, up to 16. **B-52 Cooldown:** 45 > 40 > 35 > 30 > 25 s. **Bigger Bombs:** +20% blast. **FIRE BOMBS** (gold 15): the bombs leave burning ground (`BURN`). **B-52 +1 Charge** (gold 20).
  - The aim preview is a long lane of bomb marks.
  - Use the bomb look of `bombHit` without its fixed radius.
- **Design:** 6.2, 7.4.
- **Files:** `planes.js` or `src/b52.js` (before `main.js`), `tree.js`.
- **Done when:** a strike drops 8 bombs at level 0 and 16 at max. Shots mid-run and after; the lane of craters reads clearly.

### T4.7 Hangar slots and the HANGAR tab [VISUAL]
- **Goal:** 2 slots (Q, W).
  - The HANGAR tab appears in the Depot when you own more planes than slots: "3 PLANES, 2 SLOTS: PICK WHICH TO BRING."
  - Drag planes into Q and W. The choice is saved in `SAVE.hangar`.
  - Tip: "PICK WHICH PLANES TO BRING."
- **Design:** 6.2 (Hangar slots), 8.2.
- **Files:** `depot.js` (tabs, `depotTabBtn`), new `src/hangar.js` (before `main.js`).
- **Done when:** with 3 planes, a scenario drags B-52 into Q (or sets it through a helper and also tests the drag with `__sr.click`). The next leg's `planes()` has B-52 on Q and A-10 on W. Shot of the tab.

### T4.8 B-2 (sprite and strike only)
- **Goal:** the B-2 flying-wing sprite and its strike: **one big blast in a small circle**, and the circle aim preview. It is not in the tree. T6.9 gives it as the finale gift.
- **Design:** 6.2, 8.4.
- **Files:** `planes.js` or `src/b2.js` (before `main.js`).
- **Done when:** a test helper calls one B-2 strike. Shot of the blast. It must be the biggest blast in the game (STYLE_GUIDE 4.10: `boomFx(x, y, true)` plus your own rings).

### T4.9 The bot uses planes
- **Goal:** the autopilot (`autopilot`/`botPlay`) smart-strikes each ready plane when a crowd of 15+ is in view, so QA runs use the planes.
- **Files:** `game.js`.
- **Done when:** a 60 s bot run with all planes owned shows several strikes in `planes()`.

### T4.10 Phase 4 check
- Shots of each plane's aim preview and strike. Run the standard checks. `__sr.late()` is not above the T0.1 baseline. The busy-fight `bench(60)` with all planes striking is under 8 ms. Send the phase report.

---

## Phase 5: Train cars and gadgets

**Placement proposal (confirm with the owner):** the train keeps its 5 cars (`CAR.n`), so the guns mount on existing cars. The MG turrets go on the box car (car 3) and the Katyusha rack on the flatcar (car 2), replacing the riders there. Draw them from `drawCar(i)` in `render.js`, the way `drawCannon()` is drawn today.

### T5.1 MG Car [VISUAL]
- **Goal:** the unit (1 survivor): **1 slow turret, 2 shots/s, short range**, automatic.
  - Small turret sprites at headings. Use the slice technique of `turretSlices` in `cannon.js`, but smaller. Bake them at start-up and call `atl()` on each.
  - Muzzle flash stars and hit sparks like the heli (`starFlash`, `hitSpark`), at about 60% of the heli's sizes (STYLE_GUIDE 4.10), and **no tracer lines**.
  - **MG Damage:** +25%. **MG Fire Rate:** +15%. **MG Range:** +15%. **+1 Turret:** 1 > 2 > 3 turrets on the car. **AP ROUNDS** (gold 12): each bullet goes through up to 3 zombies in a line.
  - **Do not name anything `CARS`**: it exists in render.js (Trap 16). Use names like `MGCAR`.
- **Design:** 6.3, 7.4.
- **Files:** new `src/cars.js` (before `main.js`), `render.js` (`drawCar`), `tree.js`.
- **Done when:** a 30 s run with the MG Car: `units().mg.kills > 0`, about 2 shots/s per turret. 3 turrets show at +1 Turret 2. Shot cropped 4x on the car, matching `docs/style/train.png`.

### T5.2 Katyusha Car [VISUAL]
- **Goal:** the unit (1 survivor): **6 rockets every 15 s at the biggest crowd ahead**.
  - The rockets launch one after another from the rack, arc up with smoke trails, and blast (`bestCrowd`).
  - **More Rockets:** +2, up to 14. **Katyusha Reload:** 15 > 13.5 > 12 > 10.5 > 9 s. **Katyusha Blast:** +20%. **CLUSTER ROCKETS** (gold 15): each rocket splits into 3 small bombs.
- **Design:** 6.3, 7.4.
- **Files:** `cars.js`, `render.js`, `tree.js`.
- **Done when:** a 60 s run: about 4 salvos of 6. Cluster → 18 small blasts per salvo. Shots of the launch (frozen) and of the impacts.

### T5.3 Turbo Ram rework
- **Goal:** the Ram is an unlock (1 survivor) on **Space**.
  - A **2 s charge**, **cooldown 20 s**. Remove the kill-charge: `CFG.ram.charge`, `chargeRam`, `ramFill`, `G.up.ramCharge`, RAM CHARGE/RAM TIME.
  - Keep the cooldown in a new field (for example `G.ram.cd`, seconds left), and add `__sr.ramCd()` to `test_f.js`.
  - It smashes everything on the rails. Keep the current look: `ramStart`, `ramFx`, `juiceRamFx`, the roar, and the camera lead.
  - **Ram Power:** +30% smash damage. **Ram Cooldown:** 20 > 18 > 16 > 14 > 12 s. **Long Charge:** 2 > 2.5 > 3 > 3.5 s, wider smash band. **SHOCKWAVE** (gold 10): a ring blast at the end of the charge.
  - The Ram card (`drawRamCard`) shows SPACE when ready and a filling clock in cooldown. Keep it just above the plane band.
  - "Smash damage" has no number in the design. Proposal: a smash kills walkers and runners at once and deals damage to brutes and the Dead Wall; one charge always breaks a Dead Wall (T6.3). Ask the owner if unsure.
- **Design:** 3.4, 6.4, 7.4.
- **Files:** `game.js` (`CFG.ram`, `ramState`, `tryRam`, `ramStart`, `updateRam`, `ramEnd`), `main.js` (Space → `tryRam`), `ui.js`, `tree.js`, `test_f.js`.
- **Done when:** start the scenario with `__sr.leg(n)` and do the check in the first 30 s of the leg (`ramState()` returns `'stop'` near a station, so do not test there). After a ram, `__sr.ramCd()` counts down from 20 and the Ram can start again when it reaches 0. At Ram Cooldown 4 it starts at 12. `stats().ram` shows kills. Shot of the card in both states.

### T5.4 Steam Vent [VISUAL]
- **Goal:** the unit (1 survivor): **every 5 s, hot steam blasts the zombies that climb on the train** (`z.st === 2`).
  - White steam puffs burst from vents along the cars (smoke `part()`s, white and fast-growing, like the steam jet in `ramStart`).
  - **Steam Damage:** +25%. **Vent Speed:** 5 > 4.4 > 3.8 > 3.2 > 2.5 s. **Steam Reach:** it also hits zombies next to the train, and the cloud grows. **HOT CLOUD** (gold 10): the steam stays 2 s and hurts every zombie that enters.
- **Design:** 6.4, 7.4.
- **Files:** new `src/gadgets.js` (before `main.js`), `tree.js`.
- **Done when:** a scenario puts 10 climbers on the train and sims 5.5 s: they die. With Hot Cloud a stream walking into the train dies in the cloud. Shot of a vent blast.

### T5.5 Phase 5 check
- A 60 s leg with every car and gadget maxed. Shots of the train with all its guns firing.
- Performance: the busy-fight scenario with all cars and gadgets maxed. `bench(60)` under 8 ms; report it with the T0.1 baseline.
- Send the phase report.

---

## Phase 6: Leg content

### T6.1 The leg event system
- **Goal:** each leg runs a timeline of events, **about one every 10 s**, on top of a small base trickle of streams.
  - `LEGS[n].events = [[t, kind, params], ...]`.
  - Event kinds from 3.2, built on the existing spawners:
    - `railCrowd`: `railGroup`
    - `stream`: `addStream` from one edge
    - `wave`: streams from both sides at once
    - `pile` / `crate`: `addFind` in `loot.js`; "fly near it to collect it", with Scrap Magnet radius
    - `golden`: T6.4
    - `goldCrate`
    - `silverGroup`: a few `silverRoll`-ed zombies
    - `deadWall`: T6.3
    - `rescue`: T6.5
  - Replace the by-km `HORDE` rows (horde.js) with a per-leg base row; keep the `horde()` blend code if useful.
  - Each event can show a short warning (`banner()` or an edge arrow like the stream marks).
  - Example leg 1 (proposal): `[[3,'railCrowd',{n:6}], [12,'stream',{edge:-1,n:12}], [22,'pile'], [32,'stream',{edge:1,n:14}], [42,'railCrowd',{n:8}], [52,'wave',{n:10}]]`.
- **Design:** 3.1, 3.2.
- **Files:** `legs.js`, `horde.js` (`spawn`), `loot.js` (piles and crates as events; remove the km-based `rollLoot` piles and the old `CRATES`).
- **Done when:** `legState().events` after a 60 s leg 1 lists the events in order. The gap between events is 8-12 s. Leg 1 has no runners, brutes or golden zombies.

### T6.2 The 12 legs table
- **Goal:** fill `LEGS` from 8.3 "New this leg": walkers only in leg 1, runners from 2, golden + stars from 3, rescue + silver from 4, the first Dead Wall in 5, brutes + golden crate in 6, explosive zombies in 7, the first big two-sided wave in 8, a Dead Wall during a stream in 9, brute escorts (brutes leading runner packs) in 10, the densest horde in 11, the finale in 12. Each leg grows a little harder.
- **Design:** 8.3.
- **Files:** `legs.js`.
- **Done when:** a scenario prints, for each leg, the zombie types that appeared (`type`, `gold`, `silver`, `boom` flags), and they match the table. No brute before leg 6.

### T6.3 Dead Walls with a health bar [VISUAL]
- **Goal:** a Dead Wall is a wall of zombies and wrecks on the rails, with **one health bar**.
  - The train brakes and **stops** in front of it, with the station braking code (kept in T0.3). Zombies swarm the train while you break it.
  - **Every weapon damages it:** heli bullets (the heli targets it when nothing is on the train), rockets, pods, Hellfire (top priority), the MG, the Katyusha, the planes. Turbo Ram: **one charge breaks it**.
  - A broken wall drops a **scrap pile** and opens with a big crash: wrecks thrown (bodies like `kill(.., 'he', x, y, dist)`), dust, shake (STYLE_GUIDE 4.10, "A big explosion").
  - Tune: a Viper with a few upgrades breaks the leg-5 wall in **8-10 s** (proposal).
  - Rework `WALLS`, `placeWall`, `updateWalls`, `wallZone`, `wallAhead`, `wallStop`; drop the old "the train runs into it" logic.
  - The HP bar uses `bar()` in world space over the wall.
  - Tips: "A DEAD WALL! SHOOT IT DOWN." / "A DEAD WALL! PRESS SPACE TO RAM IT." (Phase 7).
- **Design:** 3.4.
- **Files:** `game.js`, `legs.js`, new wall sprites in `sprites.js` (wrecks + packed zombies, before `warmAtlas()`, with `atl()`), `test_f.js` (`wallState`).
- **Done when:**
  - Scenario leg 5 with Gun Damage 2, Fire Rate 2: `wallState()` goes from full to broken in 8-10 s after the train stops. Print the time.
  - A Ram at the wall → broken at once.
  - The train starts again after the break.
  - Shots: the wall ahead with its bar, mid-fight, and the break.

### T6.4 Golden zombies, golden crates and gold [VISUAL]
- **Goal:**
  - **Golden zombie:** each leg from 3 has its golden zombie. It **runs across the screen** from one edge to the other and **escapes** if you are slow. Use `makeGold`; change `goldFlee` into a run across. Caught: **1 gold** (once per item, T1.5) and the star 3. Escaped: nothing. Tip "CATCH THE GOLDEN ZOMBIE!".
  - **Golden crate** (rare, from leg 6): **5 gold**.
  - On a replay: 10 and 25 scrap instead.
  - **Gold Hunt** (proposal): each level adds 1 more golden zombie event to each leg from leg 3, with its own item id, so gold is still paid once.
  - Keep `goldKill`'s look and `juiceGold`.
- **Design:** 3.2, 3.5, 3.6, 4, 9.2.
- **Files:** `skills.js`, `legs.js`, `loot.js`.
- **Done when:** leg 3 scenario: the golden zombie appears, and `legState().gold` is +1 when it is caught. Let it run: it leaves the screen and is gone. A retry pays 10 scrap for it. Shot of the golden zombie running with its tip.

### T6.5 Rescues with the winch [VISUAL]
- **Goal:**
  - A survivor **waves in a field** (legs 4, 8, 10). Hover the heli over him for about 2 s and the winch lifts him. Reuse `sosStep` and the rope look in `loot.js`. The winch is always on (T3.1).
  - He is **yours at once**: save `SAVE.surv` and `SAVE.rescues` immediately, even if the train breaks later.
  - Missed: he **waves again in the next leg you ride** (`SAVE.rescueDue`).
  - Never on a replay. Each rescue happens once.
  - Tip: "HOVER OVER HIM TO WINCH HIM UP."
- **Design:** 3.2 (Rescue rules), 8.3.
- **Files:** `loot.js`, `legs.js`.
- **Done when:** `lootStats().winch === true`. Scenario leg 4, `lootGo` over him, sim 2.5 s → `SAVE.surv` +1 and `rescues` has him. Then `lose()` → he is still counted. A missed rescue in leg 4 shows up in leg 5. Shot of the winch lift.

### T6.6 Silver and explosive zombies, and their Hunt nodes [VISUAL]
- **Goal:**
  - **Silver** zombies come in silver groups from leg 4. Use `silverRoll`/`silverSet`; they pay 15 scrap.
  - **Explosive** zombies from leg 7 must be **visible before they die**. Today `boomRoll` only rolls at death. Make an explosive sprite set at start-up in `makeHordeSprites()`, like `silverSet()`: for example a swollen orange-red body with a blinking light. It keeps the dark outline, dark head and red mouth (STYLE_GUIDE 2.2). Roll it at spawn. On death it blows up its neighbours (`zombieBlast`).
  - Set `flags.silverSeen`/`boomSeen` on the first one seen; this reveals Silver Hunt / Boom Hunt (T2.3).
  - **Silver Hunt:** more silver, using `UP.silver`. **Boom Hunt:** more explosive.
- **Design:** 3.2, 7.4 (SALVAGE), 8.3.
- **Files:** `horde.js`, `legs.js`, `tree.js`.
- **Done when:** the leg 7 scenario shows explosive zombies; killing one kills 3+ nearby walkers. Shot cropped 4x: the explosive zombie reads clearly next to walkers and silver ones (compare with `docs/style/zombies.png`).

### T6.7 Leg stars [VISUAL]
- **Goal:** from leg 3, 3 stars per leg, each worth **3 gold**, paid once:
  1. reach the station;
  2. arrive with 75% or more train health;
  3. catch the leg's golden zombie (it counts at the moment you catch it).
  - Show them as 3 small star sprites (from `ICON.star`, Trap 7) in the HUD during the leg, on the summary, and on the Depot map. A star lights with a pop when earned. Replays never earn missed stars.
- **Design:** 3.5, 12 (decision 1).
- **Files:** `legs.js`, `ui.js`, `depot.js`, `sprites.js` (star sprites, at start-up with `atl()`).
- **Done when:** leg 3 scenario with `hp(9999)`, catch the golden zombie, win → 3 stars, +9 gold. A replay with everything → +0 gold. Shots of the HUD stars and the Depot map.

### T6.8 Scrap balance per leg
- **Goal:** a clean first pass pays the scrap of 9.1, ±15%:

  | Leg | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
  |---|---|---|---|---|---|---|---|---|---|---|---|---|
  | Scrap | 80 | 95 | 115 | 135 | 160 | 190 | 225 | 265 | 310 | 365 | 430 | 500 |

  The split is about 60% kills, 30% piles and crates, 10% walls and silver.
- **Design:** 9.1.
- **Before you tune: ask the owner.** The design wants a big readable horde (Orc Problem style) and also small scrap totals. Either the horde gets smaller, or the pay per kill gets smaller (for example walker 0.25 through the `G.killAcc` pot). This is a design choice. Show the owner the numbers from a bot run and wait.
- **Files:** `legs.js`, `game.js` (`CFG.types[].value`, `CFG.pay`), `loot.js` (pile and crate pay).
- **Done when:** a scenario rides each leg with the bot, a typical tree for that leg (the "Likely buy" column of 8.3) and `hp(9999)`. It prints the scrap by source for each leg, and every leg is inside ±15% of the table.

### T6.9 The finale: leg 12 and the B-2 gift [VISUAL]
- **Goal:**
  - Leg 12 is about **90 s**: 60 s of riding, then the **Farmlands Terminus gate is closed** and the train **holds 30 s** while the finale horde pours in from all sides. Reuse `buildSafeZone()` and the `SAFE` sprites for the gate wall and towers.
  - At the peak a radio call (`radio()`), and the **B-2** appears in a third slot **E** as a **one-time gift**, on **every try**. Tip: "A B-2 JOINS YOU, ONCE! PRESS E TWICE TO STRIKE." After its strike the E spot shows "FULL GAME".
  - The gate opens, the train rolls in, and a **"THANKS FOR PLAYING"** card appears. Reuse `drawEndCard` in `tut.js`.
  - Then the Depot: the tree still shows the FULL GAME teases, and replays stay open.
- **Design:** 8.4.
- **Files:** `legs.js`, `game.js` (`arrive`), `air.js`, `tut.js`.
- **Done when:** a scenario rides leg 12 with `hp(9999)` and the bot: the gate holds 30 s (print the time), the B-2 is in slot E, after its strike E shows FULL GAME, the end card shows, and `SAVE.leg === 13`. A retry gives the B-2 again. Shots: the gate hold with the horde, the B-2 strike, the end card.

### T6.10 Phase 6 check
- A full playthrough scenario: legs 1-12 in a row with the bot, `hp(9999)` and the "Likely buy" tree after each leg. Print scrap, gold and survivors after each leg.
- Expected end: **9 survivors**. Gold about 160 if perfect, 120-140 typical (9.2).
- Send the phase report with the table.

---

## Phase 7: Tips on first use

### T7.1 All tips, one at a time
- **Goal:** every tip of the design, each once, one at a time. If two are due together, the second waits; `TUT.tipQ` already does this.
  - **Leg tips (8.3):**
    - "RIGHT-CLICK TO MOVE YOUR HELI." then "KILLS GIVE SCRAP."
    - "CATCH THE GOLDEN ZOMBIE!"
    - "HOVER OVER HIM TO WINCH HIM UP."
    - "A DEAD WALL! SHOOT IT DOWN." (or "PRESS SPACE TO RAM IT." if you own the Ram)
    - "RIGHT-CLICK A BRUTE TO FOCUS IT."
    - "EXPLOSIVE ZOMBIES BLOW UP THEIR FRIENDS."
    - the B-2 tip
  - **Currency tips (4).**
  - **First-use tips (8.5):**
    - first leg with a plane: "PRESS Q (OR CLICK THE PLANE), AIM, THEN LEFT CLICK. RIGHT CLICK CANCELS."
    - after your 2nd strike: "PRESS Q TWICE TO HIT THE BIGGEST CROWD."
    - first leg with the Ram: "PRESS SPACE TO RAM!"
    - more planes than slots (Hangar)
    - first +1 Charge: "THIS PLANE NOW HOLDS 2 STRIKES."
  - No tips for MG Car, Katyusha, Steam Vent, Rocket Pods, Hellfire.
  - Remove every old tip and task that no longer fits (grep `tip('`, `task('`, `radioOnce(`, `bannerOnce(` in `tut.js`).
  - Check every tip string uses only the font's characters (Trap 7). The `-` in "RIGHT-CLICK" is fine.
- **Design:** 2 (One new thing at a time), 4, 8.3, 8.5.
- **Files:** `tut.js` (the `tutEvent` table, `tutLook`); feature files send `tutEvent`s.
- **Done when:** a scenario rides legs 1-7 with a plane and the Ram bought along the way and prints `__sr.seen()` in order after each leg. The order matches the design, and no two tips were on screen at once (sample `tutState().tip` every 0.5 s). Shot of one tip with its arrow.

---

## Phase 8: Polish and full QA

### T8.1 Sounds for every new thing
- **Goal:** each new weapon, event and reward has a sound in `SFX` (`audio.js`), made with `tone`/`nz` like the others, with `gap`/`voice` limits so crowds do not get too loud.
- **Done when:** a list in your report of every new SFX name and where it plays. A 60 s maxed leg has no audio errors.

### T8.2 The demo behind the title and the Depot
- **Goal:** the demo shows the new toys (a heli with rockets, a plane pass now and then, the MG Car), through `runUp(true)` and `updatePlanes`'s demo part. There are no tips, pay or sounds spam in the demo.
- **Done when:** a title screenshot shows the demo fight, and `qaErrors` is empty after 60 s on the title (`__sr.title(); __sr.sim(60)`).

### T8.3 Screen sizes and reduced motion
- **Goal:** everything works at a narrow window (`shot ... 640 360` and `... 700 1000`) and at `1920 1080`. The HUD, the plane band, the Depot map and the tree tooltips never overlap or leave the screen. Under `REDUCED`, shakes and slow motion stay off.
- **Done when:** shots at the 3 sizes, of a run and of the Depot.

### T8.4 Performance
- **Goal:** the maxed finale stays smooth.
- **Done when:** in leg 12 at the gate hold with everything maxed, report `__sr.bench(60)`, `__sr.cost(20)` (from `test_z.js`) and `__sr.landBench(5)`, next to the T0.1 baseline. `bench(60)` must be under 8 ms. If it is over 12 ms, find the cause and fix it (report before and after). `__sr.late()` is not above the T0.1 baseline. (Do not report `stats().fps`/`worstMs`: they are always 0 headless.)

### T8.5 Clean-up and docs
- **Goal:**
  - Remove dead code left by the old design that is not kept for the full game. Keep `cannon.js`, the 105 and `plow`, as T0.5 says.
  - Update the test files (`test_a.js`, `test_t.js`, `test_h.js`) to the new game.
  - Update `README.md` (how to play the demo, the keys) and `tools/README.md` (the new `__sr` helpers and `tools/scenarios/`).
- **Done when:** every scenario in `tools/scenarios/` still runs with `qaErrors: []`. Run them all in one loop (one after another, never two at once) and report.

### T8.6 Final report
- A full 12-leg playthrough table: scrap, gold, survivors, stars and time per leg.
- The list of all proposals you chose.
- One screenshot per [VISUAL] task in `tools/out/final/`.
- The open questions for the owner.
