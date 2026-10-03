# Sky Reaper: Demo Design (draft 1)

> **OUTDATED.** The current design is [FINAL_DESIGN.md](FINAL_DESIGN.md). This file is kept only as history.

Goal: a demo that takes 30 to 45 minutes. The full game comes later and takes 4 to 6 hours.

> **Update:** the first 10 minutes are designed in detail in [FIRST_10_MIN.md](FIRST_10_MIN.md). Its section 1 lists what it changes here (the two panels, the Turbo Ram, the Dead Walls, new numbers and pacing).

## What I learned from the 4 games
- **Short runs, and every run pays.** Even a bad run gives you money. (Bills Must Be Paid, Shelldiver)
- **One big skill tree that you watch grow.** (All 4 games)
- **First you do it by hand, then you buy helpers that do it for you.** (Shelldiver's starfish and robots, Zero Stress King's auto buildings)
- **Something new every ~5 minutes, not just "+10%".** Players' main complaint about Zero Stress King is too many flat upgrades.
- **Rare shiny enemies and chain explosions make the big moments.** (Silver orcs, golden jellyfish, explosive orcs)
- **Losing is soft. You never lose your money.** (Zero Stress King can't be lost at all.)

## Your ideas and my decisions
| Your idea | Decision |
|---|---|
| The heli helps the train, so it's not 100% idle | Yes. The heli is the active part. |
| The train gets weapons | Yes. The train guns are the idle part. They let you leave the train. |
| The station is a tower defense stop | Yes, but short: about 40 seconds. |
| The station already has things | Yes. Towers you buy in the tree are already built when you arrive. |
| Many panels (skill tree, station...) | **Changed:** one skill tree with 4 branches. It's simpler, and all 4 games do it this way. |
| Reward the player for flying left and right | Yes. Loot is off the track, and the further away, the better the loot. |

## The loop
1. Pick a start: the Depot, or any station you've already reached.
2. Ride. Zombies attack. You shoot from the heli, and the train guns shoot on their own.
3. Fly left or right to grab loot. While you're away, only the train guns protect the train.
4. At a station, **hold the station** for about 40 seconds: your towers, the train guns and you against waves. Survivors board the train.
5. Ride on to the next station.
6. The run ends when the train breaks, or when you choose "Back to Depot". **You keep all your loot.**
7. Spend the loot in the skill tree. Go again and get further.

A run lasts about 1 minute at the start and 6 to 8 minutes at the end.

## Money
- **Scrap:** from kills and crates. Buys most nodes.
- **Survivors:** from stations and from rescues in the field. Buys the big unlock nodes (new weapons and buildings).

## The track (demo region: the Farmlands)
| Distance | Place |
|---|---|
| 0 km | Depot (the start and your home) |
| 1 km | Station 1: Farm Stop |
| 2 km | Station 2: Mill Town |
| 3 km | Station 3: Quarry |
| 4 km | Safe Zone. Boss: the Wall Breaker. Beat it to complete the demo. |

- Zombies get stronger the further you go.
- The first visit to each station gives 8, 10 or 12 survivors. Later visits give 3.

## Exploring (left and right)
- **Loot:** scrap piles (small), supply crates (big) and golden crates (rare, huge).
- **Stranded survivors:** need the Winch. Hover over them for 1.5 seconds to pick them up.
- **Hidden caches:** you can only see them with the Thermal Camera.
- The further from the track, the more and better the loot.
- Fly over loot to grab it. Radio Range limits how far you can fly.
- **The catch:** the train is alone while you explore.

## Enemies
| Enemy | Notes |
|---|---|
| Walker | Basic. |
| Runner | Fast. Appears from 0.5 km. |
| Brute | Tanky, and slows the train. Appears from 1.5 km. |
| Bomber (new) | Explodes when it dies, so you get chain reactions. If it blows up on the train, it hurts the train. Appears from 2 km. |
| Golden Zombie (new) | Rare. Runs away, and drops 20× scrap. Needs its node. |
| Wall Breaker (boss) | A giant at the Safe Zone gate. |

## Skill tree (~32 nodes)
The start node is free, and it opens 4 branches. ★ marks a big unlock that costs survivors. "lv" is the number of levels you can buy.

**HELI: your power**
- Heavy Rounds: more 25mm damage (5 lv)
- Fast Feed: faster fire rate (5 lv)
- Cooling: overheats more slowly (3 lv)
- ★ 105mm Cannon: becomes an unlock instead of a starting weapon
- Big Shells: bigger 105mm blast (3 lv)
- Fast Reload: faster 105mm reload (3 lv)
- ★ Thermal Camera: shows hidden caches. This gives the existing thermal camera a purpose.

**TRAIN: the idle power**
- Armor: more train HP (5 lv)
- Repair Crew: the train heals slowly (3 lv)
- ★ Flatcar Gun: an auto turret. The first big moment, so it's cheap and costs scrap only.
- Turret Damage (3 lv) and Turret Speed (3 lv)
- ★ Plow: the train runs zombies down without slowing
- ★ Zapper: shocks zombies that climb on the train
- Engine: speeds back up faster after hits (3 lv)

**STATION: tower defense**
- MG Nest: 1 free, plus 1 more per level (3 lv)
- Nest Damage (3 lv)
- Barbed Wire: slows zombies near the station
- ★ Mortar Pit: big area damage
- Fast Loading: shorter hold (3 lv)
- Big Platform: +2 survivors per station (2 lv)

**EXPLORE: the reward for flying away**
- Radio Range: fly further from the train (5 lv)
- Magnet: grab loot from further away (3 lv)
- More Crates (3 lv)
- Golden Crates: a chance for golden crates (3 lv)
- ★ Winch: rescue survivors in the field
- Scavenger: more scrap per kill (5 lv)
- ★ Golden Zombies: makes them appear

**Prices:** levels start at 10 scrap, and each level costs about ×1.6 the last. Big unlocks cost 5 to 10 survivors. We tune the numbers in play tests.

## Pacing (target)
| Time | What happens | New thing |
|---|---|---|
| 0–3 min | Runs 1 and 2, with only the 25mm. The train breaks around 0.5 km. | The skill tree |
| 3–8 min | Buy the Flatcar Gun and Armor. Reach Station 1. | The first auto gun and the first station hold |
| 8–15 min | Survivors buy the 105mm and the Winch. Start exploring. | Exploring and rescuing survivors in the field |
| 15–22 min | Reach Station 2. Bombers appear. | Chain explosions and the Mortar Pit |
| 22–32 min | Buy the Thermal Camera, Plow and Zapper. Golden zombies appear. | Hidden caches |
| 32–45 min | Reach Station 3, then the Safe Zone and the boss. | The boss, and the end of the demo |

## End of the demo
- Beating the Wall Breaker shows a "Demo complete" screen with your stats.
- Tease the full game: the next region, a new train car and a new heli weapon.

## Full game (later, 4–6 h)
- 5 regions of about 1 hour each: Farmlands, Forest, Snow Pass, Swamp and City.
- Each region adds new enemies, a new train car, a new station tower and a new heli weapon.
- Maybe a prestige at the end ("New Line": restart with a permanent bonus).

## Build plan (from the current prototype)
- **Keep:** the art, train, heli, zombies, 25mm and 105mm, lock-on, station boarding, radar and effects.
- **Change:** the fixed trip becomes a track with a station every 1 km. The run ends when the train breaks, and you can start from any station you've reached.
- **Add, in this order:**
  1. Saving, the skill tree screen and scrap
  2. The train turret and armor
  3. The station hold and towers
  4. Field loot and the Winch
  5. The Bomber, the Golden Zombie, the boss and the end of the demo
  6. A balance pass
