# Sky Reaper: The First 10 Minutes

This is the plan for the first 10 minutes of the demo. It builds on DESIGN.md and adds your two new requests:
- **Two panels between runs:** the SKILL TREE panel, and the STATION panel, a grid where you build your towers.
- **Active skills.** The first one is **TURBO RAM**: the train goes very fast and kills every zombie in its way.

**How the numbers were checked.** The game's autopilot played many test runs with these new rules, tuned to play like a new player. Section 7 is the one source of truth for all numbers.

---

## 1. What changes in the big design (DESIGN.md)

| # | DESIGN.md said | Now | Why |
|---|---|---|---|
| 1 | One skill tree. | **Two panels** on one Depot screen with 2 tabs: **SKILL TREE** and **STATION**. | You asked for it. The tree decides *what* you can build. The Station panel decides *where* you build it and *how many*. |
| 2 | "MG Nest" node: 1 free, +1 per level. | The STATION branch opens when you first hold Farm Stop. Farm Stop already has a **free kit** (1 MG Nest + 6 sandbags). You buy more towers on the grid with scrap. Selling gives back everything you paid. | Building happens on the grid now. |
| 3 | — | **Each station has its own grid and its own build.** In the first 10 minutes only Farm Stop has one. | Each battlefield is different, so your build should be too. |
| 4 | No active skills. | **Active skills** are a new kind of ★ node. **TURBO RAM (key E)** comes first. Later: SHOCK HORN (Q), FLARE DROP (R), LAST STAND (G), AUTO RAM. | You asked for it. |
| 5 | ★ Plow (a passive). | **Removed.** Turbo Ram does this job, and AUTO RAM comes later. | Two nodes doing one job is one too many. |
| 6 | — | **Dead Wall:** 350 m before each station, a crowd of the dead with Brutes stands on the rails. You need Turbo Ram to get through cleanly. | It makes the Ram feel needed: you meet the problem first, then you buy the fix. |
| 7 | Runners from 0.5 km, Brutes from 1.5 km. | Runners from **0.4 km**. Brutes come first in the Dead Wall (**0.65 km**), then on the rails from **1.1 km**. | So a new enemy shows up inside the first 10 minutes. |
| 8 | Danger grows with time. | **Danger grows with distance from the Depot.** | You can start runs from a station, so the danger must belong to the place. |
| 9 | Train HP 150. | **HP 80**, +20 per ARMOR level. Running over a zombie now costs **2 HP** (a Brute costs **10 HP**). | The test showed that crushes do about 85% of the damage. Now Armor matters. |
| 10 | Leash 470 px. | Flying range is **300 px**, +60 per RADIO RANGE level. | Flying far should be something you earn. |
| 11 | Prices start at 10 and grow ×1.6. | Prices start at **40–150 and double each level**. ★ nodes: Flatcar Gun 300 scrap, Turbo Ram 500 scrap, 105mm 5 survivors, Winch 5 survivors. | One run pays 270 to 1,450 scrap. |
| 12 | Start from any station you reached. | Same, plus a new rule: **a run that starts at a station starts with that station's hold** (25 s, 3 survivors). The 3 survivors come back only after a run that rides 0.5 km or more (7.4). | Your build fights at once, and runs never ride the same km over and over. The refill rule stops a "start, hold, quit" survivor farm. |
| 13 | — | The station crew repairs **+20 HP** when the train stops. A hold with no survivor lost is a **PERFECT HOLD: +1 survivor**. | A weak train should not die in the first second of a hold. The hold also gets a goal. |
| 14 | Streak bonus 5/15/30/60/120. | Streaks pay **2/5/10/20/40**. New: **distance pay** (+1 scrap per 20 m traveled, so 5 per 100 m) and **station pay** (+50 the first time, +25 after that). | Every run pays something, and streaks are no longer a third of the income. |
| 15 | A random start every run. | **The land is fixed.** The Depot is always at y = 0, so the stations, walls and loot spots never move. Some spots roll their contents again each run. | Players learn the land. |
| 16 | Pacing: 105mm and Winch at 8–15 min, Station 2 at 15–22 min. | 105mm at **6:14**, Winch at **8:22**, and the train reaches Mill Town (Station 2) at about **10:20**. The new pacing after minute 10 is in 1.1. | Starting from a station makes km 1–2 go fast. So km 2–4 must be slower to fill 45 minutes. |
| 17 | 110 zombies around the Depot at the start. | **About 40.** | The big start crowd made run 1 deaths random. |

**Not in the first 10 minutes:** Bomber, Golden Zombie, Thermal caches, Mortar Pit (shown only as a locked goal), SHOCK HORN, the "Back to Depot" button, the boss.

### 1.1 After minute 10 (this replaces the DESIGN.md pacing table)

Mill Town comes at about 10:20, not at 15–22 min. So km 2–4 must fill about 35 minutes. Here is the plan now, not "later":

| Time | What happens | New thing |
|---|---|---|
| 0–10 min | This doc: runs 1–6. You hold and build Farm Stop, buy the 105mm and the Winch, and smash Mill Town's wall. | Skill tree, Turbo Ram, station holds, the Station panel, survivors |
| 10–15 min | The first Mill Town hold (50 s, 10 survivors). Its grid opens with its own free kit. You buy MORTAR PIT * (8 survivors) and SHOCK HORN *. | The Mortar Pit, a second grid, the second active skill |
| 15–22 min | Runs from Mill Town into km 2–3. Bombers appear from 2 km. You buy LAST STAND * and FLARE DROP *. | Chain explosions, two more active skills |
| 22–32 min | You push to the Quarry wall at 2.65 km. It is 240 px long, with 10 Brutes and Bombers. One Ram from the usual spot ends inside it, so you need RAM TIME or the 105mm to thin it first. You buy THERMAL CAMERA * and AUTO RAM *. Golden Zombies appear. | Hidden caches, a train that rams by itself |
| 32–45 min | You reach Quarry (3 km, 12 survivors, a 60 s first hold). Then come km 3–4, the Safe Zone wall (12 Brutes) and the Wall Breaker at 4 km. | The boss, and the end of the demo |

**How km 2–4 gets slower:**
- Dead Walls past 2 km have 8 or more Brutes, plus Bombers.
- Nodes that open after minute 10 cost **×2.5 per level**, not ×2.
- First holds get longer: Mill Town 50 s, Quarry 60 s.
- The horde formulas in 7.2 keep growing past 2 km (more Brutes, bigger rail crowds), up to the 400 cap.
- Big ★ nodes cost 8–12 survivors. The house refill rule (7.4) stops survivor farming.
- **Test:** km 2–3 should take about 20 minutes of runs. If it goes faster, make the horde past 2 km bigger (7.2).

---

## 2. The Skill Tree panel

### 2.1 The Depot screen (both tabs share this frame)

```
x 0                                                                          640
y 0   +------------------------------------------------------------------------+
      | [bolt] 91   [man] 0         [ SKILL TREE ] [ STATION ]       BEST 0.48 KM|
y 18  +------------------------------------------------------------------------+
      |                                                                        |
      |                    the tab's panel (y 19 to 331)                       |
      |                                                                        |
y 332 +------------------------------------------------------------------------+
      | START FROM [<] DEPOT 0.0 KM [>]      (hint line)          [ START RUN ] |
y 360 +------------------------------------------------------------------------+
```

- **Behind the panels,** the title demo keeps running (the train and the autopilot), dimmed. The screen looks alive and costs almost nothing.
- **Top bar.** Scrap (gold, bolt icon) and survivors (green, person icon) on the left. The 2 tabs in the middle. The active tab is gold.
  - Until you hold Farm Stop once, the STATION tab is grey, with a padlock and the word `STATION`. You can still hover or click it. It opens a **read-only preview** of the Farm Stop grid with the free kit, and the hint bar says `HOLD FARM STOP ONCE TO BUILD HERE.` So the player sees the build panel from 0:06.
  - After that the tab shows `NEW`. A red dot with a number means free towers are still waiting to be placed.
- **Bottom bar.** `START FROM [<] [>]` switches between the starts you have reached: DEPOT, then FARM STOP. START RUN is a big gold button at the bottom right.
- **Keys:** TAB switches tabs. ENTER is START RUN. On the Station tab, ESC first cancels a selected item or a drag. Only when nothing is selected does ESC go back to the title.

### 2.2 The tree map

- The nodes sit on a grid of 32 px cells around the center of the screen.
- All nodes of the first 10 minutes fit on one screen, so there is **no panning yet**. Later nodes go further out, and you drag with the mouse (or use WASD) to pan.

```
              col -6     -4     -2      0      2      4      6
row -4 (y 47)                         [WIN*]                        EXPLORE
row -3 (y 79)                 [MAG]          [SCV]
row -2 (y111)  [FRL]  [105*]          [RAD]          [RAM*]
row  0 (y175)  [HVY]  [FF ]   [COO]   [LT ]   [ARM]  [GUN*]  [GSP]
                HELI                                         TRAIN
row  2 (y239)                         [FST]
row  3 (y271)                 [NSP]          [WIR]
row  4 (y303)                         [MOR*]  STATION
  info box: x 8..228, y 268..326 (it never covers a node)
```

- **Branch colors:** HELI blue, TRAIN gold, STATION teal, EXPLORE green. Each branch name is faint text next to its first node.
- **Lines** are 1 px, drawn from center to center under the nodes. A line is grey until the child node has a level. Then it turns the branch color.

### 2.3 How a node looks

- A **normal node** is a dark 22×22 square with a 1 px frame and a 12×12 pixel icon.
- A **★ node** is 26×26, with a double frame and a 5×5 star icon in the top-right corner.
- **Level pips** sit 3 px under the node, 2×2 px each. Bought levels are gold. The rest are dark grey.
- **Names are not drawn under the nodes,** because they don't fit at 32 px. Names show in the info box, like in Shelldiver.

| State | When | Look |
|---|---|---|
| Hidden | Its parent has 0 levels. | A dim grey square with "?". The tree's shape shows, but not its secrets. |
| Goal (★ only) | Once the root is bought. STATION-branch goals show once Farm Stop is held. | Icon at 60%, with the price. The info box says `NEEDS: ARMOR 1`. |
| Can't buy | You don't have enough scrap or survivors. | Grey frame, icon at 40%, price in red. |
| Can buy | You can pay now. | The frame pulses gold, once a second. |
| Bought | 1 or more levels, not max. | Frame in the branch color, gold pips. |
| Max | All levels bought. | Light fill in the branch color, and `MAX` in the info box. |

**Info box** (when you hover a node), 220×58:
```
ARMOR                          LV 1/5
TRAIN HP +20 PER LEVEL
NOW 100  ->  NEXT 120
[bolt] 80        (red if you can't pay)
```

**What happens when you buy:**
- One click buys one level.
- The node flashes white for 0.12 s, and a gold square ring grows out of it.
- A buy sound plays: two rising notes and a coin.
- The scrap number counts down.
- New child nodes pop in with a small gold `NEW` for 3 s, and their lines draw out over 0.3 s.

**The very first time the tree opens,** only LAST TRAIN shows, pulsing, with `FREE`. You click it. 4 lines grow out to 4 new nodes, and the ★ goals appear with their prices. This is the "watch it grow" moment from Shelldiver.

### 2.4 Nodes in the first 10 minutes

All costs are in scrap unless the table says survivors. Each level costs double the last one.

| Node | Branch | Pos | Needs | Lv | Cost per level | Effect | Bought at |
|---|---|---|---|---|---|---|---|
| LAST TRAIN | root | 0,0 | — | 1 | free | Opens the 4 branches. | 0:06 |
| ARMOR | TRAIN | 2,0 | LAST TRAIN | 5 | 40 / 80 / 160 / 320 / 640 | Train HP +20 (80 to 180). | lv1 1:05, lv2–3 3:35, lv4 6:20 |
| FLATCAR GUN * | TRAIN | 4,0 | ARMOR 1 | 1 | **300** | An auto gun on the flatcar (7.7). | 2:12 |
| GUN SPEED | TRAIN | 6,0 | FLATCAR GUN | 3 | 150 / 300 / 600 | Flatcar Gun +1 round/s (3 to 6). | lv1 6:20, lv2 8:25 |
| TURBO RAM * | TRAIN | 4,−2 | FLATCAR GUN | 1 | **500** | Active skill, key E (section 4). Card text: "FIX THE BOILER". | 3:30 |
| COOLING | HELI | −2,0 | LAST TRAIN | 3 | 40 / 80 / 160 | 25mm heat per round ×0.8 per level. It stacks: ×0.8 / ×0.64 / ×0.51. | lv1 1:05, lv2 6:20 |
| FAST FEED | HELI | −4,0 | COOLING 1 | 5 | 60 / 120 / 240 / 480 / 960 | 25mm +2 rounds/s. Heat per second stays the same. | lv1 1:05, lv2 6:20 |
| HEAVY ROUNDS | HELI | −6,0 | FAST FEED 1 | 3 | 200 / 400 / 800 | 25mm +1 damage (a Brute dies in 4 hits at lv1). | lv1 8:25 |
| 105MM CANNON * | HELI | −4,−2 | COOLING 1 | 1 | **5 survivors** | Unlocks the 105mm (right click or Space). | 6:14 |
| FAST RELOAD | HELI | −6,−2 | 105MM | 3 | 150 / 300 / 600 | 105mm reload −0.3 s (2.4 to 1.5). | lv1 8:25 |
| RADIO RANGE | EXPLORE | 0,−2 | LAST TRAIN | 5 | 40 / 80 / 160 / 320 / 640 | Flying range +60 px (300 to 600). | lv1 1:05, lv2 2:12, lv3 8:25 |
| MAGNET | EXPLORE | −2,−3 | RADIO RANGE 1 | 3 | 40 / 80 / 160 | Pickup radius +10 px (14 to 44). | lv1 6:20, lv2 8:25 |
| SCAVENGER | EXPLORE | 2,−3 | RADIO RANGE 1 | 5 | 150 / 300 / 600 / 1200 / 2400 | +10% scrap from kills. | lv1 6:20 |
| WINCH * | EXPLORE | 0,−4 | RADIO RANGE 2 | 1 | **5 survivors** | Lift stranded survivors (hover 1.5 s). | 8:22 |
| FARM STOP | STATION | 0,2 | hold Farm Stop once | 1 | free (given) | Opens the STATION tab for Farm Stop. | 5:36 |
| NEST SPEED | STATION | −2,3 | FARM STOP | 3 | 150 / 300 / 600 | All MG Nests +1 round/s (4 to 7). | lv1 6:20 |
| BARBED WIRE | STATION | 2,3 | FARM STOP | 1 | 100 | Unlocks wire tiles on the grid. | 6:20 |
| MORTAR PIT * | STATION | 0,4 | NEST SPEED 1 | 1 | 8 survivors | A goal only. It comes after minute 10. | — |

The children of later nodes show as "?" around the edges: RAM TIME, QUICK CHARGE, AUTO RAM *, SHOCK HORN *, MORE CRATES, BIG PLATFORM. They tell the player the tree goes on.

---

## 3. The Station panel (the grid)

### 3.1 Layout (inside the Depot frame)

```
x 0  8                                           456 466                  632 640
y 18 +-------------------------------------------------------------------------+
  20 | FARM STOP  1.0 KM                       FIRST HOLD 40 S, LATER 25 S      |
  28 |  +------------------------------------------+  +---------------------+  |
     |  | 14 x 9 tiles, 32 px each (2x zoom)       |  | BUILD               |  |
     |  | ground, rails, platform, house, the      |  | [1] MG NEST   150   |  |
     |  | parked train, your towers.               |  |     1/4 BUILT       |  |
     |  | red WAVES arrows at rows 1 and 7 on      |  | [2] SANDBAGS  10    |  |
     |  | both edges                               |  |     6/24 BUILT      |  |
     |  |                                          |  | [3] WIRE      15    |  |
     |  |                                          |  | [4] MORTAR  LOCKED  |  |
     |  |                                          |  |---------------------|  |
     |  |                                          |  | MG NEST             |  |
     |  |                                          |  | 4 ROUNDS/S          |  |
     |  |                                          |  | RANGE 6 TILES       |  |
     |  |                                          |  | R-CLICK: SELL       |  |
     |  |                                          |  |---------------------|  |
     |  |                                          |  | 1 WEST  2 EAST      |  |
     |  |                                          |  | 3 BOTH + BRUTE      |  |
 316 |  +------------------------------------------+  +---------------------+  |
 332 +-------------------------------------------------------------------------+
```
(The cards show what you see at 6:30: the kit is placed, and BARBED WIRE is bought.)

- **The grid is 14 columns × 9 rows. One tile is 16×16 world px.** On screen a tile looks square, just like the ground in the run. The ground is squashed (FORE 0.72), so a tile is 8 m across the rails and about 11 m along them.
- The panel draws the grid at **2×** (32 px per tile), so it is 448×288 at (8, 28). On a 2× window a tile is 64×64 real pixels, which is easy to click. If H is less than 340, the grid is drawn at 1×.
- Everything is drawn with the **real game sprites** at 2×, so it stays crisp: the station house, platform slabs, lamps, the parked train cars at angle 0, and the towers. The ground is a dark green checker. Blocked tiles get faint hatching. Grid lines are 1 px white at 8%.
- **Hotkeys:** 1 = MG NEST, 2 = SANDBAGS, 3 = WIRE (4 = MORTAR PIT later). The cards show the same numbers. Letter keys are not used, because WASD pans the tree.

### 3.2 The tiles

Column 0 is west (left). Row 0 is north (up, the way the train goes).

```
            0  1  2  3  4  5  6  7  8  9 10 11 12 13
   row 0    .  .  s  .  .  .  =  =  .  .  .  .  .  .
 >W row 1   .  .  s  .  .  .  E  E  P  .  .  .  .  .   E<
   row 2    .  .  s  .  .  .  E  E  L  .  .  .  .  .
   row 3    .  .  .  .  .  .  C  C  P  ~  ~  H  H  .
   row 4    .  .  .  .  N  .  C  C  P  ~  ~  H  H  .
   row 5    .  .  .  .  .  .  F  F  P  .  .  .  .  .
   row 6    .  .  s  .  .  .  F  F  L  .  .  .  .  .
 >W row 7   .  .  s  .  .  .  B  B  P  .  .  .  .  .   E<
   row 8    .  .  s  .  .  .  B  B  .  .  .  .  .  .
                              (the tanker stands south of the grid)
 = rails   E engine  C coach  F flatcar  B boxcar   P platform  L lamp
 ~ door path   H station house   N free MG Nest   s free sandbags   . free tile
 >W / E< = the 4 lanes where the waves come in
```

| Tile | Where | Count | Can you build? |
|---|---|---|---|
| Rails (the train stands here) | cols 6–7, every row | 18 | No |
| Platform and lamps | col 8, rows 1–7 | 7 | No |
| Door path (survivors run here) | cols 9–10, rows 3–4 | 4 | No |
| Station house | cols 11–12, rows 3–4 | 4 | No |
| Free | everything else | **93** (54 west, 39 east) | Yes |

**Where the train stops** (the game already stops the train this way): the engine is in rows 1–2, the coach in rows 3–4 (its door faces the house), the flatcar in rows 5–6 and the boxcar in rows 7–8. The tanker stands just south of the grid.

**The 4 lanes:** tall **corn strips** run on both sides, from just outside the grid (120 px from the rail middle; the grid ends at 112 px) out to 200 px. The dead come out of the corn and walk straight across to the train in **rows 1 and 7**. On a first visit they start deep in the corn (150–200 px). On later visits they start at its near edge (120–140 px), so all 3 waves reach the train inside the shorter hold. Red `WAVES` arrows on the grid edges show the lanes.

### 3.3 What you can build in the first 10 minutes

| Item | Size | Price at each station | Max | What it does |
|---|---|---|---|---|
| MG NEST | 1 tile | 1st **free** (in the kit), then 150, 300, 600 | 4 | 4 rounds/s, 1 damage. Each round hits its target and 1 more zombie within 5 px. Range 96 px: **6 tiles across the rails, about 4 along them** (the ground is squashed). It shoots first at a zombie holding a survivor, then at the dead on the train, then on the rails, then the nearest. It can't be destroyed. |
| SANDBAGS | 1 tile | 6 **free** (in the kit), then 10 each | 24 | The dead can't walk through. A zombie that pushes on sandbags for 3 s climbs over (it takes 1 s). Sandbags never break. |
| BARBED WIRE | 1 tile | 15 each (needs the BARBED WIRE node) | 12 | The dead on it walk at 40% speed. It doesn't block. |
| MORTAR PIT * | 2×2 | grey card: `8 SURVIVORS` | — | A goal only. |

**Why sandbags climb over:** the dead don't find paths. They push straight at the train. If they could never climb over, a sandbag line would block a lane for the whole hold. This way the bags bunch the dead up and buy time, and the nests (and later the 105mm) do the killing.

### 3.4 The free kit

The Farm Stop people built it before you ever arrive. So **it fights in your first hold** (run 4). Before that, the locked STATION tab shows it as a read-only preview. The first time you can build, it is already standing where it fought.

- **1 MG Nest at (4,4)**, west of the coach.
- **6 sandbags** across the two west lanes: (2,0), (2,1), (2,2) and (2,6), (2,7), (2,8).
- The **east is empty** on purpose. In the first hold, wave 2 comes from the east. The runners go for the survivors, and one survivor dies. That is the lesson that sends you to the grid.

### 3.5 Placement rules

1. Click an item card (or press its number). It gets a gold frame. A ghost of it follows the mouse, snapped to the tiles.
2. A green tile frame means you can place it there. A red frame means the tile is blocked or taken, or you can't pay.
3. Left click places it, and you pay right away. You keep placing the same item until you right click on an empty tile or press ESC. (ESC only drops the item here. It does not leave the Depot.)
4. Wire: hold the left button and drag to paint a line. Painting stops when your scrap runs out.
5. **Drag** a placed item to move it. Moving is free.
6. **Right click** a placed item to sell it for a **full refund**. Free items go back to `FREE`. Trying ideas costs nothing.
7. One item per tile. The rails, platform, door path and house can never be built on, so the train and the survivors always have a way.
8. Hover a nest to see its range as a dotted oval. It covers most of the grid.
9. Every change saves right away.

### 3.6 How the grid becomes the real station

- The grid is the real station ground. One tile on the grid is one tile of ground in the run, so the grid bends with the rails (they bend less than 30° here).
- The station house moves a little further from the rails, and the platform a little closer, so they line up with the tiles.
- Everything you place stands in the real station, in the same spot, and the dead walk around it.
- Sandbags have no gaps between them, so a line of bags really blocks. Wire slows the dead who walk on it.
- **Towers wake up when the train is 200 m (400 px) away.** So as you come in, your build is already shooting at the 20 dead who wait at the station. For a run that starts at a station, they wake at once.

### 3.7 What the grid fights

The hold rules and wave sizes are in **7.4**. In short:
- **First visit:** 40 s, 8 survivors, 3 waves (west, then east, then both sides with a Brute).
- **Later visits:** 25 s, 3 survivors, 3 smaller waves that start closer. The 3 survivors come back only after a run that rides 0.5 km or more.
- **A run that starts at a station** begins with that station's later-visit hold.

---

## 4. Active skills

### 4.1 TURBO RAM

| | |
|---|---|
| **Unlock** | TURBO RAM * (TRAIN branch). It needs FLATCAR GUN and costs 500 scrap. Usually bought at 3:30. |
| **Key** | **E**, or click its card. It is the last card at the bottom left: the second card before you own the 105mm, the third after. |
| **Charge** | Full at the start of every run. After you use it, **kills fill it again: 200 kills = full**. Every kill counts (heli, flatcar gun, nests, normal crushes) except kills the Ram makes itself. That is about 27–47 s of play, and it gets faster as your guns grow. |
| **Speed** | The train speeds up to **80 px/s** (40 m/s, about 3× normal) in 0.4 s. It stays fast until the Ram has run 4 s. Then it eases back to 26 px/s over 1 s. |
| **Kill zone** | Every zombie within **16 px of the rail middle** (a strip 2 tiles wide), from 10 px behind the nose to 8 px in front of it, dies. **Brutes too.** |
| **No cost** | Crushes during the Ram don't slow the train and don't hurt it. |
| **The nose** | When the Ram starts, every zombie holding the engine's nose dies. The dead on the sides of the cars stay on (later, SHOCK HORN throws those off). |
| **Pay** | Ram kills pay **2× scrap**. The charge comes only from other kills, so a Ram never pays more than a small part of what filled it. In the plan, the Ram bonus is about 3.5% of all income (142 of 4,024 scrap). |
| **Distance** | About 360 px in 5 s instead of 130 px, so **+115 m per use**. |
| **The Dead Wall** | The Ram is the clean way through a Dead Wall (7.3). |
| **Can't start** | While the train brakes for a station or stands at one, or when the next stop is less than **250 m** away. The card turns grey and its tag says `STOP`. (A Dead Wall's back edge is 290 m from its station, so you can always Ram out of a wall.) |
| **Ends early** | A Ram that is still running when the next stop is **200 m** away ends with the float text `BRAKES!`. At 80 px/s the train needs 320 px to stop, and 200 m is 400 px. |

**How it looks** (built from existing FX):
- **Start:** banner `TURBO RAM! / THE TRAIN SMASHES THROUGH`, a strong screen shake and a kick. Six big puffs of black smoke and a thick white steam jet come from the stack. The engine sprite gets an additive orange tint.
- **During:**
  - Each frame, 2 sparks per car fly from the wheels (yellow and orange).
  - A dust bow wave rolls in front of the nose. The headlights grow (radius 6 to 10), and a third beam reaches 90 px ahead.
  - 14 white speed lines (1 px, 10–30 px long, 25% alpha) stream down the outer 30% of the screen.
  - The camera leads 40 px ahead.
  - Bodies fly twice as hard as in a normal crush, with a small shake per kill. Each kill pops a gold `+2`.
- **End:** a long steam hiss. If the Ram killed 5 or more, a banner shows its rank: 5–14 kills `SMASH ×N`, 15–29 `RAMPAGE ×N`, 30 or more `UNSTOPPABLE ×N`. The line under it says `+X SCRAP` (what the Ram kills paid).

**How it sounds:**
- The horn blows twice. The second blast is higher.
- A new rising roar plus a noise burst. The engine hum plays higher.
- The wheel clack speeds up.
- A crunch on each kill. Its pitch rises with the count.
- A long steam hiss at the end.

**The card:**
- A card named `TURBO RAM`. It sits after the 25mm card, or after the 105mm card once that is owned.
- The tag says `E` in gold when full, `71%` while charging, `GO!` during the Ram, and `STOP` near stations. The bar shows the charge.
- When it becomes full: a ready beep and a gold flash.
- When the Ram is full and 4 or more dead are on the rails ahead, the existing warning `THE DEAD ARE ON THE TRACK AHEAD` gets `(E: RAM)` added.

**The first real Ram (run 4, 4:30).** The first time you come near a Dead Wall with a full Ram, at 150 px before the wall:
- Time slows to 25% for up to 3 s of real time.
- A big `PRESS E!` shows in the middle, and the card pulses.
- With reduced motion turned on, the game pauses with the prompt instead.

**The run-1 taste (once ever, 0:11).** 12 dead stand on the rails at the Depot gate. The Engineer yells, and the train rams for 3 s (`RAM ×12`). Then the boiler "cracks": the card goes grey with a padlock and the tag `TREE`. You see the power in the first 10 seconds, it gets taken away, and the tree sells it back. The taste uses the same look and sound as the real Ram.

### 4.2 Later active skills (after minute 10, one per branch)

| Skill | Branch | Key | What it does | Planned unlock |
|---|---|---|---|---|
| SHOCK HORN * | TRAIN | Q | Every zombie on the train is thrown off and dies. Charge: 150 kills. | ~12–15 min |
| LAST STAND * | STATION | G | Only during a hold: all towers fire 2× as fast for 8 s. Once per hold. | ~15–18 min (Mill Town) |
| FLARE DROP * | HELI | R | A flare where you aim. For 6 s, the dead within 200 px walk to it: off the track and bunched up for the 105mm. Charge: 150 kills. | ~18–22 min |
| AUTO RAM * | TRAIN | — | The train rams by itself when the charge is full and 6 or more dead are on the rails ahead. It works "without the king watching" (Zero Stress King). | ~25 min |
| RAM TIME / QUICK CHARGE | TRAIN | — | Ram +0.5 s (2 lv) / charge −30 kills (2 lv). | after 10 min |

---

## 5. Minute by minute: 0:00 to 10:00

Each run lists what is new, what the player sees, what they earn and what they buy. The earnings add up in section 8. The train starts every run at full speed (26 px/s), and every time here fits that speed.

### Before run 1 · 0:00–0:10
- **0:00** Title. The demo train runs behind the menu. Click **PLAY**. (With a save, it says CONTINUE and goes to the Depot.)
- **0:03** The Depot opens on the SKILL TREE tab. Only LAST TRAIN shows, pulsing, with `FREE`. Tag: `CLICK THE TRAIN. IT'S FREE.`
- **0:06** Click. 4 lines grow out to ARMOR, COOLING, RADIO RANGE and a padlocked STATION node (`HOLD FARM STOP`). The ★ goals appear with their prices: FLATCAR GUN 300, TURBO RAM 500, 105MM 5 survivors, WINCH 5 survivors. (MORTAR PIT stays hidden until the STATION branch opens.)
- **0:08** Tag: `PRESS START RUN.` The button pulses.
- **New:** the skill tree.

### Run 1 · 0:10–0:52 (42 s) · Depot to 0.48 km
**Stats:** HP 80, 25mm at 12 rounds/s (it overheats after 6 s of fire), flying range 300 px.

Run 1 teaches only 4 things by name: the Ram taste, flying, shooting, and shooting the dead on the track. Everything else just happens, and later runs name it.

- **0:10** Banner `ESCORT THE TRAIN`. The Depot gate opens, and 12 dead stand on the rails just ahead.
- **0:11** Radio: `ENGINEER: DEAD ON THE TRACK! FULL STEAM!` The train rams for 3 s: orange glow, sparks, speed lines, bodies in the air. `RAM ×12`.
- **0:14** A long hiss. Radio: `ENGINEER: THE BOILER CRACKED! FIX IT IN THE SKILL TREE.` A grey card appears: TURBO RAM, padlock, `TREE`.
- **0:16** The Tasks box (top left) shows 2 lines: `WASD: FLY` and `HOLD LEFT CLICK: SHOOT (0/10)`. When the player lets go of the keys, the heli keeps pace with the train (as today).
- **0:22** The first crowd on the rails. A third task line: `SHOOT THE DEAD ON THE TRACK (0/5)`. Each one the engine hits shows a red `-2` over the engine and slows the train.
- **0:28** A zombie climbs on, and a car flashes red. No task yet: the red flash and the HP bar say enough. The task comes in run 2.
- **0:35** A scrap pile glints 80 px east of the rails (the closest a pile can be), right under the heli's usual path, with a gold radar dot. No task yet. Most players fly over it to see what it is: **+15**, a coin chime, and coins fly to the counter.
- **0:40** The first overheat. Tip: `TOO HOT! LET GO FOR A SECOND.`
- **0:45** At 0.4 km, the first 3 runners. No banner yet, because run 1 is busy. The banner comes in run 2.
- **0:48** HP drops under 35%: red screen edges and `TRAIN IN DANGER` (both exist today).
- **0:52** The tanker blows, then the engine. The train is lost at **0.48 km**.

- **Earn:** 180 kills = 195 scrap, streaks 37, distance 24, loot 15 = **271 scrap**.
- **Summary (0:52–1:00):** the rows count up with a tick each: `ZOMBIES 180 +195`, `STREAKS +37`, `DISTANCE 0.48 KM +24`, `LOOT +15`, then `SCRAP +271`. Under them: `YOU KEEP ALL YOUR SCRAP.`, `FARM STOP: 520 M AWAY` and `NEXT GOAL: FLATCAR GUN (300)`. The only button is `TO THE DEPOT` (Enter).
- **Tree (1:00–1:11):** tag on ARMOR: `BUY ARMOR: +20 TRAIN HP. THEN PRESS START RUN.` The player buys **ARMOR 1 (40), COOLING 1 (40), FAST FEED 1 (60), RADIO RANGE 1 (40)**. Spent 180, **91 left**.
- **New:** the Ram taste, flying and shooting, crushes, climbers, scrap, overheat, runners, "you keep it all", the first buys.

### Run 2 · 1:11–2:01 (50 s) · Depot to 0.60 km
**Stats:** HP 100, 25mm at 14/s (overheats after 10 s), range 360 px. The train averages about 24 px/s this run.

- **1:18** The first climber. Task: `SHOOT THE DEAD OFF THE TRAIN`.
- **1:22** Task: `GRAB 3 SCRAP PILES (0/3)`. The player takes three piles between 1:22 and 1:50 (+45).
- **1:38** At 0.32 km, a gold dot blinks on the radar, 410 px west. The player flies over, and the heli stops at its range. Banner: `GOLDEN CRATE / TOO FAR. BUY RADIO RANGE.`
- **1:44** At 0.40 km, the runners come again. Banner: `RUNNERS / FAST, BUT ONLY 1 HP`.
- **1:51** The train passes 0.48 km: banner `NEW BEST`.
- **1:53** At 0.50 km: `DEAD WALL IN 150 M / BRUTES ON THE TRACK`. No new crowds come onto the rails now.
- **1:57** At 0.55 km, the radio: `FARM STOP: WE SEE YOUR SMOKE! 8 OF US ARE WAITING.` The Farm Stop mark on the route bar glows.
- **2:01** The train is lost at **0.60 km**. The Dead Wall's Brutes are in sight, 50 m ahead.

- **Earn:** 215 kills = 221, streaks 37, distance 30, loot 45 = **333**. Bank 424.
- **Summary:** `NEW BEST 0.60 KM`. `FLATCAR GUN: YOU CAN BUY IT NOW!`
- **Tree (2:09–2:20):** the hint bar says `* NODES ARE BIG UNLOCKS.` The player buys **FLATCAR GUN * (300)** at 2:12, and **RADIO RANGE 2 (80)** for the golden crate. Spent 380, **44 left**.
- **New:** climbers and scrap as tasks, the runner banner, the golden crate as a goal, the Farm Stop radio, the Dead Wall seen, NEW BEST, the first ★.

### Run 3 · 2:20–3:22 (62 s) · Depot to 0.66 km (stopped at the Dead Wall)
**Stats:** HP 100, Flatcar Gun 3 rounds/s, range 420 px.

- **2:22** The flatcar turret turns and fires on its own, with short tracers. Tip: `YOUR FLATCAR GUN GUARDS THE TRAIN. GO EXPLORE!` From this run on, supply crates appear (6.3).
- **2:30** At 0.12 km, a green smoke column rises 260 px east. Task: `GRAB THE SUPPLY CRATE`. 8 slow dead guard it, and they pay scrap too. **+50**.
- **2:47** At 0.32 km, the golden crate is in range now: a gold beam and a gold coin burst. **+150**.
- **2:59** At 0.50 km: `DEAD WALL IN 150 M / BRUTES ON THE TRACK`.
- **3:06** The wall comes into view: 30 dead and **4 Brutes** standing on the rails. Red label `BRUTE!`, and the tip `BRUTES HAVE 8 HP. THE TRAIN CAN'T PUSH THEM.`
- **3:12** Contact. Each Brute the train hits costs −10 HP and cuts the speed to 35%. The train crawls, and the dead climb onto the nose.
- **3:22** The train is lost at **0.66 km**.

- **Earn:** 310 kills = 360, streaks 77, distance 33, loot 230 = **700**. Bank 744.
- **Summary:** `THE DEAD WALL STOPPED YOU. TURBO RAM SMASHES THROUGH IT.` and `FARM STOP WAS 340 M AWAY!`
- **Tree (3:30–3:42):** the player buys **TURBO RAM * (500)** at 3:30, then **ARMOR 2 (80) and ARMOR 3 (160)**. Hint: `E: TURBO RAM. SAVE IT FOR THE DEAD WALL.` Spent 740, **4 left**.
- **New:** the auto gun, the supply crate with guards, the golden crate pays, the first Brutes, the Dead Wall.

### Run 4 · 3:42–5:58 (136 s) · Depot to Farm Stop to 1.30 km. The big one.
**Stats:** HP 140, Turbo Ram (full), flatcar 3/s, 25mm 14/s.

- **3:42** The RAM card is gold: `E`.
- **3:57** The supply crate is back (crates refill every run): +50.
- **4:24** At 0.50 km: `DEAD WALL IN 150 M / SAVE YOUR TURBO RAM!`
- **4:30** 150 px before the wall, time slows to 25% and `PRESS E!` shows big.
- **4:31** E. A double horn, a roar, steam, the engine glows orange, speed lines. 30 dead and 4 Brutes fly. **`UNSTOPPABLE ×34` / `+140 SCRAP`**. The Ram ends at about 0.76 km at 4:36.
- **4:45** At 260 px before the station: `FARM STOP AHEAD / YOUR TOWERS ARE READY`. The towers woke 5 s ago. The free kit is already shooting at the 20 dead who wait at the station.
- **4:56** The train stops with the coach at the house. `+20 HP REPAIRED`. Banner: `HOLD THE STATION / 40 SECONDS. SAVE THE SURVIVORS.` A 40 s bar appears. Tip with an arrow: `YOUR MG NEST SHOOTS BY ITSELF.`
- **4:56** `WAVE 1  < WEST`: 35 dead come out of the corn and bunch up at the sandbags, and the nest chews them. At 4:58 the first survivor runs from the house. One more leaves every 4.5 s.
- **5:06** `WAVE 2  EAST >`: 39 dead and 6 runners. Nothing is built on that side. The runners go for the survivors: `HELP!` at 5:11, and the tip `SHOOT THE ZOMBIE TO SAVE THEM.` One survivor is lost at 5:12 (`SURVIVOR DOWN`).
- **5:16** `WAVE 3  < BOTH >`: 52 dead and 8 runners. At 5:18 a Brute pushes out of the east corn.
- **5:36** `STATION HELD! / 7 OF 8 SURVIVORS ABOARD` and `+50`. Then: `FARM STOP IS YOURS`.
- **5:38** The train leaves. The hold kills have filled the Ram again.
- **5:48** At 1.1 km, a rail crowd with a Brute. The player rams: **`RAMPAGE ×16` / `+58 SCRAP`**. The Ram ends at about 1.28 km at 5:53.
- **5:58** The train is lost at **1.30 km**.

- **Earn:** 875 kills = 1,109 (including the Ram bonus of 99), streaks 114, distance 65, station 50, loot 110 = **1,448 scrap, +7 survivors**.
- **New:** the first real Ram, the first station hold, survivors, a survivor lost, the towers fighting.

### Depot break · 5:58–6:52
- **Summary (5:58–6:10):** survivor icons pop in one at a time, each with a chime: `SURVIVORS +7`. Then `NEW: SURVIVORS. THEY BUY THE BIGGEST * NODES.` and a stamp: `FARM STOP IS YOURS. SEE THE STATION TAB.`
- **Tree (6:10–6:30):**
  - The padlock on the STATION branch breaks with a crunch and sparks. FARM STOP lights up, with NEST SPEED, BARBED WIRE and the MORTAR PIT * goal under it.
  - Tag on 105MM: `BUY THE 105MM WITH 5 SURVIVORS.` The player buys **105MM * (5 survivors)** at 6:14.
  - Then the shopping spree (the reward for the first station): **ARMOR 4 (320), COOLING 2 (80), FAST FEED 2 (120), GUN SPEED 1 (150), MAGNET 1 (40), NEST SPEED 1 (150), BARBED WIRE (100), SCAVENGER 1 (150)** = 1,110.
- **Station panel (6:30–6:48), first time, 3 guided steps:**
  1. `THIS IS FARM STOP. YOUR TOWERS WAIT HERE.` The free kit stands where it fought.
  2. `WAVE 2 CAME FROM THE EAST. PUT A NEW MG NEST THERE.` Tile (11,5) glows. The player places **MG NEST #2 (150)** there. It covers both east lanes and the door path. The wire card is open now, so the player paints **4 wire tiles (60)** in the east lanes at (10,1), (11,1), (10,7), (11,7).
  3. `DRAG TO MOVE. RIGHT CLICK: SELL (FULL REFUND).`
- Spent 1,110 + 210 = 1,320. **132 scrap and 2 survivors left.**
- **Start picker (6:48):** `START FROM [<] FARM STOP 1.0 KM [>]`. Hint: `START AT FARM STOP: YOUR TOWERS FIGHT FIRST.` and `3 SURVIVORS WAIT AT FARM STOP.` (Run 4 rode 1.30 km, so the house has refilled.)
- **New:** survivors as money, the STATION branch, the 105mm, the Station panel, starting from a station.

### Run 5 · 6:52–8:12 (80 s) · Farm Stop to 1.62 km
**Stats:**
- HP 160. 25mm at 16/s (overheats after 18 s).
- Flatcar 4/s, 105mm, Ram.
- 2 nests at 5/s each, 4 wire tiles.
- Pickup radius 24, Scavenger +10%.

- **6:52** The run starts 60 px before Farm Stop. The train rolls in and stops.
- **6:55** The hold: 25 s, 3 survivors. The dead start at the near edge of the corn.
  - `WAVE 1  < WEST` hits the sandbags.
  - At 7:01, `WAVE 2  EAST >`: this time the new nest is waiting. The runners crawl through the wire and get shredded.
  - At 7:06, `WAVE 3  < BOTH >` and a Brute.
- **7:20** No survivor lost: **`PERFECT HOLD! +1 SURVIVOR`**, then `STATION HELD! +25`. You see your own build work, 30 s after you built it.
- **7:22** The train leaves.
- **7:24** The first crowd on the rails. Task: `RIGHT CLICK: 105MM`. The shell whistles for 1.1 s, then BOOM: a crater, smoke and flying bodies. `MULTI KILL ×9`.
  - If the sight comes close to the train, it shows `DANGER CLOSE` (exists today).
  - If a shell hits the train: `CHECK FIRE!` (exists today).
- **7:32** At 1.1 km, Brutes in the rail crowds. Tip: `BRUTE ON THE TRACK! USE THE 105MM OR THE RAM.` The player drops a shell on the crowd, and the Brute goes up with it.
- **7:40** At 1.2 km, a red flare goes up from a bus roof 220 px east, and a survivor waves on top. The label `SOS` shows, with a white blinking radar dot. Tip: `A SURVIVOR! YOU NEED THE WINCH.`
- **7:48** At 1.30 km, a supply crate 320 px west (+100; past Farm Stop, crates pay double).
- **7:57** At 1.42 km, a big rail crowd with a Brute. The player rams it: **`RAMPAGE ×18` / `+68 SCRAP`**.
- **7:59** At 1.50 km, still ramming: `DEAD WALL IN 150 M / SAVE YOUR TURBO RAM!` This is Mill Town's wall, and the Ram card is empty. The player used it 20 s too soon.
- **8:00** Radio: `MILL TOWN: 10 OF US HERE. PLEASE HURRY!`
- **8:02** The Ram ends at 1.60 km. The wall wakes up 50 m ahead and walks onto the train.
- **8:12** The train is lost at **1.62 km**, 30 m before Mill Town's wall. The Ram card is only at about 70%.

- **Earn:** 600 kills = 1,008 (including the Ram bonus and Scavenger), streaks 77, distance 32 (0.65 km traveled), station 25, loot 130 = **1,272 scrap, +4 survivors** (3 + PERFECT).
- **New:** your build fighting, PERFECT HOLD, the 105mm, Brutes on the rails, the SOS survivor, Mill Town, and the cost of using the Ram too soon.

### Depot break · 8:12–8:38
- **Summary:** `+4 SURVIVORS`, `NEW BEST 1.62 KM`, `MILL TOWN WAS 380 M AWAY!` and `MILL TOWN'S WALL IS AT 1.65 KM. SAVE YOUR RAM FOR IT.`
- **Tree (8:20–8:30):** tag on WINCH: `WINCH: SAVE SURVIVORS IN THE FIELD.` The player buys **WINCH * (5 survivors)** at 8:22, then **GUN SPEED 2 (300), HEAVY ROUNDS 1 (200), FAST RELOAD 1 (150), RADIO RANGE 3 (160), MAGNET 2 (80)** = 890.
- **Station (8:30–8:36):** **MG NEST #3 (300)** at (5,6). It covers the flatcar and the southwest lane.
- **214 scrap and 1 survivor left.** Goal line: `NEXT: ARMOR 5 (640)`. START FROM: FARM STOP. (Run 5 rode 0.65 km, so the house has refilled.)

### Run 6 · 8:38 onward · Farm Stop, still going at 10:00
- **8:41–9:06** The hold with 3 nests: clean and fast. The Brute dies before it reaches the train. PERFECT HOLD again (+3 +1 survivors).
- **9:08** The train leaves.
- **9:25** At 1.2 km, the SOS flare. The player flies 220 px east to the bus. Tip: `HOVER OVER THEM TO LIFT THEM UP.` A circle fills in 1.5 s, and a rope drops. The survivor grabs it and swings under the heli, with a creak and a cheer.
- **9:29** **`+1 SURVIVOR`**, and the icon flies to the counter.
- **9:31–9:46** Back over the train. Heavy Rounds: Brutes now go down in 4 hits.
- **9:48** At 1.50 km: `DEAD WALL IN 150 M / SAVE YOUR TURBO RAM!` This time the card is full: the player kept it.
- **9:54** 150 px before Mill Town's wall (40 dead + 6 Brutes), the player presses E: **`UNSTOPPABLE ×46` / `+220 SCRAP`**.
- **10:00** The train is at about 1.77 km. Radio: `MILL TOWN: WE HEAR YOUR HORN! 10 OF US!` The Mill Town mark on the route bar blinks: `230 M`. Survivors: 6. **The hook:** the first Mill Town hold starts in about 20 s (at about 10:19), and the MORTAR PIT * (8 survivors) is close.

### Something new every 1–2 minutes

| Time | New thing | Gap |
|---|---|---|
| 0:03 | Skill tree, free first node | — |
| 0:11 | Turbo Ram taste | 0:08 |
| 0:16 | Flying and shooting (tasks) | 0:05 |
| 0:22 | The track hurts the train | 0:06 |
| 0:28 | Climbers | 0:06 |
| 0:35 | Scrap pile | 0:07 |
| 0:40 | Overheat | 0:05 |
| 0:45 | Runners | 0:05 |
| 0:52 | Train lost, "you keep it all" | 0:07 |
| 1:00 | First buys | 0:08 |
| 1:18 | Task: shoot the dead off the train | 0:18 |
| 1:22 | Task: grab 3 scrap piles | 0:04 |
| 1:38 | Golden crate, too far | 0:16 |
| 1:51 | NEW BEST | 0:13 |
| 1:53 | Dead Wall warning | 0:02 |
| 1:57 | Farm Stop radio | 0:04 |
| 2:12 | Flatcar Gun (first ★) | 0:15 |
| 2:22 | The train fights alone | 0:10 |
| 2:30 | Supply crate with guards | 0:08 |
| 2:47 | Golden crate pays 150 | 0:17 |
| 3:06 | First Brutes, the Dead Wall | 0:19 |
| 3:30 | Turbo Ram bought | 0:24 |
| 4:31 | **First real Ram** (slow motion) | 1:01 |
| 4:45 | Your kit fights on arrival | 0:14 |
| 4:56 | **First station hold** | 0:11 |
| 5:11 | A survivor grabbed and lost | 0:15 |
| 5:36 | Station held | 0:25 |
| 5:58 | Survivors (new money) | 0:22 |
| 6:14 | 105mm bought, STATION branch | 0:16 |
| 6:30 | **Station panel, first build** | 0:16 |
| 6:48 | Start from a station | 0:18 |
| 7:01 | Your build stops wave 2 | 0:13 |
| 7:20 | PERFECT HOLD | 0:19 |
| 7:24 | First 105mm shot | 0:04 |
| 7:32 | Brutes on the rails | 0:08 |
| 7:40 | SOS survivor (needs the Winch) | 0:08 |
| 7:59 | Mill Town's wall, with an empty Ram | 0:19 |
| 8:22 | Winch bought | 0:23 |
| 9:29 | First winch rescue | 1:07 |
| 9:54 | Mill Town's wall smashed | 0:25 |
| 10:00 | Mill Town ahead (the hook) | 0:06 |

The two longest gaps are 1:07 (8:22 to 9:29) and 1:01 (3:30 to 4:31). Building Nest #3, a clean 3-nest hold and the flight to the bus fill the first one. The second is the build-up to the first real Ram, and the "SAVE YOUR TURBO RAM!" warning fills it with tension.

---

## 6. Exploring (flying left and right) in the first 10 minutes

### 6.1 What is out there

| Loot | Pays | Where | How often | How you spot it |
|---|---|---|---|---|
| Scrap pile (on a car wreck) | **15** (30 past Farm Stop) | 80–260 px from the rails | One spot every 100 m. Each run, 60% of the spots have a pile (rolled again every run). About 6 per km. | A small metal heap with a white glint every 1.2 s, and a dim gold radar dot |
| Supply crate (in a burnt farm) | **50** (100 past Farm Stop) | 260–320 px | A fixed list (6.2). It refills every run. 8 slow dead guard it. **Crates and guards appear only once you own the FLATCAR GUN.** | A green smoke column 40 px tall, a green radar dot, and an edge arrow `CRATE 130M` within 450 px |
| Golden crate | **150, once ever** | 0.32 km, 410 px west | Only one in the first 10 minutes | A gold beam, a blinking gold radar dot, and an edge arrow `GOLD` |
| Stranded survivor (SOS) | **+1 survivor, once** | 1.2 km, 220 px east, on a bus roof | It appears after you hold Farm Stop. | A red flare every 6 s, a white blinking radar dot, and the label `SOS` |

### 6.2 The line, km 0 to 2 (all fixed)

| km | What |
|---|---|
| 0.0 | DEPOT (about 40 dead around it) |
| 0.12 | Supply crate, 260 px east (from the first run with the Flatcar Gun) |
| 0.32 | **Golden crate**, 410 px west |
| 0.40 | Runners start |
| 0.50 | `DEAD WALL IN 150 M`; no new rail crowds from here to the wall |
| 0.58 | Supply crate, 300 px west |
| **0.65** | **DEAD WALL (Farm Stop)** |
| **1.0** | **FARM STOP** |
| 1.1 | Brutes on the rails start |
| 1.2 | **SOS bus**, 220 px east |
| 1.30 | Supply crate, 320 px west |
| 1.50 | `DEAD WALL IN 150 M` (Mill Town) |
| 1.55 | Supply crate, 300 px east |
| **1.65** | **DEAD WALL (Mill Town)** |
| 1.90 | Supply crate, 280 px west |
| **2.0** | **MILL TOWN** |

### 6.3 Rules
- **Reach = flying range + pickup radius.** Range: 300 px, +60 per RADIO RANGE level. Pickup: 14 px, +10 per MAGNET level. So the golden crate (410 px) needs RADIO RANGE 2 (420 + 14).
- **Pick up:** fly so the heli's ground point is within the pickup radius. The item flies up to the heli in 0.3 s. Then you get `+15`, a coin chime, and coins flying to the counter.
- **At the range limit,** the heli is pulled back, and the warning says `RADIO RANGE LIMIT  (F: BACK)` (at 95% of the range; today it shows at 85%).
- **Supply crates wait for the Flatcar Gun.** They (and their guards) appear only from the first run where the train can guard itself. That keeps run 3's `GO EXPLORE!` as the moment crates come in, and keeps runs 1–2 simple.
- **Guards:** 8 slow walkers stand around each crate. They stand still until the heli is within 120 px. They can't hurt the heli, and they pay scrap.
- **Winch:** hover within 20 px of the survivor for 1.5 s. Leaving the circle resets the timer.
- **The catch:** while you are away, only the train's guns protect the train. The existing warnings stay (`STAY WITH THE TRAIN (F)`, and the train arrow with the count of the dead on it).

### 6.4 How much exploring pays

| Run | Taken | Loot scrap | Share of the run |
|---|---|---|---|
| 1 | 1 pile (no task yet) | 15 | 6% |
| 2 | 3 piles (the task); the golden crate is seen but too far | 45 | 14% |
| 3 | crate 0.12, golden crate, 2 piles | 230 | **33%** |
| 4 | crate 0.12, 2 piles, 1 pile past Farm Stop | 110 | 8% |
| 5 | crate 1.30, 1 pile | 130 | 10% |
| 6 | the SOS survivor | +1 survivor | survivors are rare, so this is big |

In runs 4 and 5 the station and the kills pay much more than loot. That's fine: from 8:22, **the Winch turns the fields into a survivor source.** After minute 10, the MORE CRATES, GOLDEN CRATES and THERMAL CAMERA nodes make exploring pay again.

---

## 7. Numbers (the one source of truth)

Units: 2 px = 1 m. 1 km = 2,000 px. 1 tile = 16 px. One game step = 1/60 s.

### 7.1 Enemies

| | Walker | Runner | Brute |
|---|---|---|---|
| HP | 1 | 1 | 8 |
| Speed (px/s) | 11–16 | 32–40 | 8–10 |
| Scrap | 1 | 2 | 10 |
| Damage while holding on to the train | 0.5 HP/s | 0.5 HP/s | 2 HP/s |
| When the engine runs it over | −2 HP, speed ×0.85 | −2 HP, speed ×0.85 | **−10 HP, speed ×0.35** |
| First seen | 0 km | 0.4 km | the Dead Wall at 0.65 km; on the rails from 1.1 km |

Below 7 px/s the engine can't run them over, and they climb onto the nose (as today).

### 7.2 The horde by distance (replaces the horde by time)

D = km from the Depot.

| D | Dead around (target) | Side pack size | Rail crowd every | Rail crowd size | Runners | Brutes |
|---|---|---|---|---|---|---|
| 0 | 110 | 3–7 | 7–10 s | 3–6 | 0% | 0% |
| 0.25 | 140 | 3–7 | 6.6–9.6 s | 3–6 | 0% | 0% |
| 0.5 | 170 | 4–8 | 6.3–9.3 s | 4–7 | 4% | 0% |
| 0.75 | 200 | 4–8 | 5.9–8.9 s | 4–7 | 14% | 0% |
| 1.0 | 230 | 5–9 | 5.5–8.5 s | 5–8 | 24% | 0% |
| 1.25 | 297 | 5–9 | 5.1–8.1 s | 6–9 | 25% | 8% |
| 1.5 | 365 | 7–11 | 4.8–7.8 s | 9–12 | 25% | 11% |
| 2.0 | 400 (the cap) | 10–14 | 4–7 s | 13–16 | 25% | 17% (tune later) |

Other rules:
- **Depot start:** 4 packs of 5–12 dead, and 5 walkers on the rails 110 px ahead: about 40 in all (today: 10 packs). **Run 1 only** (the Ram taste, once ever): 12 walkers stand at the gate instead of 5, so about 46.
- **During a hold, side packs stop.** Only the waves come.
- **At most 400 dead are alive at once** (today's cap). Check the frame rate during the first hold.

### 7.3 Dead Walls

| | Farm Stop wall | Mill Town wall |
|---|---|---|
| Where | 0.65 km (350 m before the station) | 1.65 km |
| Who | 30 walkers + 4 Brutes, all within 12 px of the rail middle, packed in 120 px | 40 walkers + 6 Brutes |
| Warning | At 150 m: `DEAD WALL IN 150 M / BRUTES ON THE TRACK` (with the Ram owned: `SAVE YOUR TURBO RAM!`) | the same |
| Rules | No new rail crowds in the last 150 m. The wall stands still until the train is 110 px away. It comes back on every run that passes it. | the same |
| Without the Ram | The Brutes stop the train, and the dead climb on. That costs 40–60 HP, which is where run 3 ends. A strong shooter can clear it. | |
| With the Ram | `UNSTOPPABLE ×34`, +140 scrap | `UNSTOPPABLE ×46`, +200 scrap (+220 with Scavenger 1) |

**What the test showed:**
- A wall of walkers alone is shredded by the 25mm (one round hits 4), so the wall needs Brutes.
- A wreck barricade that fully stopped the train let a good bot farm kills forever. That's why the wall is made of the dead, and the train always creeps on.

### 7.4 Station holds

| | First visit (Farm Stop) | Later visits, and runs that start at the station |
|---|---|---|
| Hold | 40 s | 25 s |
| Survivors | 8: they leave the house at 2 s, then one every 4.5 s (the last at 33.5 s) | 3: they leave at 2, 8 and 14 s (if the house has refilled, see below) |
| Waiting at the station on arrival | 20 walkers | 20 walkers (none for a station start) |
| Where the waves start | deep in the corn, 150–200 px from the rail middle | the near edge of the corn, 120–140 px (the grid ends at 112 px, so no one starts on a tile) |
| Wave 1 | 0 s, WEST lanes: 35 walkers | 0 s, WEST: 30 walkers |
| Wave 2 | 10 s, EAST lanes: 39 walkers + 6 runners | 6 s, EAST: 32 walkers + 6 runners |
| Wave 3 | 20 s, all 4 lanes: 52 walkers + 8 runners + **1 Brute** (from 140 px east) | 11 s, all lanes: 42 walkers + 8 runners + 1 Brute (from 120 px east) |
| Time to reach the train | walkers 9–17 s, runners 4–6 s, the Brute 13–16 s. Wave 3 is in by 37 s. | walkers 7–12 s, runners 3–4 s, the Brute 11–14 s. Wave 3 is in by 25 s. |
| Total | 141 in the waves (161 with the waiting crowd) | 119 |
| Rewards | +50 scrap, +1 survivor per survivor aboard, PERFECT HOLD (no survivor lost) +1 survivor | +25, +1 per survivor, PERFECT +1 |

**The refill rule (it stops a survivor farm):** after each run in which the train rides **0.5 km or more**, every station house you have reached refills to 3 survivors. Survivors who never left the house stay, and the refill tops them up to 3. Runs 4 and 5 rode 1.30 and 0.65 km, so runs 5 and 6 both find 3 survivors. A "start, hold, quit" loop finds the house empty. The hold still runs (your towers fight, +25 scrap), but it pays no survivors and no PERFECT.

Other rules:
- **On stopping, the crew repairs the train +20 HP.**
- A survivor waits while the dead are within 34 px of the door, for at most 3 s (today 8).
- A grabbed survivor dies after 1.4 s unless you kill the zombie (as today). A 105mm shell kills survivors too (as today).
- The train leaves when the hold time is over **and** no survivor is still running or grabbed (at most 8 s more).
- The dead walk to the train in rows 1 and 7.

### 7.5 The train

| | Value |
|---|---|
| HP | 80, +20 per ARMOR level (max 180) |
| Speed | 26 px/s (13 m/s, as today). Every run starts at this speed. 1 km takes 77 s at full speed. |
| Speeding back up | +7 px/s each second (as today) |
| Braking | 10 px/s² (as today) |
| Turbo Ram | 80 px/s for 4 s (4.1) |
| Station repair | +20 HP at each stop |
| Cars | Engine, coach (survivors board here), flatcar (gun), boxcar, tanker. 156 px in all. |

### 7.6 The heli and its guns

| | Value |
|---|---|
| Fly speed | 170 px/s, accel 3.2 (as today). No heli HP: the risk is always the train. |
| Flying range | 300 px, +60 per RADIO RANGE level (max 600) |
| Pickup radius | 14 px, +10 per MAGNET level (max 44) |
| 25mm | 12 rounds/s (+2 per FAST FEED level), 1 damage (+1 per HEAVY ROUNDS level). Burst 7 px, up to 4 zombies per round, flight 0.45 s, lock-on 16 px (as today). |
| 25mm heat | 0.025 per round, cools 0.55/s (×0.25 while firing). It locks until the heat is under 0.35. COOLING multiplies the heat per round by ×0.8 per level, and the levels stack (×0.8 / ×0.64 / ×0.51). **Time to overheat when you hold fire: 6 s, then 10 s / 18 s / 62 s at COOLING 1 / 2 / 3.** FAST FEED lowers the heat per round to match, so the heat per second stays the same. |
| 105mm * | Reload 2.4 s (−0.3 per FAST RELOAD level), flight 1.1 s. Kills everything within 34 px; 4 damage out to 56 px. Within 28 px of the train it hurts the train for 3–17 HP (as today). |

### 7.7 The train gun and the towers

| | Rounds/s | Damage | Hits per round | Range | Shoots first at |
|---|---|---|---|---|---|
| FLATCAR GUN * | 3 (+1 per GUN SPEED, max 6) | 1 | 1 | 112 px around the flatcar (7 tiles across, 5 along) | the dead on the train, then on the rails ahead, then the nearest |
| MG NEST | 4 (+1 per NEST SPEED, max 7) | 1 | 2 (5 px) | 96 px (6 tiles across, 4 along) | the dead holding a survivor, then on the train, then on the rails, then the nearest |
| SANDBAGS | — | — | — | 1 tile (blocker r 11) | They block. The dead climb over after 3 s of pushing (it takes 1 s). |
| BARBED WIRE | — | — | — | 1 tile | The dead walk at 40% speed. |

### 7.8 Turbo Ram (copy of 4.1)

| Key | Charge | Time | Speed | Kill zone | Pay | Can't start | Ends early |
|---|---|---|---|---|---|---|---|
| E | starts full; 200 kills (Ram kills don't count); about 27–47 s of play | 4 s, then 1 s easing down | 80 px/s | ±16 px from the rail middle, 10 px behind to 8 px ahead of the nose; Brutes too | 2× scrap | braking or stopped at a station, or the next stop within 250 m | the next stop within 200 m (`BRAKES!`) |

### 7.9 Loot and bonuses

| Source | Pays |
|---|---|
| Kills | walker 1, runner 2, Brute 10. SCAVENGER +10% per level. |
| Ram kills | 2× |
| Streaks (every kill counts, towers too) | ×10: +2, ×25: +5, ×50: +10, ×100: +20, ×200: +40. A full streak pays 77. |
| Distance | +1 per 20 m traveled in this run (5 per 100 m), rounded down |
| Station held | +50 the first time, +25 after that |
| Survivors | +1 for each one aboard; PERFECT HOLD +1 |
| Scrap pile | 15 (30 past Farm Stop) |
| Supply crate | 50 (100 past Farm Stop); only once you own the Flatcar Gun |
| Golden crate | 150, once |
| SOS survivor | +1 survivor, once |

### 7.10 Node costs

| Node | Lv 1 | Lv 2 | Lv 3 | Lv 4 | Lv 5 |
|---|---|---|---|---|---|
| ARMOR | 40 | 80 | 160 | 320 | 640 |
| FLATCAR GUN * | 300 | | | | |
| GUN SPEED | 150 | 300 | 600 | | |
| TURBO RAM * | 500 | | | | |
| COOLING | 40 | 80 | 160 | | |
| FAST FEED | 60 | 120 | 240 | 480 | 960 |
| HEAVY ROUNDS | 200 | 400 | 800 | | |
| 105MM * | 5 survivors | | | | |
| FAST RELOAD | 150 | 300 | 600 | | |
| RADIO RANGE | 40 | 80 | 160 | 320 | 640 |
| MAGNET | 40 | 80 | 160 | | |
| SCAVENGER | 150 | 300 | 600 | 1200 | 2400 |
| WINCH * | 5 survivors | | | | |
| FARM STOP | free (hold Farm Stop) | | | | |
| NEST SPEED | 150 | 300 | 600 | | |
| BARBED WIRE | 100 | | | | |
| MORTAR PIT * | 8 survivors (after minute 10) | | | | |

Nodes that open after minute 10 grow ×2.5 per level (1.1).

### 7.11 Tower costs (each station counts on its own)

| | 1st | 2nd | 3rd | 4th | after that |
|---|---|---|---|---|---|
| MG NEST | free (kit) | 150 | 300 | 600 | max 4 in the demo |
| SANDBAGS | 6 free (kit) | 10 | 10 | 10 | 10 each, max 24 |
| BARBED WIRE | 15 | 15 | 15 | 15 | 15 each, max 12 (needs the node) |

Selling always gives back what you paid.

### 7.12 Test runs (the autopilot playing like a new player, 12 runs per row)

| Setup (as in the plan) | Bot median distance | Bot kills (average) | Planned distance | Planned kills |
|---|---|---|---|---|
| Run 1: 80 HP, Ram taste | 0.60 km | 270 | 0.48 km | 180 |
| Run 2: 100 HP, Cooling 1, Fast Feed 1 | 0.58 km | 324 | 0.60 km | 215 |
| Run 3: + Flatcar Gun | 0.64 km (most ended at the wall) | 442 | 0.66 km | 310 |
| Run 4: 140 HP, Turbo Ram, free kit | 1.41 km (12 of 12 held Farm Stop, 8 of 8 saved, 2.1 Rams) | 1,307 | 1.30 km | 875 |
| Run 4, weaker bot | 1.37 km (7 of 12 reached Farm Stop) | 989 | — | — |
| Run 5: 160 HP, from Farm Stop, 105mm, 2 nests | 1.84 km (4 of 12 passed 2.0 km) | 881 | 1.62 km | 600 |

Runs 2 and 3 plan the same distance as the bot, because both end at the same fixed wall area.

**What the test taught me:**
- Without the Ram, runs end at the wall (about 0.6–0.7 km). The Ram is worth about +0.5 km in run 4.
- The 105mm is worth about +0.3 km past 1 km. Runs that start at Farm Stop go far: **if testers reach Mill Town in run 5, raise the "past 1 km" numbers in 7.2 first.**
- The Ram's speed lets the train outrun the dead who gather around it. That is why it feels so strong.
- The nests got 30–95 kills per hold, against the heli's 400–900 per run. That's why they got 4 rounds/s and 2 hits per round. Check in play tests that towers feel useful.
- The test ran later holds with the old wave start (150–200 px) and the old 300 m "can't start" Ram rule. Run setup 5 again after these two changes.


---

## 8. Economy check, run by run

| Run | Clock | Start to end | Length | Kills | Kill scrap | Streaks | Distance | Station | Loot | **Earned** | Bank | Bought | Spent | **Left** | Survivors (got, then after buying) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | 0:10–0:52 | Depot to 0.48 km | 42 s | 180 | 195 | 37 | 24 | 0 | 15 | **271** | 271 | Armor 1, Cooling 1, Fast Feed 1, Radio 1 | 180 | **91** | 0, 0 |
| 2 | 1:11–2:01 | Depot to 0.60 km | 50 s | 215 | 221 | 37 | 30 | 0 | 45 | **333** | 424 | Flatcar Gun *, Radio 2 | 380 | **44** | 0, 0 |
| 3 | 2:20–3:22 | Depot to 0.66 km (wall) | 62 s | 310 | 360 | 77 | 33 | 0 | 230 | **700** | 744 | Turbo Ram *, Armor 2, Armor 3 | 740 | **4** | 0, 0 |
| 4 | 3:42–5:58 | Depot to Farm Stop to 1.30 km | 136 s | 875 | 1,109 | 114 | 65 | 50 | 110 | **1,448** | 1,452 | 105mm * (5 surv.), Armor 4, Cooling 2, Fast Feed 2, Gun Speed 1, Magnet 1, Nest Speed 1, Barbed Wire, Scavenger 1; grid: Nest #2, 4 wire | 1,320 | **132** | +7, then 2 |
| 5 | 6:52–8:12 | Farm Stop to 1.62 km | 80 s | 600 | 1,008 | 77 | 32 | 25 | 130 | **1,272** | 1,404 | Winch * (5 surv.), Gun Speed 2, Heavy Rounds 1, Fast Reload 1, Radio 3, Magnet 2; grid: Nest #3 | 1,190 | **214** | +4, then 1 |
| 6 | 8:38– | Farm Stop, about 1.77 km at 10:00 | — | — | — | — | — | — | +1 survivor | — | 214 | — | — | — | +5, so 6 at 10:00 |

**How the kill scrap adds up:**
- **Run 1:** 180 kills + 3 runners (+1 each) + 12 taste-Ram kills paid double (+12) = 195.
- **Run 2:** 209 walkers + 6 runners (12) = 221.
- **Run 3:** 292 walkers + 14 runners (28) + 4 Brutes (40) = 360.
- **Run 4:** 788 walkers + 81 runners (162) + 6 Brutes (60) = 1,010. Add the Ram bonus of 99: the wall's 30 walkers and 4 Brutes = 70, and the second Ram's 11 walkers, 4 runners and 1 Brute = 29. Total 1,109.
- **Run 5:** 435 walkers + 150 runners (300) + 15 Brutes (150) = 885. Add the Ram bonus of 31 (13 walkers, 4 runners and 1 Brute) = 916. Then ×1.1 for Scavenger = 1,008.

**Totals:** earned 4,024 and spent 3,810, so 214 is left. That matches the last row.

**What the table shows:**
- **Runs 1–4 each pay more than the one before.** Run 5 pays a bit less in total than run 4 (it has no big first hold and no wall smash), but it pays the most per minute: 387, 400, 677, 639 and 954 scrap per minute of play. Run 4 is lower per minute than run 3 because of the 40 s hold, but it is the biggest jackpot.
- **The first three runs are tight.** Each break buys 2–4 things, and every ★ needs most of a run: the Flatcar Gun needs runs 1 + 2, and the Ram needs all of run 3. "4 left" after run 3 feels like a real choice.
- **The first station pays for a shopping spree.** That's on purpose: it is the reward. After that, prices climb again (Armor 5 640, Gun Speed 3 600, Mortar Pit 8 survivors).
- **At 10:00 there is something to save for** (Armor 5) and a survivor goal (Mortar Pit, 8; the player has 6). That's the "one more run" pull.
- **Survivors:** 7 + 4 + 5 = 16 earned by 10:00, and 10 spent on two ★ nodes. Each ★ feels earned.
- **If real players earn 30% less,** each ★ comes about one run later. The order of the unlocks stays the same.

---

## 9. Tutorial prompts, in order

**Where things show:**
- **Tasks:** a box at the top left (y 24), with up to 3 lines. Each line has a 5×5 box that fills green when the task is done. Done lines fade after 1 s (Shelldiver style). The streak counter moves below the box.
- **Radio:** a small box above the weapon cards, with the speaker's name in gold. It shows for 4 s.
- **Tip:** one gold line at the bottom center, with a blinking arrow toward the thing it means. It shows for 4 s.
- **Banner:** the big banner across the screen (as today).
- **Tag:** a label with an arrow, inside the panels.

Each channel (task box, radio, tip, banner, tag) shows one prompt at a time. The task box is the exception: it holds up to 3 lines. The rest wait in a queue. Each prompt shows **once per save**. Every text uses only signs the font has.

| # | When | Where | Text | Gone when |
|---|---|---|---|---|
| 1 | The tree opens for the first time | tag on LAST TRAIN | `CLICK THE TRAIN. IT'S FREE.` | it is bought |
| 2 | Root bought | tag (START RUN pulses) | `PRESS START RUN.` | the run starts |
| 3 | Run 1, at the gate | radio | `ENGINEER: DEAD ON THE TRACK! FULL STEAM!` | 4 s |
| 4 | The taste Ram ends | radio | `ENGINEER: THE BOILER CRACKED! FIX IT IN THE SKILL TREE.` | 4 s |
| 5 | Right after | tasks (2 lines) | `WASD: FLY` / `HOLD LEFT CLICK: SHOOT (0/10)` | flown 120 px / 10 kills |
| 6 | First crowd on the rails in view | task | `SHOOT THE DEAD ON THE TRACK (0/5)` | 5 such kills |
| 7 | First overheat | tip | `TOO HOT! LET GO FOR A SECOND.` | 4 s |
| 8 | Summary 1 | summary | `YOU KEEP ALL YOUR SCRAP.` | — |
| 9 | Tree after run 1 | tag on ARMOR | `BUY ARMOR: +20 TRAIN HP. THEN PRESS START RUN.` | the run starts |
| 10 | First climber, from run 2 | task | `SHOOT THE DEAD OFF THE TRAIN` | one climber killed |
| 11 | Run 2, 11 s in | task | `GRAB 3 SCRAP PILES (0/3)` | 3 piles taken |
| 12 | Golden crate out of reach | banner | `GOLDEN CRATE / TOO FAR. BUY RADIO RANGE.` | — |
| 13 | First runner in view, from run 2 | banner | `RUNNERS / FAST, BUT ONLY 1 HP` | — |
| 14 | 150 m before a Dead Wall | banner | `DEAD WALL IN 150 M / BRUTES ON THE TRACK` (with the Ram owned: `/ SAVE YOUR TURBO RAM!`) | — |
| 15 | First pass of 0.55 km | radio | `FARM STOP: WE SEE YOUR SMOKE! 8 OF US ARE WAITING.` | 4 s |
| 16 | First time a * node is affordable | hint bar | `* NODES ARE BIG UNLOCKS.` | it is bought |
| 17 | First run with the Flatcar Gun | tip | `YOUR FLATCAR GUN GUARDS THE TRAIN. GO EXPLORE!` | 4 s |
| 18 | First supply crate on the radar | task | `GRAB THE SUPPLY CRATE` | it is taken |
| 19 | First Brute in view | red label + tip | `BRUTE!` / `BRUTES HAVE 8 HP. THE TRAIN CAN'T PUSH THEM.` | 4 s |
| 20 | Summary after a wall stop | summary | `THE DEAD WALL STOPPED YOU. TURBO RAM SMASHES THROUGH IT.` | — |
| 21 | Ram bought | hint bar | `E: TURBO RAM. SAVE IT FOR THE DEAD WALL.` | the run starts |
| 22 | First time 150 px before a wall with a full Ram | center, big (slow motion) | `PRESS E!` | E pressed or 3 s |
| 23 | 260 px before a station | banner | `FARM STOP AHEAD / YOUR TOWERS ARE READY` | — |
| 24 | The train stops | banner + tip | `HOLD THE STATION / 40 SECONDS. SAVE THE SURVIVORS.` + `YOUR MG NEST SHOOTS BY ITSELF.` | — |
| 25 | Each wave | banner + red edge arrows | `WAVE 1  < WEST` / `WAVE 2  EAST >` / `WAVE 3  < BOTH >` | — |
| 26 | First survivor grabbed | tip (+ the existing `HELP!`) | `SHOOT THE ZOMBIE TO SAVE THEM.` | 4 s |
| 27 | Summary 4 | summary | `NEW: SURVIVORS. THEY BUY THE BIGGEST * NODES.` / `FARM STOP IS YOURS. SEE THE STATION TAB.` | — |
| 28 | Tree after run 4 | tag on 105MM | `BUY THE 105MM WITH 5 SURVIVORS.` | it is bought |
| 29 | Station panel, first time (3 steps) | panel tag | `THIS IS FARM STOP. YOUR TOWERS WAIT HERE.` then `WAVE 2 CAME FROM THE EAST. PUT A NEW MG NEST THERE.` then `DRAG TO MOVE. RIGHT CLICK: SELL (FULL REFUND).` | each step done |
| 30 | Start picker, first time | hint bar | `START AT FARM STOP: YOUR TOWERS FIGHT FIRST.` | the picker is used |
| 31 | First rail crowd with the 105mm owned | task | `RIGHT CLICK: 105MM` | one shell fired |
| 32 | First Brute on the rails | tip | `BRUTE ON THE TRACK! USE THE 105MM OR THE RAM.` | 4 s |
| 33 | SOS in view, no Winch | tip | `A SURVIVOR! YOU NEED THE WINCH.` | 4 s |
| 34 | First pass of 1.5 km | radio | `MILL TOWN: 10 OF US HERE. PLEASE HURRY!` | 4 s |
| 35 | Tree after run 5 | tag on WINCH | `WINCH: SAVE SURVIVORS IN THE FIELD.` | it is bought |
| 36 | Heli near the SOS, Winch owned | tip | `HOVER OVER THEM TO LIFT THEM UP.` | lifted |

The locked STATION tab's hint (`HOLD FARM STOP ONCE TO BUILD HERE.`) is not in this list. It shows every time you hover the locked tab, not once.

These messages already exist and stay as they are: `TRAIN IN DANGER`, `CHECK FIRE!`, `DANGER CLOSE`, `STAY WITH THE TRAIN (F)`, `HELP!`, `SURVIVOR DOWN`, `NEW BEST`, `MULTI KILL ×N`, `STREAK ×N`. These are new, but they are rewards, not lessons: the Ram rank banners, `STATION HELD!`, `PERFECT HOLD! +1 SURVIVOR` and `UNSTOPPABLE ×N`.

