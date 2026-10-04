# Sky Reaper

A procedural pixel-art train escort game. Protect the train through twelve station legs, collect supplies with one Viper, and build up automatic weapons, train gadgets and air support in the Depot.

The current small playtest changes leg 1 to three stopped encounters with short travel between them: a dense walker rush, a delayed runner flank, and a brute-led last stand. Incoming runners and the brute get a short countdown at their approach point. Clear all attackers, including reinforcements, to move on. The owner approved these early enemy introductions only for this opening test; later-leg introductions and rewards keep their normal rules. In the Depot, hover **MG Car** or **A-10** to try simpler upgrade cards with looping weapon previews and a clear survivor price. The remaining legs and upgrade cards keep their existing behavior while these two ideas are tested.

## Play locally

Run `python build.py` from this folder, then open `index.html` in a browser. The build joins the files in `src/` into one standalone page. No server, npm packages or downloaded art are required.

## Controls

| Action | Control |
|---|---|
| Move the Viper or focus an enemy | Right click the ground or enemy. The gun fires automatically. |
| Aim an equipped plane | Press Q/W or click its ready icon, then left click to strike. Drag to choose the direction. |
| Strike the largest visible crowd | Press the same plane key twice. |
| Cancel plane aim | Right click. |
| Use Turbo Ram when owned | Space. |
| Switch between normal and double speed | F, or click 1X/2X beside Pause. Each leg starts at 1X. |
| Change camera | T cycles colour, white hot and black hot. |
| Toggle sound | M. |
| Pause | Escape or P. |
| Start or continue in menus | Enter, or the shown button. |
| Zoom | Mouse wheel; over the Depot tree it zooms the tree. |
| Move around the skill tree | Drag or WASD; C/Home centres it, and +/- changes zoom. |
| Switch Depot tabs | Tab, when the Hangar is available. |

Fly over scrap piles and cleared crates to collect them. Hover over a waving survivor for two continuous seconds to save him with the built-in winch. Right click a golden zombie to chase and catch it.

Double speed advances the whole battle, including travel, enemies and cooldowns. Plane aiming still slows the battle for precise placement (except with reduced motion enabled).

## Depot and progress

Blue scrap buys upgrade levels, orange survivors crew new units, and gold buys special nodes. The Viper starts owned. Train guns, rockets and Steam Vent work automatically once bought. Grey FULL GAME nodes are previews.

The line map selects the next leg or a completed leg for a scrap-only replay. You keep earned scrap when the train breaks, you quit, or the leg ends. Gold and saved rescues persist immediately. Gold sources pay once per stable item and leg; retries convert paid finds to scrap. Saved survivors cannot be collected again, and missed field rescues return on a later non-replay ride.

From leg 3, each leg has three stars: reach the station, arrive with at least 75% train health, and catch the primary golden zombie. Each star pays three gold once. Replays preserve progress and cannot fill missed stars.

With up to two planes owned, they equip automatically. Owning all three opens the Hangar: drag a card into Q or W, or select a card and click a slot. Assignments save for later legs. Each plane refills its charges on its own cooldown. The Terminus finale grants one temporary B-2 in E on every attempt; it becomes FULL GAME after use and is never saved as owned.

Progress uses browser local storage. Keep playing in the same browser/profile to retain it. This build uses save version 2; older version 1 progress starts fresh. The title and visible Hangar background show a separate battle that earns no rewards.

## Code map

`build.py` supplies the load order. All source files share one scope inside the generated page;
new top-level names must be unique. Edit source files rather than the generated `index.html`.

| Area | Main files | Responsibility |
|---|---|---|
| Game loop and input | `main.js`, `game.js` | Browser input, fixed simulation steps, train movement, damage, run results and banking. |
| Route and rewards | `legs.js`, `station.js`, `loot.js`, `skills.js` | Twelve timelines, gate hold, station stops, one-time reward receipts, finds, rescues and golden zombies. |
| Enemies | `horde.js` | Streams, rail crowds, escorts, variants, enemy movement and crowd rendering. |
| Viper weapons | `helis.js`, `heliweap.js`, `fire.js` | Orders and automatic targeting, gun, Rockets, Pods, Hellfire and shared burning ground. |
| Train weapons | `cars.js`, `gadgets.js`, `game.js` | MG turrets, Katyusha, Steam Vent and Turbo Ram. |
| Air support | `air.js`, `planes.js`, `f4.js`, `b52.js`, `b2.js`, `hangar.js` | Slot input, aiming, serial charge refill, flight/payloads and saved Hangar assignments. |
| Progress and menus | `depot.js`, `tree.js`, `ui.js`, `tut.js` | Save validation, purchases, prices and upgrade values, route selection, layouts and persistent first-use tips. |
| World and presentation | `core.js`, `art.js`, `sprites.js`, `world.js`, `land.js`, `scenery.js`, `render.js`, `fx.js`, `fx_pixels.js`, `juice.js`, `audio.js` | Pixel drawing, cached art/terrain, lighting, particles, procedural sound and rendering limits. |
| Retained full-game code | `cannon.js` and guarded 105/plow helpers | Disabled demo systems preserved for future work. |
| Diagnostics | `test_*.js`, `tools/scenarios/` | Browser QA API and reproducible feature, balance, layout and performance checks. |

Weapon values come from `UP` and the named weapon configuration objects; tree tooltips read those
same values. `SAVE` is persistent progress, while `G` is the current ride or menu battle. Keep
demo rewards and tutorial triggers disabled. Gold receipts, rescued survivor IDs and star receipts
must remain persistent so retries and replays cannot pay them twice. Audio uses its own random
generator so mute settings and sound limits cannot change combat outcomes.

## Development and checks

Edit `src/`, then rebuild `index.html`. [tools/README.md](tools/README.md) documents the headless runner, scenarios and `window.__sr` test helpers; `python tools/check_all.py` runs the saved checks sequentially. [FINAL_DESIGN.md](FINAL_DESIGN.md), [STYLE_GUIDE.md](STYLE_GUIDE.md) and [BUILD_PLAN.md](BUILD_PLAN.md) describe the game, visual rules and implementation sequence. The reference images in `docs/style/` remain visual standards; regenerated fixtures belong in `tools/out/`.

The [final implementation report](docs/final-report.html) records the twelve-leg results, chosen proposals, checks and screenshot gallery. Run `python tools/final_shots.py` after the complete scenario suite to regenerate its 25 screenshots under `tools/out/final/`.
