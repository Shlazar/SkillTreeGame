# tools/ - testing Sky Reaper headless

`__sr.audioState()` returns a copied audio diagnostic: initialization/mute/context state,
scheduled source count, per-cue `{requests, played}` totals, and each voice pool's `{active, max}`.
The T8.1 scenario checks sixty seconds of maxed combat, the real B-2 gift, a rescue and a silver reward.

`tools/qa.js` plays the game in headless Chrome from the command line. It has two modes:

- **run**: run a scenario and print its result as JSON.
- **shot**: run a scenario and save a PNG screenshot.

Use it after every change. Do not say "it works" until a run and a screenshot show it.

Files:

| File | What it is |
|---|---|
| `tools/qa.js` | The test runner (run and shot modes). |
| `tools/examples/*.js` | Reference example scenarios, including the `ref_*.js` files that made `docs/style/`. Copy one when you write your own. |
| `tools/scenarios/*.js` | Your own scenarios, one file per task (see BUILD_PLAN.md). Create the folder when you need it. |
| `tools/crop.py` | Cuts a box out of a screenshot and enlarges it, so you can see the pixels. |
| `tools/out/` | All outputs: screenshots, temp pages, the Chrome profile. Git ignores it (`.gitignore`: `tools/out/`). |

---

## 1. Requirements

- **Node** (tested with v22). Runs `tools/qa.js`.
- **Python 3** as `python` on the PATH (tested with 3.10). `qa.js` runs `python build.py` first every time.
- **Pillow** (`pip install pillow`). Only `tools/crop.py` needs it.
- **Google Chrome** at `C:/Program Files/Google/Chrome/Application/chrome.exe`. If Chrome is somewhere else, set `CHROME`:
  - PowerShell: `$env:CHROME = "D:/Chrome/chrome.exe"`
  - bash: `export CHROME="D:/Chrome/chrome.exe"`

You need no npm packages and no server. The page opens as a `file:///` URL.

---

## 2. The two modes

Run every command from the repo root (`C:/Users/Shlazar/Desktop/UnityProjects/SkillTreeGame`).

### run mode: print a JSON result

```
node tools/qa.js run <scenario.js> [budgetMs]
```

What it does, in order:

1. Runs `python build.py`. This joins `src/*.js` (in the `ORDER` list in `build.py`) into `index.html`. If the build fails, it prints `BUILD FAILED` and exits with code 2.
2. Makes a temp page in `tools/out/`. The page holds the game, an error catcher, and your scenario.
3. Runs Chrome headless with `--dump-dom` and `--virtual-time-budget=budgetMs` (default 5000), then reads the result.
4. Prints one JSON line: `{"result": <what you passed to QA_DONE>, "qaErrors": [...]}`.

Example (verified):

```
node tools/qa.js run tools/examples/run_loop.js
{"result":["title","depot","play","summary","depot"],"qaErrors":[]}
```

- `qaErrors` collects every page error (`window` error events and every `console.error`), including errors during boot. **It must be `[]`.**
- If the scenario throws, the error goes into `qaErrors` as `"SCENARIO: <message>\n<stack>"`, `result` is `null`, and the exit code is still 0. Always read `qaErrors`.
- If the scenario never calls `QA_DONE`, it prints `{"error":"no QA_DONE output (scenario did not finish or page crashed)", ...}` and exits with code 3.
- **The view is smaller in run mode than in shot mode.** At 1280x720 today, `__sr.stats()` in run mode gives `W 632`, `H 313`, `SCALE 2`. Screen-pixel arguments that suit 640x360 (for example `sy = 340`) are off screen in run mode. Read `__sr.stats().W` / `.H` and keep `sx < W` and `sy < H` in run scenarios.

### shot mode: save a screenshot

```
node tools/qa.js shot <scenario.js> <out.png> [budgetMs] [W H]
```

- It builds, runs the scenario, then lets Chrome run **live frames** for `budgetMs` of virtual time (default 3000). After that it saves the screenshot.
- The window is 1280x720 by default. At that size the game is about 640x360 game pixels at `SCALE` 2, so one game pixel is 2x2 screenshot pixels. `__sr.stats()` returns `W`, `H` and `SCALE` if you need the exact numbers.
- On success it prints `saved <full path>`. On failure it prints `SCREENSHOT FAILED` and exits with code 3.
- `QA_DONE` is not needed in shot mode.

**Two silent failures in shot mode. Guard against both:**

1. **Shot mode never prints errors.** `qaErrors` is collected but not printed, and the game logs only the first render error. A scenario that throws, or a draw function that fails, still gives a picture. So before a shot, run the same setup in run mode: end it with `__sr.frames(30); QA_DONE(1);` and check that `qaErrors` is `[]`.
2. **An old PNG can be reported as new.** `qa.js` only checks that the output file exists. If a PNG with that name is left from an earlier run, it prints `saved` even when Chrome failed, and you compare an old picture. Delete the old file first (`rm tools/out/x.png`, or in PowerShell `Remove-Item tools/out/x.png`), or use a new name each time.

Examples (verified):

```
node tools/qa.js shot tools/examples/shot_fight.js tools/out/fight.png
node tools/qa.js shot tools/examples/shot_tree.js tools/out/tree.png
node tools/qa.js shot tools/examples/shot_fight.js tools/out/fight_small.png 3000 960 540
```

Open the PNG and look at it. With the Read tool you can view the image directly.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | OK. In run mode, still check `qaErrors`. |
| 1 | Wrong arguments (usage is printed). |
| 2 | `build.py` failed. |
| 3 | No `QA_DONE` output (run), or no PNG was saved (shot). |

### Do not run two qa.js at the same time on one repo

Each call rewrites `index.html` and uses one Chrome profile per repo (`tools/out/chr_<hash>`). Two calls at once can fail with `BUILD FAILED ... OSError: [Errno 22] Invalid argument: '...index.html'`. Run tests one after another. If you see this error, just run the command again.

---

## 3. How a scenario works

A scenario is a plain browser JS file. It is not a module, and it has no `require`.

- It runs **once, right after the game has booted.** `boot()` in `src/main.js` has already run, `__sr.mode` is `'title'`, and every `__sr` call from section 5 exists.
- **localStorage is cleared before boot**, so every test starts from a fresh save: 0 scrap and no tutorial seen. Use `__sr.give`, `__sr.node`, `__sr.setLeg` to set up a save.
- The game code lives inside one closure (`(() => { 'use strict'; ... })()` from `build.py`). **Your scenario cannot see `G`, `mode`, `SAVE`, `CFG` or any other game name directly.** Use `window.__sr` only (for example `__sr.G`, `__sr.mode`, `__sr.SAVE`, `__sr.CFG`). If you need a new hook, add it to a `test_*.js` file (see "Adding a new test call" at the end of section 5).
- The scenario code runs synchronously. `__sr.sim(sec)` and `__sr.frames(n)` move the game forward right away, so a 30 s `sim` finishes in about a second of real time. Headless Chrome hardly runs `requestAnimationFrame` by itself during a run, so do not wait with `setTimeout` for the game to move. Step it yourself.
- **`__sr.node(id, l)` returns `false` with no error for an unknown node id.** If a node was renamed or deleted, your scenario silently sets nothing. Check the return value, or list the ids with `__sr.treeNodes()`.

### run mode

- Call `QA_DONE(value)` exactly once at the end. `value` can be any JSON value: an object of the numbers you check, an array of modes, `__sr.stats()`, and so on.
- Return small, exact values. Round numbers (`+x.toFixed(2)`) so the output is easy to compare.

### shot mode

- The scenario sets up a state. Then **the game's own main loop keeps running** (`loop()` and `oneFrame()` in `src/main.js`) for `budgetMs`. Time goes on, the bot keeps playing, and effects move and fade.
- **To freeze a moment, call `__sr.hold(true)`** at the end of the scenario. The game steps stop, but drawing goes on, so the picture shows exactly that moment. The camera lead and fades still settle. Use it for effects that live only a short time (a blast, a muzzle flash, a death pop).
- `__sr.pause(true)` also stops time, but it opens the **pause menu** over the picture (`drawPause()` in `src/ui.js`). Use it only when you want to test the pause menu.
- Use a short budget (for example `1500`) with `hold(true)`. Use the default 3000 for a live scene.
- The Depot skill tree stops game time by itself (`treeCovers()` in `src/main.js`).

Example: a 105 blast frozen in the frame (verified on the current build; BUILD_PLAN T0.5 turns the 105 off, but `__sr.boom` still calls `explode` directly):

```js
// shot mode: a 105 blast frozen in the frame
__sr.start(); __sr.bot(true); __sr.sim(12);
__sr.boom(320, 150);   // screen pixel (320, 150), the middle of the view
__sr.frames(4);        // 4 full frames: the blast starts to grow
__sr.hold(true);       // stop time here
```

```
node tools/qa.js shot tools/scenarios/my_boom.js tools/out/boom.png 1500
```

### sim() and frames(): which one to use

- `__sr.sim(sec)`: only the game steps (`step(STEP)` and `camLead`, `STEP = 1/60`). There is no drawing, no tutorial frame, no fade and no click handling. It is fast. Use it to move a run forward. Banners do not age during `sim`.
- `__sr.frames(n, dt)`: n full frames, the same as the main loop (`oneFrame()`): the clock, hit-stop, the PRESS E slow-motion (removed in BUILD_PLAN T0.6), the game steps, the camera, `tutFrame`, `render`, `drawUI`, `drawFade`, then the mouse clicks are used up. Use it when the thing you test lives in the frame: tutorial prompts, banners, fades, camera moves, UI, or anything that needs `render()` to have run.
- A common pattern: `sim(20)` to get into the fight, then `frames(30)` so the picture and the UI are up to date.

---

## 4. The example scenarios

| File | Mode | What it does / checks |
|---|---|---|
| `tools/examples/run_loop.js` | run | New game goes straight from title to leg 1; the bot plays 20 s, loses, and Enter returns from the summary to the Depot. Expected result: `["title","play","summary","depot"]` and `qaErrors: []`. |
| `tools/examples/run_leg.js` | run | Rides all of leg 1 with the bot and `hp(9999)`, checks the saved first arrival, and prints `legState()`. Expected result: leg 1, `result: "won"`, and `qaErrors: []`. |
| `tools/examples/run_smoke.js` | run | Starts a run, the bot plays 30 s, returns `__sr.stats()`. Check `qaErrors: []`, that `mode` is still `play` or a sane result, and that `kills`, `km`, `hp`, `zombies`, `parts` look normal. |
| `tools/examples/shot_fight.js` | shot | Gives 3000 scrap and 30 survivors, starts a run, the bot plays 20 s, then the screenshot shows the live fight (HUD, train, heli, horde, blood). |
| `tools/examples/shot_tree.js` | shot | Gives 400 scrap and 6 survivors and opens the Depot skill tree tab. |
| `tools/examples/ref_*.js` | shot | The scenarios that made the reference pictures in `docs/style/` (see STYLE_GUIDE.md section 0). They only work on the baseline build: after BUILD_PLAN T0.4 they use deleted node ids. **Never use them to overwrite `docs/style/`.** |

Keep your own scenarios in `tools/scenarios/` (one file per task, named after it, for example `t3_3_rockets.js`), with a first-line comment that says the mode and what the file checks, like the existing ones. `tools/examples/` holds the reference examples; add a file there only when a task says so (for example `run_leg.js` in BUILD_PLAN T1.10).

---

## 5. The window.__sr test API (complete)

All of these are defined in `src/main.js` (`boot()`, `window.__sr = {...}`) or added with `Object.assign(window.__sr, {...})` in the files named below. "Screen pixel (sx, sy)" means game pixels in the view, from the top-left of the canvas. It is converted to world position with `G.camX/G.camY`. "Game px (x, y)" for the mouse is the same view space.

This list follows the current build. Tasks remove old calls and add new ones in `src/test_f.js` (see the "Test helpers you will add" table in BUILD_PLAN.md). Keep this section up to date when you change them.

### 5.1 State (src/main.js)

- `__sr.G`: getter for the live game state object `G` (train `G.tr`, `G.zombies`, `G.helis`, `G.up`, `G.station`, `G.loot`...).
- `__sr.mode`: getter for the screen: `'title'`, `'depot'`, `'play'`, `'ending'`, `'summary'`.
- `__sr.SAVE`: getter for the live v2 save (scrap, surv, gold, leg, legs, rescues, rescueDue, chest, hangar, nodes, flags, seen...).
- `__sr.FPS`: the frame stats object `{n, sum, worst, t, avg, lastWorst}`. Not useful headless; use `bench`.
- `__sr.CFG`: the tuning config object.
- `__sr.HORDE`: the horde-by-distance table from horde.js (for balance tests).
- `art()`: returns the sprite sets `{TRAIN, FOOT, HSPR, ROTOR, STATION, SURV, ZS, ICON, TURRET}` (for a test sheet).
- `stats()`: one big snapshot of the run: `mode, result, km, kills, cash, runSurv, scrap, survivors, gold, leg, runs, pay, hp, max, speed, onTrain, t, zombies, bodies, up, shots, scavPaid, overheat, heReload, hurt, station, walls, helis, rounds, parts, texts, chunks, decals, W, H, SCALE, fps, worstMs, heat, gun{...}, ram{...}`. `fps` and `worstMs` are always 0 headless: only the real `loop()` updates them, and `frames()` does not. Do not use them for checks.

### 5.2 Screens and flow (src/main.js, src/tut.js)

- `title()`: go to the title screen (`toTitle`).
- `depot(tab)`: go to the Depot with its `'tree'` tab open (`toDepot`).
- `start(n)`: start leg n (1–12), or the next saved leg when omitted. A won leg is automatically a replay.
- `lose()`: the train breaks now, in play only. The summary follows about 3.4 s later (sim 6 s to be safe).
- `quit()`: quit the run as the pause menu does (`quitRun`, src/tut.js).
- `goal()`: the summary's goal line (`summaryGoal`).

### 5.3 Time (src/main.js)

- `sim(sec)`: step the game `sec` seconds at once, without drawing (see section 3).
- `frames(n, dt)`: n full main-loop frames of dt seconds (default 1, 1/60).
- `hold(h)`: `true` freezes game time (drawing goes on); `false` lets it run.
- `pause(p)`: open/close the pause state (`setPaused`). It shows the pause menu.

### 5.4 Train, run and position (src/main.js)

- `hp(v)`: set the train's health (and its shown bar) to v.
- `jump(px)`: move the train to px before this leg's nose stopping point. Zombies are removed; the train still brakes and arrives through normal game logic.
- `km(x)`: move within the current leg to x km along the whole line, without paying. Does nothing on the title demo.
- `bot(on)`: the test autopilot handles the Ram and smart-strikes each ready equipped plane when at least 15 zombies form a visible crowd. It checks planes every 0.5 s; the Viper still fires automatically. `bot(false)` also lets go of the trigger.

### 5.5 Input (src/main.js, src/test_h.js)

- `aim(x, y)`: put the mouse at game px (x, y).
- `trigger(on)`: hold or release the fire trigger (play only).
- `he()`: fire the HE shell as the key does (`tryHE`).
- `thermal(k)`: set the camera mode k: 0 COLOUR, 1 WHITE HOT, 2 BLACK HOT (`setThermal`, `CAMS` in game.js).
- `keys(k, on)`: set `KEYS[k]` down or up (held keys).
- `press(k)`: dispatch a keydown and a keyup for k (`'Enter'`, `'Tab'`, `'Escape'`, `'e'`...).
- `hover(x, y)`: the mouse over game px (x, y). Clears `hoverNode`.
- `click(x, y)`: a full left click at game px (x, y). It draws one frame so the button there acts at once, and skips the summary animation if in summary.

### 5.6 Zombies and the horde (src/main.js, src/test_a.js, src/test_z.js)

- `spawn(type, sx, sy)`: a zombie standing still at screen pixel (sx, sy): 0 walker, 1 runner, 2 brute. Returns it.
- `hit(z, dmg, cause)`: zombie z takes dmg (default 1) from cause `'mg'` (default) or `'gun'` (the flatcar gun).
- `gold(sx, sy)`: a golden zombie at screen pixel (sx, sy). Returns it (test_a.js).
- `skills()`: first-ring skill state: `{cow, gold, armor, golden, goldSeen, lockWait, kills, cash, hp, v}` (test_a.js).
- `horde()`: the spawner now: `{streams, waves, alive, layer, booms, hd}`, where `hd` is `horde(DK())` here (test_z.js).
- `stream(n, edge)`: a stream of n zombies (default 20) now from edge -1 left, 1 right, 0 top (default) (test_z.js).
- `wave()`: a wave now (sets `G.waveCd = 0`) (test_z.js).
- `crowd(n, sx, sy, r, type)`: n walking zombies around screen pixel (sx, sy) within r px (default 40). Random types if `type` is left out. Returns the zombie count (test_z.js).
- `up(k, v)`: set a run upgrade number `G.up[k] = v` (e.g. `'boom'`, `'silver'`, `'strafe'`, `'gun'`). Returns it (test_z.js).
- `blast(sx, sy)`: an explosive zombie blows up at screen pixel (sx, sy) (`zombieBlast`, test_z.js).
- `cost(n)`: ms per call of the crowd layer parts: `{gather, draw, render, renderNoDead, layer, single, onTrain, allA, allOne}` (test_z.js; see section 6).

### 5.7 The Turbo Ram and sound (src/main.js)

- `ram()`: use the Ram as Space does. Returns true when it starts (`tryRam`). For an actual keyboard check, use `press(' ')`.
- `ramCd()`: seconds left on the Ram cooldown. It starts at 20 (12 fully upgraded) on activation and counts down with game time; kills do not change it.
- `ramInfo()`: a copied Ram snapshot with state, active/powered flags, duration, cooldown, remaining seconds, progress, band, damage, use/kill/shock counters, last shock impact, card bounds and live shock rings. Base smash damage 3 against brutes, band 16 (+3 per Long Charge level), and radius-40 shock damage equal to smash damage are proposals. Walkers and runners are smashed immediately. The powered charge is 2-3.5 seconds; its existing one-second visual slowdown follows it.
- `ramState()`: `'none'`, `'lock'`, `'on'`, `'stop'`, `'cooldown'` or `'ready'`. It returns `'stop'` near a station stop or when the run has a result, so do not test cooldowns there.
- `sound()`: `{ctx, roar, muted}`: whether audio is on and the Ram roar plays.

### 5.8 Helicopters (src/test_h.js, src/test_f.js)

- `rclick(x, y)`: a right click at game px (x, y), with one frame drawn.
- `rightDown(x, y)`: dispatch a right-button pointer press at game px (defaults to screen centre). It gives the normal heli order and keeps the physical-button state held; returns `true`.
- `rightUp(x, y)`: dispatch the right-button release (defaults to the current pointer position), clearing the held state; returns `false`. These calls do not draw or advance a frame.
- `helis()`: each heli: `{name, x, y, dx, dy, hd, alt, sel, order, tgt, heat, hot, heR, sx, sy}` (dx/dy from the engine's nose, sx/sy on screen).
- `lclick(x, y, shift)`: a left click at game px as a player does for heli control (`heliDown`/`heliUp`).
- `drag(x0, y0, x1, y1)`: a left drag (selection box) from (x0, y0) to (x1, y1).
- `rclickH(x, y)`: a right click for heli orders (`heliRight`).
- `sel(...ids)`: select the helis with these index numbers; no ids = select none.
- `heliKey(k)`: a heli key: `'a'` selects all, `'1'`..`'9'` select one.
- `order(i, kind, a, b)`: give heli i an order: `'attack'` (a = zombie), `'move'` (a, b = world px), `'escort'`.
- `heFire(x, y)`: fire the 105 at screen pixel (x, y) (`heFire`).
- `heArm(on)`: arm or disarm the retained 105 aim when owned; returns the state (always false in this demo).
- `boxFrom(x, y)`: the left button is held from (x, y), so a drag box shows to the mouse.
- `heliMarks()`: how many order marks are on the ground.

### 5.9 Flatcar cannon (src/cannon.js)

- `cannon()`: `{reload, cd, ready, ang, shots, kills, last, beams, plan}`.
- `cannonReady()`: load it now.
- `cannonAim(a)`: point it at angle a (radians).

### 5.10 Effects, land and scenery (src/test_j.js, src/test_e.js, src/test_t.js)

- `juice()`: live counts `{gibs, debris, pools, coins, emit, birds, flying, parts}` (test_j.js).
- `boom(sx, sy)`: a 105 blast at screen pixel (sx, sy), as the player's shell makes it (`explode`) (test_j.js).
- `flock(sx, sy)`: crows land at screen pixel (sx, sy) (test_j.js).
- `coins(sx, sy, n)`: a coin pop of n coins (default 12) at screen pixel (sx, sy) (test_j.js).
- `groundAt(sx, sy)`: the baked ground pixel `g`, the decal pixel `d` (RGBA arrays) and nearby static props under screen pixel (sx, sy) (test_j.js).
- `propsAt(sx, sy, r)`: chunk-plan props within r px: `[kind, dx, dy, w, h]` (test_j.js).
- `artJ()`: `{PROPS, SCN}`, the prop and station sprites (test_j.js).
- `atlas()`: sprite atlas fill `{n, out, atY, atH}` (test_j.js).
- `late()`: how many late atlas pages exist (`LATE.length`, test_e.js). It counts pages (512x512 each), not sprites. It is 0 right after boot and **already 1 after the first frames** in the unchanged game. Note your baseline in BUILD_PLAN T0.1; it must not grow.
- `landBench(n)`: ms to paint one ground chunk (default n = 10): `{paint, full}` (test_e.js).
- `fx()`: live effect counts `{parts, lights, booms, rings, embers, texts}` (test_t.js).
- `fxDrop(k)`: empty one effect list: `'parts'`, `'lights'`, `'booms'`, `'rings'` or `'embers'` (test_t.js; for cost tests).

### 5.11 Save and skill tree (src/main.js, src/test_t.js)

- `give(scrap, surv, gold)`: add the three currencies to the save (saved). Returns `{scrap, surv, gold}`. Omitted amounts add zero.
- `setLeg(n)`: set the next leg and mark earlier legs won for setup; it does not grant their rewards (see 5.14).
- `save()`: a deep copy of the save.
- `load()`: read the save again from localStorage.
- `reset()`: wipe the save and go to the title.
- `node(id, l)`: set skill node id to level l, without paying (`setNode`). Returns `false` with no error for an unknown id.
- `buy(id)`: buy one level as a click does. True when bought (`buyNode`).
- `nodeAt(id)`: the node's screen point with the tree tab open (`nodeXY`).
- `hoverNode(id)`: move the tree view so the node is on the panel (`treeFocus`), then keep the mouse on it, even across frames (test_t.js overrides the main.js version).
- `clickNode(id)`: move the view to the node, then click it (test_t.js overrides the main.js version).
- `tree()`: `{id: "level state"}` for every node.
- `treeNodes()`: `[{id, p, lv, max, st, cost, cur}]` for every node (test_t.js); `p` is the parent id, or null for the root.
- `treeCam(x, y, z)`: put the tree view on cell (x, y) at zoom z at once. `treeCam()` returns the view now (test_t.js).
- `treeZoom(d)`: zoom the tree one step, as the wheel or buttons do (test_t.js).
- `treeState()`: `{drag, M, tab, mode}`: tree drag, mouse, Depot tab (test_t.js).
- `infoFit()`: info box lines that do not fit: `{bad, widest, inner}`. `bad` must be `[]`.

Node ids come from `NODES` in `src/tree.js` (for example `'root'`, `'hdmg'`, `'hrate'`, `'cool'`, `'farm'`). Use `__sr.treeNodes()` to list them all. The root keeps the id `'root'` in the new tree too.

### 5.12 Strafing Run (src/test_t.js)

- `strafe(sx, sy, ux, uy)`: call the jet through screen pixel (sx, sy). The direction is (ux, uy) if given, otherwise along the rails (`callStrafe`).
- `strafeState()`: `{left, arm, jets, bombs, up}`: runs left and what is in the air.

### 5.13 Loot (src/loot.js)

- `loot()`: this run's finds: `[{i, kind, km, off, x, y, pay, gone, seen, stage, w, placed, awake, guards}]`.
- `lootGo(i)`: put heli 0 over find i (with a move order).
- `lootTake(i)`: take find i at once (`takeLoot`).
- `lootSpawn(kind)`: a find of kind `'pile'`, `'crate'`, `'gold'` or `'sos'` right next to heli 0. Returns its index.
- `lootStats()`: `{loot, cash, surv, pickup, fly, winch}`.
- Rescue finds also copy `rescueId`, `saved` and `carried`. The IDs `rescue-4`, `rescue-8` and `rescue-10` stay the same across rides. Two seconds of continuous hovering saves the survivor immediately; the rope and lift then finish visually. Missed rescues return on the next non-replay ride, and the final Terminus camp saves any remaining survivors.

### 5.14 Legs and rewards (src/test_f.js)

- `finaleState()`: copies the Terminus phase (`approach`, `hold`, `open`, `done`), actual stop/arrival positions and times, 30-second hold clock, gate props, gift receipt and finale wave receipts. Only leg 12 has this state. The gate clock uses game time; rewards wait until the train rolls through the opened gate.
- `incomeState()`: copies the current leg's scrap target, ordinary kill multiplier, total paid scrap, paid/base sources (`ordinary`, `silver`, `loot`, `wall`) and remaining fractions. Ordinary kill payouts are tuned per leg while keeping the horde; silver remains 15 base scrap and Salvage Crew applies once to every source. Wall scrap counts only after collecting its dropped pile.
- `starState()`: copies the current leg's earned stars, total one-time star gold, HUD positions/pop progress and cached icon readiness. From leg 3, reaching the station, arriving with at least 75% health and catching the primary golden zombie each pay 3 gold once. The catch star saves immediately; replays cannot earn missed stars.
- `variantState()`: copies silver/explosive spawn and blast counters, active variant positions, eligible spawn chances, queued blasts, and startup-art atlas checks. Silver pays 15 base scrap; explosive walkers and runners detonate only if they were visibly explosive before dying.
- `variantSpawn(kind, sx, sy, type = 0)`: QA-only controlled placement using the real variant converters. `kind` is `normal`, `silver` or `boom`; returns the actor index or `-1`. Special variants respect their leg introductions and cannot be brutes. Screen coordinates must be inside the world view.
- `goldState()`: copies the golden event queue/receipts and active chase positions, plus the number of Hunt gold rewards already paid and cached gold-art readiness. Primary identities stay `golden-primary` per leg; Hunt extras use `golden-hunt-1..3`. A primary catch pays 1 gold and the third star (3 gold); retries/replays pay 10 base scrap. Hunt extras can pay at most five one-time gold rewards across the demo. Golden crates use `gold-crate`, pay 5 gold at actual proximity pickup, and pay 25 base scrap on retry/replay.
- `wallState()`: copies every wall with its identity, world/screen position, hp/max, state, stop point, spawn/stop/break times, Ram flag, train health before/after and dropped loot id. No live target or sprite objects are exposed.
- `wallFixture({ahead, hp, id})`: QA-only placement through the real wall event handler during a live leg; returns a copied wall or false. Production values are 180 rail px ahead and 75 HP. This fixture does not grant rewards or ownership.
- `line()`: copies the thirteen stops and twelve leg definitions, including each leg's events.
- `leg(n, replay)`: starts leg n (1–12); `replay: true` forces scrap-only play. Won legs are always replays.
- `setLeg(n)`: sets the next saved leg (1–13) and marks earlier legs won, without paying station rewards or stars. Reset first when moving backward for a fresh test.
- `legState()`: `{leg, t, len, result, replay, events, stars, gold, surv, scrap, wall}`. `t` is run seconds; `len` is rail pixels. `wall` copies the nearest intact blocking wall, or is null.
- `win()`: moves near this leg's destination. Step time afterward (for example `frames(60)`) to finish braking and award the arrival normally.
- `payGold(id, amount, scrapIfNot)`: exercises the receipt-based reward path. A new id pays gold; duplicate/replay ids pay the scrap alternative. It banks at once and returns `{gold, scrap}`.
- `currencyState()`: shown currencies, their screen x targets, saved chest state and saved gold.
- `depotRoute()`: selected leg, replay flag, ride label, loss message, and each leg's clickable midpoint/availability.
- `summaryView()`: current summary layout and its Depot button rectangle, or null when there is no summary.
- `treeOverlap()`: pairs of nodes less than 1.2 cells apart; a valid tree returns `[]`.
- `treeArt()`: each current node's baked icon dimensions; a 12×12 drawing with its outline is 14×14.
- `treeShown()`: the IDs currently revealed by parent ownership and currency/enemy discoveries, including full-game teases.
- `scrapPops()`: visible positive scrap reward texts, their size, colour, and screen positions.
- `gunVisual()`: read-only `{range: {radius, visible}, hits: [{x, y, scale, age}]}`. Radius and hit positions are world px, age is seconds, and scale is the fired heli bullet's damage multiplier.
- `treeStats(id)`: read-only stat segment arrays used by the current node tooltip, including NOW/NEXT values and colours; returns `[]` for an unknown node.
- `planeBand()`: read-only band rectangle `{visible, x, y, w, h, worldHeight, fullHeight, slots}` in game px. A real play/ending leg with a plane owned reserves 18 px below `worldHeight`; title, menus and legs without a plane use the full height. Test world-click exclusion with actual pointer events, since `click()` only draws UI.
- `units()`: the active heli's `{count, damage, rate, range, winch}`, Rockets `{chance, enabled}`, Pods and Hellfire. Pods reports `{enabled, range, damage, reload, salvo, napalmDuration, salvos, shots, queued, inFlight, cooldown, ready, impacts, kills, lastTarget, lastImpact, active}`. Pod cooldown and Napalm duration are seconds; shots count launched pod rockets. `lastTarget` copies `{x, y, count, t}`, including the chosen crowd size and salvo time. `lastImpact` copies `{x, y, radius, damage, hits, kills, t}`. Each active pod rocket copies `{sx, sy, sz, bx, by, age, T, dmg, R, burnTime, burnDamage, position}` with `position` as `[worldX, worldY, height]`; burn damage is per second. Planes copy the same snapshots as planes(); unimplemented car/gadget slots remain empty until their tasks. Returns `null` without a game; its snapshots do not expose mutable target or projectile objects.
- `units().mg`: copied automatic boxcar turret state `{enabled, damage, rate, range, wallRange, count, pierce, shots, hits, kills, targetsHit, lastShot, turrets, art}`. Base damage 1 and range 100 ground px are proposals; base rate is 2 shots/s. When no ordinary target is available, a blocking wall has a finite 200-ground-px fallback range from the rear boxcar. AP includes this actual wall face without expanding its range against ordinary enemies. Each turret copies its curved-track mount, screen position, aim, cooldown, flash, recoil and counters. Shot copies include the muzzle, selected target and every hit's before/after HP. `art` reports the four cached 32-heading sets and atlas readiness. No live target or turret objects are exposed.
- `units().katyusha`: copied flatcar rocket state with `enabled`, `range`, `damage`, `blastRadius`, `reload`, `salvo`, `clusterCount`, seconds of `cooldown`, `ready`, salvo/shot/hit/kill and impact counters, split/bomblet counters, `queued`, `inFlight`, launch/target/impact snapshots, the last 64 impacts, active arcs, rack mount and cached artwork. Base damage 8, radius 24, range 300 and 0.8-second flight are proposals. Clusters split into three damage-4, radius-12 bombs; blast upgrades scale both radii. `shots` counts parent rockets and `hits` counts parents that hit anything, at most once per parent. `rocketImpacts` and `clusterImpacts` count actual blasts. It uses its own projectile list and cannot alter helicopter counters.
- `steam()`: copied Steam Vent state `{enabled, damage, interval, reach, cloudReach, hotCloud, cooldown, bursts, hits, kills, cloudHits, cloudKills, lastBurst, cloud, envelope}`. First burst is after 5 seconds, falling to 2.5 with Vent Speed. Proposed damage is 2 times Steam Damage; each Reach level adds 6 world px outside the train. Without Reach, bursts hit climbers. Steam also reaches a blocking wall face within 24 ground px of the train; its cloud shares the same one-hit receipt. Hot Cloud follows the curved train for 2 seconds, extends another 6 px, and hits each entrant once; burst victims are not hit twice. `hits`/`kills` include the cloud subset. `cloud` copies remaining `time`, `age`, duration, reach and damage. The envelope uses the actual car segments, half-width 8 and y scale 0.72. White smoke uses the existing particle limits.
- `units().hellfire`: `{enabled, range, count, damage, reload, blastRadius, salvos, shots, inFlight, cooldown, ready, impacts, kills, lastTargets, lastImpact, active}`. Range/blast radius are world px and reload/cooldown are seconds. `lastTargets` copies launch snapshots `{x, y, hp, type, priority, t}`; priority is `brute`, `gold`, or `hp`. Active missiles copy `{sx, sy, sz, bx, by, age, T, dmg, R, priority, position, targetSnapshot}`; position is `[worldX, worldY, height]`, bx/by follows the live target, and targetSnapshot stays fixed at launch. `lastImpact` uses the same copied fields as Pods. Count is 1, or 2 with Double Hellfire; it never sends two missiles at the same target. If only one eligible target exists, it fires one missile.
- `rockets()`: nose-gun rocket diagnostics `{shots, rockets, first, last, maxGap, forced, impacts, kills, lastImpact, active}`. Shots count all nose-gun shots; timing is run seconds, and `first` is `null` before the first rocket. `forced` records whether the first-rocket guarantee is still due. Each active nose-gun rocket copies `{sx, sy, sz, bx, by, age, T, dmg, R, position}`; `position` is `[worldX, worldY, height]`. Pod rockets are reported by `units().pods.active`. Returns `null` without a game and does not advance time.
- `fires()`: copied active burning-ground patches `{x, y, R, time, age, duration, dps, tick, source, wall}`. Positions and radius are world px; time, age, duration and tick are seconds, and dps is damage per second. `wall` marks an active Fire Wall patch that blocks zombies. Returns `[]` without a game.
- `railX(worldY)`: read-only world X of the railway centre at a finite world Y (or null for invalid input); useful for controlled moving-stream scenarios.
- `fireStats()`: read-only run counters `{kills, ticks, hits, created}` for actual fire damage and patch creation. Returns `null` without a game.
- `addBurn(sx, sy, R=16, duration=3, dps=2)`: direct stress-test fixture using screen coordinates and the real capped burning-ground system, with source `test`. Returns the active patch count, or `false` without a game or for nonfinite values or nonpositive radius/duration/dps. Gameplay checks should create Napalm through pod salvos.

### Plane controls (src/air.js, src/test_f.js)

- `planes()`: copied equipped planes `{id, slot, key, available, ready, cd, maxCd, charges, maxCharges, aiming, strikes, lastStrike, gift, used}`. Slots start at zero; cooldowns are game seconds. A new leg fills all charges. A used charge refills on one serial clock per plane; spending the second charge does not restart that clock. `lastStrike` copies world `{x, y, ux, uy, t}`. Only implemented payloads appear in the band. At the finale peak a runtime-only B-2 appears in slot E with one charge on each try, then reads FULL GAME after use; it never refills or writes saved ownership.
- `planeAim()`: copied `{active, id, key, x, y}` with the current screen point. Real aiming slows ordinary frames to 50%; reduced motion keeps normal speed. `sim()` always steps game seconds.
- `planeFixture(id, slot=0)`: QA-only injection of a ready A-10/F-4/B-52/B-2 into runtime Q or W during an unfinished real play leg. Initialize the leg's normal slots with `planes()` before a save-byte comparison. The fixture changes no saved ownership or assignments; it uses the leg's cooldown/+1 Charge values, temporarily enables the B-2 descriptor, and leaves existing flights intact. Actual key and pointer events then use production aiming, launch and resource code. Returns false for an unsupported ID, invalid slot or another screen. Call `clearPlaneFixture()` after the scenario to restore the original descriptor and, if the same leg still exists, its pre-fixture AIR slots/resources/owned snapshot. Cleanup returns whether a fixture was active; launched flights keep flying.
- `planeShow()`: copied strike visuals `{marks, jets, bombs, activeBombs, embers, roars, stats, art}`. Marks copy world `{x, y, age, T, radius}`. Flights copy plane `id`, payload `len`, ground `x/y`, projected body `screenX/screenY`, world `shadowX/shadowY`, projected `shadowScreenX/shadowScreenY`, actual `spriteW/spriteH`, altitude, delay, age, `shadowSeen/shadowAge/bodyReady`, actual opaque-bound `bodyVisible/shadowVisible`, `roared/fired`, path `s/end/ux/uy`, damage and half-width. Times are game seconds and distances are game px. `roars` counts actual live-flight roar requests cumulatively for the leg; bombs/embers are active counts. `art` reports baked heading-zero jet/F-4/B-52/B-2/heli dimensions, plus actual `normal/shadow/hot` heading counts for all four planes. Returns `null` without a game and exposes no mutable flight/marker references.
- `strike(key, sx, sy, ang)`: confirm a strike through the production resource/launch path. Angle is radians from positive X; omitted means the rail direction. Returns whether it launched.
- `b2Strike(sx, sy, ang)`: launch one actual B-2 flight during a real unfinished play leg, using screen coordinates within the world. Angle is radians from positive X; omitted means the rail direction. Returns whether it launched, with no ownership, saved slot or charge changes. The full-game tree tease remains unavailable to buy. `planeShow().stats.b2` copies cumulative `{launched, dropped, impacts, kills, lastDrop, lastImpact}`; last drop is world `{x,y,t,radius}`, and last impact adds `{kills,coreRadius,outerRing}`. `art.b2` includes actual heading counts `normal/shadow/hot`.
- `b2Fx()`: copies active B-2 effects `{cores, rings}` from the production lists. Cores contain world `{x,y,r,cap,t,T}`, and rings contain `{x,y,r0,r1,t,T}`. Radii are game px and times are seconds; the arrays empty when those effects expire.
- A-10 flight snapshots in `planeShow().jets` also copy `{lines, offsets, bombCount, dropped}`. The one jet carries 1–4 parallel gun lines; offsets are symmetric world px at 30 px spacing and match the aim preview. Damage, lines and 0/4 bomb payload are fixed when launched. `planeShow().bombs` and `strafeState().bombs` count actual active bombs, so Bomb Run reports four after they drop and before they land.
- F-4 flight snapshots also copy `{fireDamage, fireDuration, fireWall, patchRadius, patchStep, patchCount, patches, patchNext}`. Fire damage is the launch-time DPS; duration is each deposited patch's lifetime in seconds. Patch radius/spacing are world px; `patchCount` is the planned total, `patches` counts deposited patches, and `patchNext` is the next patch index to deposit. `G.up.fireDamage/fireLength/fireDuration/fireWall` hold the leg's upgrade values; the aiming preview uses the same length and wall state.
- B-52 flight snapshots copy `{bombCount, bombsDropped, bombNext, bombStep, bombRadius, bombDamage, burnTime, burnDamage}`. The 8–16 endpoint-inclusive bomb targets use the same lane as the preview. `planeShow().stats.b52` copies cumulative `{launched, dropped, impacts, lastDrop, lastImpact}`. `lastDrop` copies world `{x, y, t, index, radius, damage, burnTime}`; `lastImpact` uses the same fields without index. Their timestamps are run seconds and remain available after the flight leaves. `art.b52.engines` copies the eight `{x, y}` centers used to draw the raw sprite.
- `planeShow().activeBombs` copies `{source, x0, y0, x1, y1, z0, age, T, a, radius, dmg, burnTime, burnDamage, visible, position}`. Start/target coordinates and radius are world px, age/T/burnTime are seconds, angle is radians, and position is `[worldX, worldY, height]`. Queued bombs have negative age and are not visible; their position stays at release until active. Optional payload fields reflect the actual source's record; Fire Bombs create normal burning ground after impact.
- `smart(key)`: use the same biggest-crowd targeting as a double tap. Returns whether it launched.
- `planeBand().slots`: copied clickable rectangles `{id, key, x, y, w, h}`. Use real pointer events for input tests. `press('q')` twice within 0.35 real seconds tests the double tap; right click cancels aiming without moving the helicopter.

### Hangar (src/hangar.js, src/test_f.js)

- `hangar()`: copied `{visible, owned, slots, selected, drag, layout}`. The tab is visible once more than two planes are owned. `slots` holds the two saved plane IDs (or null); `layout.cards` copies `{id,x,y,w,h}` and `layout.slots` copies `{slot,key,id,x,y,w,h}` in game pixels. No ownership or saved assignments change when reading this snapshot.
- `hangarDrag(id, slot)`: real canvas pointer down/move/up through ordinary UI frames, for a visible Hangar tab in the Depot. Slots are zero-based (0=Q, 1=W). Returns whether the plane is assigned to the requested slot afterward; unknown cards/slots or another screen return false. Assigning an equipped plane to the other slot swaps the two. Use raw PointerEvents to test outside drops, pointer cancellation and browser blur.

### 5.15 Tutorial (src/tut.js)

- `tut(name, data)`: send a first-use tutorial event (`tutEvent`). Real play and Depot purchases can queue lessons; the menu demo cannot. Successful normal plane strikes and actual +1 Charge purchases have production hooks.
- `seen()`: prompt keys actually shown (`SAVE.seen`), in their first-display order. Unseen queued lessons remain pending across screens and save reloads.
- `tutState()`: the current `tip`, `tipKey`, `tipAge`, wrapped `layout`/arrow target, eligible `queuedKeys`, persistent `pendingKeys`, and copied `lessonText` catalog. `tasks` is always empty and `queued` is zero. It also copies radio/banner, Depot tag, pause/fade and finale `endCard` bounds. Only one keyed tip is displayed; currency and Hangar lessons wait for the appropriate screen.

### 5.16 Performance (src/main.js)

- `bench(n)`: draw n frames (`render()` + `drawUI()`) at once. Returns the average ms per frame.
- `costFx(n=30)`: compare a frozen picture with each effect group hidden and with all listed groups hidden. It restores the original effect objects after every sample; this diagnoses drawing cost without changing a fight.
- `fxPixels(on)`: QA-only override for native (`false`), crowded pixel-buffer (`true`), or automatic (`null`) flame/particle/blast rendering. It changes no gameplay or effect counts.
- `fxPixelCase(kind, frame, background)`: compare the two effect painters on the same canvas and return pixel differences. Kinds are `opaque`, `alpha`, `dense`, and `real`; controlled cases vary positions and ages with `frame`. Live effects, RNG and canvas pixels are restored.
- `testRings()`: compare 320 cached ellipse-outline draws with the original pixel recipe, including opacity, additive blending and repeated draws. Returns exact-pixel differences and bounded cache counts.
- `testRadar()`: compare 32 crowded radar-dot cases with the original drawing order, including overlaps and view edges. Returns exact-pixel differences without changing live zombies.

To list every key yourself (verified):

```js
QA_DONE(Object.keys(window.__sr).sort());
```

### Adding a new test call

Do not put test code in game files. Add it to a `test_*.js` file in `src/` with `Object.assign(window.__sr, {...})` and a one-line comment for each call, like the existing ones. For the FINAL_DESIGN work, use `src/test_f.js` (BUILD_PLAN.md says when it is created). A test file must come after `main.js` in `ORDER` in `build.py` (put it at the end), because `window.__sr` exists only after `boot()`. Do not reuse the name of an existing call (for example `ram` already exists). Then add a line for it to section 5 of this file.

---

## 6. Checking performance

The game must keep 60 fps on a normal laptop. Headless Chrome does not give real fps (`stats().fps` and `worstMs` are always 0), so measure the cost of a frame with this busy-fight scenario:

```js
// run mode: what a busy frame costs
__sr.give(3000, 30);
__sr.start(); __sr.bot(true); __sr.sim(20);
__sr.frames(30);                       // let the picture settle
QA_DONE({
  bench: +__sr.bench(60).toFixed(2),   // ms per frame (render + drawUI)
  cost: __sr.cost(20),                 // the horde layer's parts
  land: __sr.landBench(5),             // one ground chunk
  fx: __sr.fx(), horde: __sr.horde(), late: __sr.late()
});
```

Measured on the baseline build (about 290 zombies): `bench` ≈ 3.3 ms, `cost().render` ≈ 2.7 ms, `cost().renderNoDead` ≈ 0.4 ms, `landBench().full` ≈ 2.2 ms, `late` = 1. Run it in BUILD_PLAN T0.1 and note your own numbers as the baseline.

`tools/scenarios/t4_10_planes.js` uses this 20-second/30-frame setup and launches all four maxed plane payloads through QA-only runtime slots. It samples the rising explosions and both B-2 impact stages, and separately checks sprite pages after 30 seconds. `t4_10_overload.js` is an additional stress check: a 30-second ride plus 300 extra zombies. Keep its higher load and timing labeled separately from the standard battle.

What is good (the same rule as STYLE_GUIDE.md section 7 and BUILD_PLAN.md):

- **`bench` under 8 ms** in a busy fight (a big horde, effects, the Ram, a blast). That leaves room for the game steps in the 16.7 ms frame. **One new system may add at most about 1 ms** over the baseline. If `bench` goes over 12 ms, find the cause and fix it.
- `cost().render` near `bench`, and `cost().renderNoDead` small (about 0.5 ms). If `render` is much higher, the horde drawing is the problem.
- `landBench().full` about 2 ms per chunk. Chunks are baked while the train moves, so this must stay small.
- `late()` does not grow above the baseline (today 1). A sprite added to the atlas after the first frame goes into a late atlas page.
- Effect counts (`fx()`, `juice()`, `stats().parts`) must not grow forever. Run `sim(60)` and check they stay bounded.

Test the worst case, not an empty screen. For example, `__sr.crowd(300, 320, 180, 120)`, then `__sr.boom(...)` and `__sr.strafe(...)`, then `frames(10)`, then `bench(60)`. (Keep the screen points inside the run-mode view: `sx < stats().W`, `sy < stats().H`.)

---

## 7. Zooming into a screenshot

```
python tools/crop.py <in.png> <out.png> x y w h [k]
```

Cuts the box (x, y, w, h) in **screenshot pixels** and enlarges it k times (default 3) with nearest-neighbour, so the pixel art stays sharp. Example (verified):

```
node tools/qa.js shot tools/examples/shot_fight.js tools/out/fight.png
python tools/crop.py tools/out/fight.png tools/out/fight_zoom.png 480 180 320 180 3
```

At the default 1280x720, a game pixel (gx, gy) is at screenshot pixel (2*gx, 2*gy). Use the zoom to check outlines, colours, one-pixel details, and that nothing is blurred.

---

## 8. Testing in a git worktree

`qa.js` tests the repo it lives in. If you work in a git worktree, use one of these:

1. **Run the worktree's own copy**: `cd` into the worktree and run `node tools/qa.js ...` there. This only works if the worktree has `tools/`, so commit `tools/` on the branch you branch from.
2. **Use QA_REPO**: keep running the main repo's `tools/qa.js` but point it at the worktree. It runs `build.py` there and tests that `index.html`. Outputs stay in the main repo's `tools/out/` (one Chrome profile per repo path, so they do not clash). Verified:
   - PowerShell: `$env:QA_REPO = "C:/path/to/worktree"; node tools/qa.js run tools/examples/run_loop.js`
   - bash: `QA_REPO="C:/path/to/worktree" node tools/qa.js run tools/examples/run_loop.js`
   - In PowerShell, `$env:QA_REPO` stays set for the session. Clear it with `Remove-Item Env:QA_REPO` when you are done.

---

## 9. Standard checks after every change

Do all of these before you call a change done:

1. **Build**: `python build.py` prints `index.html <size> KB` with no error. `index.html` is tracked in git, so commit the rebuilt file with your `src/` change.
2. **The loop**: `node tools/qa.js run tools/examples/run_loop.js` must print exactly `{"result":["title","depot","play","summary","depot"],"qaErrors":[]}`. (If a BUILD_PLAN task changes this flow on purpose, update `run_loop.js` in the same task.)
3. **A 30 s bot run**: `node tools/qa.js run tools/examples/run_smoke.js` must give `qaErrors: []` and sane numbers (kills > 0, km grows, hp > 0, no runaway `parts`/`zombies`).
4. **Your own check**: a run scenario in `tools/scenarios/` that sets up your feature and returns the numbers that prove it works (with `qaErrors: []`).
5. **A screenshot of what you changed**: a shot scenario that shows your feature on screen. Run its setup in run mode first and check `qaErrors` (shot mode prints no errors). Delete the old PNG first. Use `hold(true)` for a short effect. Zoom in with `tools/crop.py`. Look at it yourself.
6. **Compare with `docs/style/`**: put your screenshot next to the reference screenshots there. Check the same pixel scale, the same palette, dark outlines, the same font and UI panel look, and effects as bright and as short as the existing ones (muzzle-flash stars, hit sparks, red death pops, blood decals, blasts). If yours looks different, fix it before you go on. **Never overwrite the pictures in `docs/style/`.**
7. **Performance** if you added drawing, effects or many objects: the section 6 scenario, `bench` under 8 ms in a busy fight and at most about 1 ms over the baseline; `late()` not above the baseline.
8. Run `node tools/qa.js run tools/examples/run_loop.js` once more at the end, after all edits.
