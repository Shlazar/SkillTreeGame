# Sky Reaper: Final Design

Status: final design, agreed with the owner. Nothing is built yet.
Where we did not decide a detail, I chose one that fits the rest. These details are marked **(proposal)**.
The owner's answers to the last open questions are in **section 12**.

---

## 1. The idea in one paragraph

A train rides north through zombie land, from station to station. You protect it with a helicopter. At first you have one small heli with a small gun and nothing else. One ride from a station to the next is called a **leg**. It takes about one minute and is full of action. Kills give scrap, and scrap makes your units stronger. The survivors you save become the crew for new units: rocket pods, gun cars, a turbo ram, and planes that you call in for airstrikes. The game starts very simple. Step by step it grows into a loud, bright war machine, and you choose the order.

---

## 2. Design rules

| Rule | What it means |
|---|---|
| **Start simple** | At the start the player needs to know only four things: my heli shoots, I can move it, kills give scrap, and scrap buys upgrades. |
| **See the change** | The first level of every node must change what the player SEES. Flat stat nodes are only cheap filler between new things. Stat nodes also get a small visual sign. For example: damage gives a bigger hit flash, range gives a wider ring, and a shorter cooldown makes the clock fill faster. |
| **One new thing at a time** | Each new mechanic comes with one short tip. It appears only after the player has used the previous one. Only one tip shows at a time. |
| **The player picks** | The whole tree is open, like in Orc Problem. You can buy in any order. Big things sit deep in the tree and cost more, so they still come later. The path is your choice. |
| **Automation over clicking** | Most units fight by themselves. The late game should need LESS control, not more. |
| **New tools change play** | Every unlock adds a new behavior, and so does every special. A plain "+%" is never the reward on its own. |

---

## 3. Runs: legs and stations

### 3.1 One run = one leg

- The line has stations. **One run = one leg** = the ride from one station to the next.
- A leg is about **60 seconds** of riding. **An event happens about every 10 seconds** (see 3.2).
- When you reach the next station, the leg is **won** and the next leg unlocks.
- If the train breaks, you **keep all the loot** you collected, and you retry.
- A run always starts at the **furthest station reached**.
- You can **replay old legs, but only for scrap**. They never give survivors.
- The old structure is **gone**: you no longer ride until the train breaks, and runs no longer grow longer.

### 3.2 Leg events (about one every 10 s)

| Event | What happens |
|---|---|
| Rail crowd | A crowd stands on the rails ahead. It slows the train, and zombies climb on. |
| Stream | Zombies pour in from one edge of the screen and flow toward the train. |
| Wave | Zombies come from both sides at once. |
| Scrap pile / crate | Loot on the ground. Fly near it to collect it. |
| Golden zombie | It runs across the screen and escapes if you are slow. It drops gold. |
| Golden crate | Rare. It holds 5 gold. |
| Silver group | A few silver zombies that drop lots of scrap. |
| Dead Wall | A wall of zombies and wrecks on the rails. The train must stop and break it (see 3.4). |
| Rescue | A survivor waves in a field. Hover the heli over him, and the winch lifts him up. |

**Rescue rules (proposal):**
- A survivor you lifted is **yours**, even if the train breaks later in that leg.
- If you miss him, he runs ahead and **waves again in the next leg you ride**. No survivor is ever lost, and replays stay "scrap only".
- Each rescue gives 1 survivor, one time only. It never repeats.

### 3.3 Stations

- Stations are now **simple stops and milestones**. The train pulls in, the reward pops up, and the Depot opens.
- The **station grid panel and the station tower-defense game are removed**.
- **Big station** (every second station): it has a survivor camp and gives **1 survivor** the first time you arrive. In the full game, big stations are rarer (see 10.3).
- **Small station**: it gives **6 gold** the first time you arrive **(proposal: amount)**.

### 3.4 Dead Walls (Turbo Ram is optional)

- A Dead Wall has a health bar. **Every weapon damages it**: the heli, rockets, cars and planes.
- Turbo Ram breaks a wall in **one charge**. That makes the Ram a great choice, but you do not need it.
- The train stops in front of the wall, and zombies swarm the train while you break it.
- The first Dead Wall comes in **leg 5**. A Viper with a few upgrades breaks it in about 8-10 s **(proposal)**.
- Hellfire missiles aim at walls first **(proposal)**.
- A broken wall drops a scrap pile.

### 3.5 Leg stars

Each leg has **3 stars**. Each star gives **3 gold**, one time only **(proposal: amount)**.

| Star | Goal |
|---|---|
| 1 | Reach the station |
| 2 | Arrive with 75% or more train health |
| 3 | Catch the leg's golden zombie (the star counts at the moment you catch it) |

Stars start in **leg 3**, together with golden zombies. Legs 1-2 have no stars, so gold does not appear before leg 3 **(proposal)**. This is a small change to "3 stars per every leg".

### 3.6 Retries and replays: what pays

| Reward | First ride and retries (until the leg is won) | Replay of a won leg |
|---|---|---|
| Scrap | Yes | Yes |
| Gold (golden zombie, golden crates, stars) | Yes, **once** for each item | No. Golden zombies drop 10 scrap and golden crates drop 25 scrap instead **(proposal)** |
| Survivors | Yes | Never |

- **Gold in a leg is paid only once.** If you opened a golden crate and then the train broke, that crate gives scrap on the retry.
- This stops gold farming, so the gold total in 9.2 is a real limit.
- The Depot labels a replay **"Scrap only"**.
- **Replays never earn missed stars** (decided). A retry before you win the leg can still earn them.

---

## 4. Currencies

There are three currencies. They appear **one at a time**. Each counter appears the first time you earn it, with one tip. **The color of a node shows its currency.**

| Currency | Node color | Where it comes from | What it buys | First seen |
|---|---|---|---|---|
| **Scrap** | Blue | Every kill, scrap piles, crates, broken walls | Small leveled upgrades | Leg 1, first kill |
| **Survivors** | Orange | Big stations (first arrival) and rare field rescues with the winch. 1 each, never repeated | **Unlocks**. Every unlock costs exactly 1 survivor | Depot after leg 1, after the first scrap buy |
| **Gold** | Gold | Golden zombies, golden crates, leg stars, small stations (first arrival) | **Special** nodes | Leg 3, first golden zombie |

The survivor loop: **Reach a new big station → get 1 survivor → pick 1 new toy.**

**Gold timing (proposal):** leg 2 ends at Cornfield Halt, a small station, before gold exists. There the player gets a locked **gold chest** (6 gold). It opens when the gold counter appears in leg 3. So the small station still gives gold, and gold still starts in leg 3.

Currency tips (one each, shown once):
- Scrap: "Kills give scrap. Scrap buys upgrades."
- Survivors: "Survivors crew new units. Each new unit costs 1."
- Gold: "Gold buys special nodes."

---

## 5. Controls and control load

| Input | Action |
|---|---|
| Right click on the ground | Move the heli there |
| Right click on a zombie | The heli focuses that zombie until it dies |
| Q, W (later E, R), or click a plane | Start aiming that plane |
| Mouse while aiming | The aim preview follows the mouse. For the A-10, drag to turn the line |
| Left click while aiming | Confirm the strike |
| Right click while aiming | Cancel (the heli does not move) |
| Same plane key twice | The plane strikes the biggest crowd by itself, with no aiming |
| Space | Turbo Ram (only if you own it) |
| Esc | Pause |

- **The most controls you ever need:** the heli (right click), up to 4 plane keys, and Space for the Turbo Ram.
- Cars, heli weapons and all the other gadgets **fight by themselves**.
- Three things keep the control load small:
  1. **Hangar slots.** You can own many planes but bring only some (see 6.2).
  2. **Auto Pilot.** A late gold special for each plane: the plane strikes by itself.
  3. **Smart double-tap.** Press the key twice, and the plane aims for you.
- While you aim, game time slows to 50% **(proposal)**.

---

## 6. Units

**Numbers:** these numbers were agreed: the plane cooldowns, the rocket chances, the 1-survivor price, the Katyusha start (6 rockets every 15 s) and the B-52 start (8 bombs). **All other numbers in sections 6 and 7 are proposals.**

**Every unit starts weak and has its own upgrade line**, Orc Problem style:

**[UNLOCK, 1 survivor] → Damage (scrap) → Speed / reload / cooldown (scrap) → Size / area (scrap) → SPECIAL (gold, a new behavior)**

### 6.1 The heli: VIPER

- This is the start unit. You own it from the beginning. It has a small gun and fights by itself.
- It has **no visible bullet lines**. Instead it shows a big muzzle flash at the nose and a strong hit effect on the target.
- The heli cannot be shot down. Only the train can break **(proposal)**.
- It has a **winch**: hover over a survivor for about 2 s to lift him up.
- **Its line:** Gun Damage → Fire Rate → Gun Range → **ROCKETS** (gold) → Rocket Pods (unlock) → Napalm (special).

**Heli Rockets** (a gold special; it replaces the old Chain Shot):
- Each heli bullet has a chance to become a **rocket**. The rocket explodes and kills zombies in an area.
- The chance for each level: **5% / 8% / 11% / 14% / 18%**. The chance is rolled **for each bullet**.
- **Bad-luck rule:** if 6 s pass with no rocket, the next shot is a rocket.
- **You see it at once:** upgrades are bought in the Depot. So in the first leg after you buy Rockets, the first rocket fires within 3 s of the start.
- A rocket has a short smoke trail and a big blast.

**Heli weapon unlocks** (automatic):

| Unit | Starts as | Line |
|---|---|---|
| **Rocket Pods** | Every 8 s, a salvo of 4 small rockets at the biggest crowd near the heli | Damage → Reload → Salvo size → Special **NAPALM**: the rockets leave burning ground for 3 s |
| **Hellfire** | Every 10 s, 1 guided missile at the toughest target in range (Dead Wall, brute, golden zombie) | Damage → Reload → Blast size → Special **DOUBLE HELLFIRE**: 2 missiles at 2 targets |
| Door Gunner | Full game: a side gunner who sprays nearby zombies | |

### 6.2 Planes

**Planes use cooldowns, not uses.** Every plane starts each leg **ready**.

| Plane | Starts as | Start cooldown | Upgraded floor | Line |
|---|---|---|---|---|
| **A-10** (was the Strafing Run) | 1 thin strafe line | 25 s | 12 s | Damage → Cooldown → Wider line → Special **BOMB RUN**: drops 4 bombs at the end of its run |
| **F-4** | A napalm fire line (burns 4 s) | 30 s | 15 s | Damage → Cooldown → Longer fire → Special **FIRE WALL**: the fire burns 12 s, and zombies do not walk through it |
| **B-52** | 8 small bombs in a long lane | 45 s | 25 s | More bombs → Cooldown → Bigger bombs → Special **FIRE BOMBS**: the bombs burn the ground |
| **B-2** (full game; a gift in the demo) | One big blast in a small circle | 60 s | 40 s | Damage → Cooldown → Bigger circle (up to the full screen) → Special **SECOND PASS**: it strikes again |
| AC-130 (full game) | See below | 60 s | 40 s | |

- **+1 Charge** (gold): the plane can hold 2 strikes.
- **Auto Pilot** (a late gold special, full game): when the plane is ready, it strikes the best spot by itself.

**How ready planes are shown**
- The planes have their own thin band, about 18 px tall, **below the play area**. The world view ends above it, so the band never covers zombies or the train.
- Ready planes fly a slow loop in this band. They are small, and each one shows its key letter (Q, W, E, R) in its own spot.
- With 2 charges, a plane shows a small "2". After one strike it stays in the band with a "1", and a tiny clock fills for the used charge. It leaves the band only when both charges are used.

**How you call a strike**
1. Click the plane or press its key.
2. An aim preview follows the mouse on the ground. The A-10 shows a line (drag to turn it). The F-4 shows a fire line. The B-52 shows a long lane of bombs. The B-2 shows a big circle.
3. Left click to confirm, right click to cancel. If you press the key twice, the plane strikes the biggest crowd with no aiming.

**What the strike looks like**
1. A red marker blinks on the ground.
2. The plane's shadow races in from the edge of the screen.
3. The plane roars over, high above everything. It is bigger than the heli and leaves jet trails.
4. It hits along its path and leaves on the other side. Planes cannot be hit.

**After the strike:** the plane's spot shows only a tiny dim icon with a filling clock. When the plane is ready, it swooshes back in from below, with a sound.

**AC-130 (the exception, full game):** it stays for **15 s**, circles the chosen point and fires its 40mm gun and the old 105mm gun, which moves onto this plane. You can select it and move its circle.

**Hangar slots**
- You start with 2 slots (Q, W). In the full game you can buy up to 4 (Q, W, E, R) in the tree.
- Before each leg, you pick the planes for the slots in the Depot.
- Until you own more planes than slots, your planes fill the slots by themselves.

### 6.3 Train cars (automatic)

| Car | Starts as | Line |
|---|---|---|
| **MG Car** | 1 slow turret, short range | Damage → Fire rate → Range → **+1 Turret** (up to 3) → Special **AP ROUNDS** (armor-piercing: each bullet goes through up to 3 zombies) |
| **Katyusha Car** | 6 rockets every 15 s at the biggest crowd ahead | More rockets → Faster reload → Blast size → Special **CLUSTER ROCKETS**: each rocket splits into 3 small bombs |
| Rail Cannon, Mortar, Flame, Hangar (drones) | Full game (see 10.2) | |

### 6.4 Train gadgets (small but fun, mostly automatic)

| Gadget | What it does | Line |
|---|---|---|
| **TURBO RAM** (Space; the only gadget with a key) | The train charges for 2 s and smashes everything on the rails. It breaks a Dead Wall in one hit. Cooldown 20 s | Ram power → Cooldown (down to 12 s) → Longer, wider charge → Special **SHOCKWAVE**: a ring blast at the end of the charge |
| **STEAM VENT** | Every 5 s, hot steam blasts zombies that climb on the train | Steam damage → Vent speed (down to 2.5 s) → Steam reach (it also hits zombies next to the train) → Special **HOT CLOUD**: the steam stays 2 s and hurts every zombie that walks in |
| Cow Catcher | Full game: walkers fly aside and do not slow the train | |
| Mine Layer | Full game: the last car drops mines | |
| Repair Crew | Full game: the train slowly repairs | |
| Shock Horn | Full game: blows zombies back when the train is surrounded | |

---

## 7. The skill tree

### 7.1 Look and rules

The current screen style stays:
- Dark background, glowing nodes and lines, pan and zoom.
- Levels are shown under the nodes, like `3/10`.
- The tooltip shows the name, the level, one short sentence, **NOW > NEXT** numbers, and the price with its currency icon.

The content is rebuilt from zero:
- **Free picking.** You can see the nodes next to the nodes you own, and you can buy any node you can see.
- **Colors.** Blue = scrap, orange = survivors, gold = gold. Grey with a lock = **FULL GAME** tease.
- **At the very start** you see only the root and 4 cheap nodes (marked ★start).
- Orange nodes appear when the survivor counter appears. Gold nodes appear when gold appears.

### 7.2 Layout

- **Center:** VIPER (the root).
- **North:** HELI.
- **East:** TRAIN. Cars go up and to the right, gadgets go down and to the right.
- **South:** AIR.
- **West:** SALVAGE.

The nodes of each unit form a short chain: unlock → damage → speed → area → special.

### 7.3 Scrap cost tracks

Each level costs about ×1.5 the level before (×1.6 on track F).

| Track | Level costs (scrap) |
|---|---|
| A | 15 · 23 · 34 · 51 · 76 · 114 · 171 · 256 |
| B | 20 · 30 · 45 · 68 · 101 · 152 |
| C | 25 · 38 · 56 · 84 · 127 |
| D | 30 · 45 · 68 · 101 · 152 |
| E | 40 · 60 · 90 · 135 |
| F | 40 · 64 · 102 · 164 |

"C, 4 levels" means the node costs the first 4 numbers of track C. Every first level costs 15-40 scrap.

### 7.4 Every demo node

**HELI (north)**

| Node | Cost | Levels | Effect per level | Sits next to |
|---|---|---|---|---|
| VIPER | owned | – | Small gun, about 4 shots/s. A walker dies in 2 hits | root |
| Gun Damage | Scrap A | 8 | +20% damage (bigger hit flash) | root ★start |
| Fire Rate | Scrap B | 6 | +12% shots per second | root ★start |
| Gun Range | Scrap C | 4 | +15% range (wider ring) | Fire Rate |
| ROCKETS | Gold 4·6·8·10·12 | 5 | 5 > 8 > 11 > 14 > 18% rocket chance | Gun Range |
| **ROCKET PODS** | 1 Survivor | – | 4 rockets every 8 s | Rockets |
| Pod Damage | Scrap C | 4 | +25% | Rocket Pods |
| Pod Reload | Scrap C | 4 | 8 > 7 > 6 > 5.5 > 5 s | Pod Damage |
| Pod Salvo | Scrap E | 3 | +1 rocket (up to 7) | Pod Reload |
| NAPALM | Gold 12 | 1 | Pod rockets burn the ground for 3 s | Pod Salvo |
| **HELLFIRE** | 1 Survivor | – | 1 missile every 10 s at the toughest target | Gun Range |
| Hellfire Damage | Scrap C | 4 | +30% | Hellfire |
| Hellfire Reload | Scrap C | 4 | 10 > 9 > 8 > 7 > 6 s | Hellfire Damage |
| Hellfire Blast | Scrap E | 3 | +20% blast size | Hellfire Reload |
| DOUBLE HELLFIRE | Gold 12 | 1 | Fires 2 missiles at 2 targets | Hellfire Blast |
| Door Gunner / Apache | FULL GAME | | Tease | Gun Range / Rocket Pods |

**TRAIN (east)**

| Node | Cost | Levels | Effect per level | Sits next to |
|---|---|---|---|---|
| Train Armor | Scrap A | 6 | +15% train health (armor plates appear on the engine) | root ★start |
| **MG CAR** | 1 Survivor | – | 1 slow turret, 2 shots/s | Train Armor |
| MG Damage | Scrap B | 5 | +25% | MG Car |
| MG Fire Rate | Scrap B | 5 | +15% | MG Damage |
| MG Range | Scrap C | 3 | +15% | MG Fire Rate |
| +1 Turret | Scrap 40 · 100 | 2 | 1 > 2 > 3 turrets | MG Range |
| AP ROUNDS | Gold 12 | 1 | Bullets go through up to 3 zombies | +1 Turret |
| **KATYUSHA CAR** | 1 Survivor | – | 6 rockets every 15 s | MG Fire Rate |
| More Rockets | Scrap D | 4 | +2 rockets (up to 14) | Katyusha |
| Katyusha Reload | Scrap D | 4 | 15 > 13.5 > 12 > 10.5 > 9 s | More Rockets |
| Katyusha Blast | Scrap E | 3 | +20% blast size | Katyusha Reload |
| CLUSTER ROCKETS | Gold 15 | 1 | Each rocket splits into 3 small bombs | Katyusha Blast |
| **TURBO RAM** | 1 Survivor | – | Space: a 2 s charge, cooldown 20 s | Train Armor |
| Ram Power | Scrap C | 4 | +30% smash damage | Turbo Ram |
| Ram Cooldown | Scrap C | 4 | 20 > 18 > 16 > 14 > 12 s | Ram Power |
| Long Charge | Scrap E | 3 | 2 > 2.5 > 3 > 3.5 s, wider smash | Ram Cooldown |
| SHOCKWAVE | Gold 10 | 1 | A ring blast when the charge ends | Long Charge |
| **STEAM VENT** | 1 Survivor | – | Steam every 5 s on climbers | Train Armor |
| Steam Damage | Scrap B | 4 | +25% | Steam Vent |
| Vent Speed | Scrap B | 4 | 5 > 4.4 > 3.8 > 3.2 > 2.5 s | Steam Damage |
| Steam Reach | Scrap D | 3 | The steam also hits zombies next to the train. The cloud grows | Vent Speed |
| HOT CLOUD | Gold 10 | 1 | The steam stays 2 s and hurts every zombie that enters | Steam Reach |
| Rail Cannon Car / Cow Catcher / Mine Layer / Twin MG Car | FULL GAME | | Tease | Katyusha / Turbo Ram / Steam Vent / AP Rounds |

**AIR (south)**

| Node | Cost | Levels | Effect per level | Sits next to |
|---|---|---|---|---|
| **A-10** | 1 Survivor | – | 1 thin strafe line, 25 s cooldown | root |
| A-10 Damage | Scrap C | 4 | +25% | A-10 |
| A-10 Cooldown | Scrap C | 5 | 25 > 22 > 19 > 16 > 14 > 12 s | A-10 Damage |
| Wider Line | Scrap E | 3 | 1 > 2 > 3 > 4 gun lines | A-10 Cooldown |
| BOMB RUN | Gold 12 | 1 | Drops 4 bombs at the end of the run | Wider Line |
| A-10 +1 Charge | Gold 15 | 1 | Holds 2 strikes | A-10 Cooldown |
| **F-4** | 1 Survivor | – | A napalm fire line (burns 4 s), 30 s cooldown | A-10 |
| Fire Damage | Scrap D | 4 | +25% | F-4 |
| F-4 Cooldown | Scrap D | 5 | 30 > 27 > 24 > 21 > 18 > 15 s | Fire Damage |
| Longer Fire | Scrap E | 3 | +20% length, +1 s burn | F-4 Cooldown |
| FIRE WALL | Gold 15 | 1 | The line burns 12 s, and zombies do not cross it | Longer Fire |
| F-4 +1 Charge | Gold 18 | 1 | Holds 2 strikes | F-4 Cooldown |
| **B-52** | 1 Survivor | – | 8 small bombs in a lane, 45 s cooldown | F-4 Cooldown |
| More Bombs | Scrap E | 4 | +2 bombs (up to 16) | B-52 |
| B-52 Cooldown | Scrap E | 4 | 45 > 40 > 35 > 30 > 25 s | More Bombs |
| Bigger Bombs | Scrap F | 3 | +20% blast size | B-52 Cooldown |
| FIRE BOMBS | Gold 15 | 1 | The bombs leave burning ground | Bigger Bombs |
| B-52 +1 Charge | Gold 20 | 1 | Holds 2 strikes | B-52 Cooldown |
| Auto Pilot ×3, Hangar Slot 3 and 4, B-2, AC-130 | FULL GAME | | Tease | the ends of the air lines |

The B-52 needs the A-10 and the F-4 first. So it is survivor #3 at the earliest, and usually later.

**SALVAGE (west)**

| Node | Cost | Levels | Effect per level | Sits next to |
|---|---|---|---|---|
| Scrap Magnet | Scrap A | 5 | +25% loot pickup radius (loot flies to the heli) | root ★start |
| Salvage Crew | Scrap D | 4 | +8% scrap from everything (scrap pops are bigger and shine blue) | Scrap Magnet |
| Silver Hunt | Scrap E | 3 | More silver zombies (they drop lots of scrap). Shown after the first silver zombie (leg 4) | Salvage Crew |
| Boom Hunt | Scrap E | 3 | More explosive zombies (they blow up their friends). Shown after the first explosive zombie (leg 7) | Salvage Crew |
| Gold Hunt | Scrap F | 3 | More golden zombies. Shown once gold exists (leg 3) | Silver Hunt |

★start = visible at the very first Depot visit (the root and 4 cheap nodes).

**Totals:** the demo tree has **9 unlocks, 10 gold specials (Rockets has 5 levels), 3 charges, and 37 scrap nodes**. Maxing all scrap nodes costs about **8,800 scrap**. There are also grey FULL GAME teases.

---

## 8. The demo (30-45 min)

### 8.1 Frame

- One region: **Farmlands**. 12 legs.
- **9 unlocks:** Rocket Pods, Hellfire, MG Car, Katyusha, Turbo Ram, Steam Vent, A-10, F-4, B-52. There are **2 hangar slots**.
- **9 survivors:** 6 big stations and 3 rescues. A good player gets everything. **In the demo, the choice is the ORDER.**
- Zombies: walker, runner and brute, plus golden, silver and explosive variants.
- All 3 currencies exist.

### 8.2 The Depot (between legs)

The Depot opens after every leg, won or lost.

| Part | What it shows |
|---|---|
| Line map (top) | Stations and legs, with the stars you won. Click an old leg to replay it. The label says "Scrap only". |
| **Tree** tab | The skill tree. |
| **Hangar** tab | It appears when you own more planes than slots: "3 planes, 2 slots: pick which to bring." Drag planes into Q and W. |
| **START** button | It says, for example, "Ride to Red Barn". After a loss, a message says, for example: "The train broke. You keep 143 scrap." Then START retries the leg. |

The game starts directly in leg 1, with no Depot before it **(proposal)**.

**First Depot visit (after leg 1):** at first it shows only the scrap nodes. After the player buys the first scrap node, the survivor counter, its tip and the orange nodes appear.

### 8.3 The 12 legs

B = big station (1 survivor the first time). S = small station (6 gold the first time).

| Leg | Ends at | Station reward | Rescue in leg | New this leg | Tip | Likely buy (the player chooses) |
|---|---|---|---|---|---|---|
| 1 | Millbrook (B) | Survivor #1 | – | Walkers. The heli shoots by itself. Scrap | "Right-click to move your heli." Then: "Kills give scrap." At the Depot, after the first buy: the survivor tip | Gun Damage, Fire Rate, Train Armor, Magnet (about 65 scrap). Then the first unlock: the A-10, or (with Train Armor) MG Car, Ram or Steam |
| 2 | Cornfield Halt (S) | Gold chest (6 gold, opens in leg 3) | – | Runners. Bigger rail crowds | – | Damage for the first unit. Gun Range (on the way to Rockets) |
| 3 | Red Barn (B) | Survivor #2 | – | Golden zombie, gold and stars | "Catch the golden zombie!" At the Depot: "Gold buys special nodes." | **Rockets lv1** and the second unlock |
| 4 | Silo Junction (S) | 6 gold | Survivor #3 | First rescue. Silver zombies | "Hover over him to winch him up." | Third unlock. Rockets lv2 |
| 5 | Old Mill (B) | Survivor #4 | – | First **Dead Wall** | "A Dead Wall! Shoot it down." If you own the Ram: "A Dead Wall! Press Space to ram it." | Turbo Ram or Hellfire (both are good against walls) |
| 6 | Pumpkin Halt (S) | 6 gold | – | Brutes. First golden crate | "Right-click a brute to focus it." | A first unit special (for example AP Rounds) |
| 7 | Crossroads (B) | Survivor #5 | – | Explosive zombies | "Explosive zombies blow up their friends." | One unlock, maybe a 3rd plane (this opens the Hangar tab) |
| 8 | Water Tower (S) | 6 gold | Survivor #6 | The first big wave from both sides | – | One unlock. Cooldowns, +1 Charge |
| 9 | Haybale Camp (B) | Survivor #7 | – | Double event: a Dead Wall during a stream | – | A deep unit (B-52 or Katyusha) |
| 10 | Windmill Halt (S) | 6 gold | Survivor #8 | Brute escorts (brutes leading packs of runners) | – | One unlock. Specials and area nodes |
| 11 | Grain Elevator (B) | Survivor #9 | – | The densest horde so far | – | The last unlock |
| 12 | **Farmlands Terminus** | Finale | – | **Finale horde + B-2 gift** | "A B-2 joins you, once! Press E twice to strike." | – |

Survivors arrive after legs 1, 3, 4, 5, 7, 8, 9, 10 and 11, so never 2 at once.

### 8.4 The finale (leg 12)

- This leg is about 90 s long **(proposal)**.
- In the last 30 s, the Terminus gate is closed. The train must **hold** while the finale horde pours in from all sides.
- At the peak, the radio calls: a **B-2** appears in a third slot (**E**) as a **one-time gift**. It makes one huge strike. Then its spot shows "FULL GAME".
- The B-2 gift comes on **every try** of leg 12.
- The gate opens, the train rolls in, and the **"Thanks for playing"** card appears.
- The tree still shows the grey **FULL GAME** nodes as a tease. Replays stay open.

### 8.5 Tips on first use

The player picks unlocks in any order, so these tips come at the first time they are needed, not in a fixed leg. Only one tip shows at a time. If two tips are due together, the second one waits.

| When | Tip |
|---|---|
| First leg with a plane | "Press Q (or click the plane), aim, then left click. Right click cancels." |
| After your 2nd plane strike | "Press Q twice to hit the biggest crowd." |
| First leg with the Turbo Ram | "Press Space to ram!" |
| You own more planes than slots | "Pick which planes to bring." (in the Hangar tab) |
| First +1 Charge | "This plane now holds 2 strikes." |
| MG Car, Katyusha, Steam Vent, Rocket Pods, Hellfire | No tip. They are automatic, and the unit just appears. |

---

## 9. Economy numbers

### 9.1 Scrap and time

| Leg | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Scrap (clean first pass) | 80 | 95 | 115 | 135 | 160 | 190 | 225 | 265 | 310 | 365 | 430 | 500 |

- One clean pass gives about **2,900 scrap**. Retries, replays and the salvage nodes add more, so a typical player earns about **4,000-5,000**.
- Where scrap comes from: about 60% kills, 30% piles and crates, and 10% walls and silver zombies **(proposal)**.
- Scrap per kill: walker 1, runner 1, brute 5, silver 15 **(proposal)**.
- First levels of nodes cost 15-40 scrap. Each level costs about ×1.5.
- **Maxing every demo scrap node costs about 8,800.** The player maxes about half. This is on purpose: you own every unit, so the choice is where to go deep.

**Demo time budget (proposal):**

| Part | Time |
|---|---|
| First pass of riding (11 legs × 60 s + 90 s finale) | about 13 min |
| 12 Depot visits (tree, hangar) | about 10 min |
| About 8-10 retries and scrap replays | about 9-12 min |
| **Total** | **about 32-35 min** (slower players up to 45) |

The scrap total of 4,000-5,000 assumes these 8-10 extra runs.

### 9.2 Gold

Gold is paid once per item (see 3.6), so these numbers are a real limit.

| Source | Amount | Demo total (if perfect) |
|---|---|---|
| Small stations (5, including the leg 2 chest), first arrival | 6 each | 30 |
| Stars (legs 3-12, 30 stars) | 3 each | 90 |
| Golden zombies (about 15) | 1 each | about 15 |
| Golden crates (about 5) | 5 each | about 25 |
| **Total** | | **about 160** (typical: 120-140) |

Gold costs in the demo:
- Rockets: 40 in total.
- 9 unit specials: 113.
- 3 charges: 53.

That is **206 in total**, so a typical player buys about 2/3 of the gold nodes.

### 9.3 Survivors

The demo has 9 survivors for 9 unlocks. Every unlock always costs exactly 1 survivor.

---

## 10. The full release (4-6 h)

### 10.1 Regions

| Region | Legs | New zombies | Boss **(proposal: names)** |
|---|---|---|---|
| Farmlands | 12 (the same as the demo) | walker, runner, brute + golden/silver/explosive | The Harvester (in leg 12, after the finale horde) |
| Forest | 10-12 | crawlers, fast packs | The Lumberjack |
| Snow Pass | 10-12 | armored zombies | The Iceback |
| Swamp | 10-12 | spitters (they hit the train from range) | The Bloater |
| City | 10-12 | giants | The Hive Tower, then the **final boss** |

**Demo progress carries over to the full game (proposal).**

### 10.2 Units (about 20) and evolutions

| Kind | Units |
|---|---|
| Heli weapons (3) | Rocket Pods, Hellfire, Door Gunner |
| Planes (6) | A-10, F-4, B-52, B-2, AC-130 (cooldown 60 s, floor 40 s), Chinook (drops a team of 4 soldiers next to the train who shoot for 20 s; cooldown 50 s, floor 30 s) **(proposal)** |
| Cars (6) | MG, Katyusha, **Rail Cannon** (special: Power Shot), Mortar, Flame, Hangar (launches drones) |
| Gadgets (6) | Turbo Ram, Steam Vent, Cow Catcher, Mine Layer, Repair Crew, Shock Horn |

- That is 21 units. **Drones** come from the Hangar car and use no plane slot **(proposal)**.
- The **Ammo car** becomes an upgrade of the cars, not a unit. **Repair Crew** replaces the repair car idea **(proposal)**.
- **About 10 EVOLUTIONS**, 1 per unit. Each costs 1 survivor and brings a big change in look and power. Examples: Viper → **Apache**, B-52 → **B-52 Heavy**, MG Car → **Twin MG Car**, Katyusha → Grad Battery **(proposal)**, Turbo Ram → Plow Ram **(proposal)**.
- Hangar slots: up to **4** (Q, W, E, R). Slots 3 and 4 cost 40 and 80 gold **(proposal)**.
- Every plane gets **+1 Charge** and **Auto Pilot**.

### 10.3 Survivors in the full game

- The agreed plan is about **4 per region**: 2 big stations with a camp, the region boss, and 1 rescue. That is **about 20 survivors for about 30 unlock things** (21 units + about 10 evolutions). The player gets about 2 of every 3 and must choose real builds.
- Replays never give survivors.
- **Proposal:** Farmlands in the full game stays the same as the demo, with 9 survivors, because it is the teaching region and demo progress carries over. Each later region then gives 3: 2 camps and the boss. Their rescues give gold instead. Total: 9 + 4 × 3 = **21**.
- **Decided:** in the later regions, big stations are rarer (2 per region), and a big station ALWAYS has a survivor camp. "Big station = survivor" stays true everywhere.

### 10.4 Extra modes

- **Endless**: ride as far as you can.
- **Challenges**: fixed loadouts and special rules.
- Maybe **prestige, "New Line"**: restart the line and come back stronger.

---

## 11. What changes from the current build

| Removed | Moved to the full game | Kept |
|---|---|---|
| Station grid panel | Rail Cannon (as a train car with its Power Shot special) | The readable zombie horde with red death splats |
| Station tower-defense game | 105mm (moves onto the AC-130) | Golden, silver and explosive zombies |
| Chain Shot (replaced by Heli Rockets) | Cow Catcher | The clean, bright world style |
| Extra helis (Wingman, Extra Heli) | | Loot: scrap piles, crates, golden crates |
| Station nodes (Farm Stop, Nest Speed, Barbed Wire, Mortar Pit) | | The heli winch (now a survivor source) |
| The old flat-stat tree | | The Depot screen with the tree (new content, same style) |
| Runs that last until the train breaks, and the growing run length | | Heli muzzle flash and hit sparks (no tracers) |

**Changed:**
- The existing Strafing Run plane becomes the **A-10**.
- Runs become **legs** (about 60 s, from station to station).
- The train starts with **no weapons**.
- Planes use **cooldowns**.
- Every new unit costs **1 survivor**.

---

## 12. Owner decisions (answered)

| # | Question | Decision |
|---|---|---|
| 1 | Can a replay earn the stars you missed? | **No.** Replays give scrap only, and missed stars are lost. It keeps the rule simple. A retry before you win the leg can still earn them. |
| 2 | Big stations in the full game? | **Big stations are rarer in later regions (2 per region), and a big station always has a survivor camp.** "Big station = survivor" stays true everywhere. |
