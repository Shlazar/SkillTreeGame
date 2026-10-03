# Sky Reaper: Progression Options

> **OUTDATED.** The current design is [FINAL_DESIGN.md](FINAL_DESIGN.md). This file is kept only as history.

## What I learned from the four games

The current tree is weak because almost every node changes only a number: +HP, +fire rate. You buy it and nothing on screen looks different. Chain shot also looks like magic, not like the military. The reference games work for the opposite reason. In Orc Problem, the big nodes add new things to the battlefield: more gunners, new towers, a Strafing Run plane, a Nuke. Shelldiver makes the cheap first node a chance proc that you see right away. Zero Stress King gets boring because late upgrades are only flat +%. So the rule is: **the first level of every node must change what you see**, and **every leg must give you one new toy**. Flat stat nodes stay as cheap filler between the new things.

One math point on your rocket idea. 5% is the right feel, but if the heli rolls once per burst (every 0.5 s), you get a rocket only once every 10 s. That is too rare in a 60 s leg. Fix it in two ways:
- Roll the 5% per bullet, not per burst.
- Add a "bad-luck" timer: if no rocket fires for 6 s, the next shot is a rocket.

Also, on the first leg after you buy a new proc, force it to fire within 3 s. Then you see it at once.

## Option A: "Hero Gunship + Air Force"
**Fantasy:** You fly one gunship. It grows into a flying armory, and you call the whole air force down on the dead.
- **You control:**
  - One VIPER: right-click to move, it fires by itself.
  - Strikes on keys: Q A-10, W F-4 napalm, E B-52, R B-2.
  - From mid-demo, one extra unit: the AC-130. Call it with F, then right-click to move its circle.
  - Space is still Turbo Ram.
- **Heli path:** free Hydra Rockets at 5%. Then Rocket Pods, which fire pairs and show pods on the sprite. Then Napalm Tips, then Door Gunner (a second gun with a second flash), then Hellfire lock-on for brutes. Late in the demo comes Apache Frame, a new heli sprite.
- **Air force:** all called strikes with charges per leg, except the AC-130.
  - A-10: 1-2 charges.
  - F-4 napalm line: 2 charges.
  - B-52 carpet: 1 charge.
  - B-2 Spirit: 1 charge, the capstone you own from about leg 10.
- **Train cars:** 4 cars in the demo: MG Car, Katyusha Rocket Car, Hangar Car (drones that collect loot), Ammo Car (+1 charge on every strike).
- **First 3 unlocks:** Hydra Rockets (free, leg 1), then MG Car, then the A-10.
- **Big moments:** Door Gunner around leg 5, B-52 around leg 6, AC-130 around leg 8, B-2 around leg 10, and the finale at leg 12.
- **Why it is fun:** your one heli looks and sounds stronger after every buy, and the sky gets busier every leg.
- **Risk:** many blasts at once can hide the zombies. It needs a cap on blasts per frame, and effects drawn under the zombies.

## Option B: "The Armored Train"
**Fantasy:** You command the last armored train. Every station hooks on a new gun car, and the train becomes a fortress on rails.
- **You control:**
  - One VIPER, which handles loot, the winch and rockets.
  - The Rail Cannon, aimed by hand.
  - Only 2 strike keys (A-10, B-52) plus the B-2 in the finale.
- **Heli path:** smaller than in A. Hydra 5%, then Pods, then Hellfire. The heli is mostly the loot and rescue unit.
- **Air force:** strikes only: A-10, B-52, and the B-2 as a late unlock. No AC-130.
- **Train cars, the main path:** up to 6: MG, Mortar, Katyusha, Flame, Hangar (drones), Repair. The tree's car branch is drawn as a rail line, with car-shaped nodes.
- **First 3 unlocks:** Hydra (free), then MG Car, then Mortar Car.
- **Big moments:** the Katyusha salvo around leg 5, the Flame Car around leg 8, and a 7-car train in the leg 12 finale.
- **Why it is fun:** a screenshot from leg 1 next to one from leg 12 tells the whole story.
- **Risks:**
  - You may sit and watch the cars kill.
  - A long train takes up half the screen height.
  - It needs the most car art.

## Option C: "The Air Wing (squadron RTS)"
**Fantasy:** You start as one pilot and end the demo commanding a whole air wing.
- **You control** several units, with a box select and group keys 1/2/3:
  - The Viper, up to 2 wingman Vipers, the Hornet jet (flies loops over a point), the Spectre gunship (circles a point) and auto drones.
  - The A-10, B-52 and B-2 on keys.
- **Heli path:** the same rocket ladder as in A. Every Viper gets your heli upgrades.
- **Air force:** mostly units you place, plus 3 strikes.
- **Train cars:** only 2-3: Gunner Car, Hangar Car (repairs aircraft), Ammo Car.
- **First 3 unlocks:** Hydra (free), then a second Viper, then the A-10.
- **Big moments:** the Hornet around leg 4, the Spectre around leg 8, the B-2 around leg 10.
- **Why it is fun:** real RTS control that grows one piece at a time.
- **Risks:**
  - The hero heli stops feeling special.
  - On a 640x360 screen it becomes a mess.
  - It is the most AI code to write.

## My recommendation
**Option A.** It matches what you said most closely: one main heli, an air force with a B-2 you really own, and a train that grows. The AC-130 answers "something else to control like the heli" without turning the game into a squad RTS. From B, I took the visible train growth, kept at 4 cars. From C, I took the rocket ladder.

**If it is too big:**
- Cut the Hangar Car and the drones first.
- Then cut the Apache Frame.
- Then ship the AC-130 with a simple green tint, not a thermal aim mode.

**Fix that matters for any option:** survivors must come in at about 3-5 per leg. Otherwise the big unlocks stall.

---

# Option A in full: "Hero Gunship + Air Force"

## Rules
- **Two currencies.**
  - Scrap buys small leveled nodes. The first level costs 15-40 scrap, and each level costs about 1.4-1.6 times the last.
  - Survivors buy the big orange unlocks. Survivors are the crew for planes and cars.
- **Income.**
  - Scrap: about 80 per leg at leg 1, about 500 by leg 12.
  - Survivors: 3 per leg in legs 1-3, 4 per leg in legs 4-8, 5 per leg in legs 9-12. That is about 49 in the demo.
  - The big unlocks cost about 53 in total, so the player cannot buy everything and must choose.
- **Stations.**
  - The grid panel and the tower defense are removed.
  - A station is an arrival banner, the leg's loot, and one BLUEPRINT that reveals 1-2 new big nodes in the tree. This keeps late planes late and guarantees something new every leg.
- **Procs.**
  - Proc-made blasts cannot proc again.
  - At most about 20 new blasts per frame. The rest wait for the next frame.
  - Burning is a timer on each zombie, drawn in the crowd layer.
- **Removed:** Chain Shot, Farm, Nest Speed, Barbed Wire, Mortar Pit, Extra Heli and Wingman. Scrap and survivors spent on them are refunded in old saves.
- **Kept and reused:** Rail Cannon, Power Shot, Turbo Ram, Explosive Zombies, Golden and Silver Zombies, and Bonus Scrap.

## Branch 1: HELI (west), 10 nodes
1. **HYDRA ROCKETS**, the free root, 5 levels.
   - Chance per bullet to fire a rocket instead: 5 / 8 / 11 / 14 / 18%.
   - Blast radius 22 px, 4 damage. It kills walkers and runners and takes a brute to half.
   - Bad-luck timer: 6 s with no rocket means the next shot is a rocket.
   - Levels 2-5 cost 30 / 60 / 120 / 240 scrap.
2. **Gun Damage**, 10 levels, from 15 scrap. +1 damage per level. Level 1 makes the hit sparks bigger. This is filler.
3. **Fire Rate**, 10 levels, from 20 scrap. +8% per level. More bullets also means more rocket rolls. This is filler.
4. **Big Warhead**, 5 levels, from 40 scrap. Rocket radius +4 px per level (22 to 42).
5. **ROCKET PODS**, 2 levels: 2 survivors, then 150 scrap. Each proc fires 2, then 3, rockets. Pod sprites appear on the heli.
6. **Napalm Tips**, 3 levels, from 80 scrap. Rockets leave fire for 2 / 3 / 4 s. This shows as an orange ground patch.
7. **DOOR GUNNER**, 3 survivors. A second gun fires at a different target, with a second muzzle-flash star. This is Orc Problem's "More Gunners".
8. **HELLFIRE LOCK**, 4 survivors for level 1, then 200 and 350 scrap. Every 10 / 8 / 6 s, a guided missile kills the biggest brute or golden zombie on screen. A lock-on bracket shows first.
9. **Armor Plating**, 5 levels, from 30 scrap. +20 heli HP per level.
10. **APACHE FRAME**, 6 survivors. A new heli sprite, +50% HP and rocket chance ×1.5. This is the hero's evolution moment.

## Branch 2: AIR FORCE (north), 9 nodes
11. **A-10 STRAFING RUN**, 1 survivor. This is the plane you already have. Key Q, 1 charge per leg.
12. **Extra Sortie**, 2 levels, 120 / 300 scrap. +1 A-10 charge per level.
13. **Wide Strafe**, 3 levels, from 60 scrap. The strafe band is 25% wider per level.
14. **F-4 NAPALM**, 3 survivors. Key W, 2 charges per leg. You drag a line, and it becomes a fire line that burns for 6 s.
15. **B-52 CARPET**, 5 survivors. Key E, 1 charge per leg.
    - A 2 s radar ping, then a huge flat shadow crosses the screen.
    - 20 bombs walk along the lane you picked.
16. **Carpet Length**, 3 levels, from 150 scrap. +4 bombs per level.
17. **AC-130 SPOOKY**, 6 survivors.
    - Key F calls it once per leg.
    - It is then a unit: select it and right-click to move its circle.
    - For 15 s it fires 40mm, plus a 105mm every 2 s. The screen gets a green tint.
    - The old 105mm ability moves onto this plane.
18. **Resupply**, 3 levels, from 100 scrap. Killing a golden zombie refunds 1 strike charge, up to 1 / 2 / 3 per leg.
19. **B-2 SPIRIT**, 8 survivors. Its blueprint is revealed at station 9.
    - Key R, 1 charge per leg.
    - "B-2 INBOUND", then the sound cuts and the screen dims. A black triangle crosses the screen, and a second later a white flash kills every normal zombie on screen. Brutes and bosses take 50%.
    - It ends with a "HORDE ERASED" banner and bonus scrap.

## Branch 3: TRAIN (south, drawn as a rail line), 8 nodes
20. **Rail Reload**, 5 levels, from 30 scrap. -10% reload per level. This is the existing Rail Cannon.
21. **Power Shot**, 3 levels. Kept: every 4th / 3rd / 2nd rail shot is 3× wide.
22. **Turbo Ram**, 5 levels. Kept, with Ram Time and Ram Charge merged into one node.
23. **MG CAR**, 100 scrap. This is the first car. It has 2 side turrets that only shoot zombies near the rails.
24. **More Gunners**, 2 levels, 150 / 300 scrap. +1 MG turret per level.
25. **KATYUSHA CAR**, 4 survivors. Every 12 s, it fires a fan of 12 rockets at the densest pack ahead. Napalm Tips applies to them.
26. **HANGAR CAR**, 4 survivors.
    - 3 drones follow the heli and collect scrap by themselves.
    - Press D to send them to the cursor.
    - The heli repairs while it is over this car.
27. **AMMO CAR**, 5 survivors. +1 charge of every strike per leg, but not the B-2.

The demo has 4 cars at most, so the train is about 6 cars long. That keeps the camera readable.

## Branch 4: SALVAGE (east), 6 nodes
28. **Bonus Scrap**, 10 levels. Kept.
29. **Golden / Silver Zombies**. Kept.
30. **Explosive Zombies + Blast Radius**. Kept. This is the on-death chain pop.
31. **Scorched**, 3 levels, from 100 scrap. +25% damage to burning zombies, from every source: Napalm Tips, the F-4 and the Katyusha fires.
32. **Gold Rush**, 2 survivors, an on/off switch. When it is on, more golden zombies and more danger spawn, so you get more loot and more Resupply.
33. **Winch and Magnet**, 3 levels. Faster survivor and crate pickup, and a wider scrap pull.

## Locked "FULL GAME" teasers in the tree
Flame Car, Chinook Supply, AC-130 Thermal Aim mode, Twin B-52, Wingman Viper and Tactical Nuke.

## Leg-by-leg plan for the demo
| After leg | Blueprint revealed | Typical buy | What you see next leg |
|---|---|---|---|
| Start | — | Hydra Rockets 5% (free) | A rocket by second 3, with a red pop crater |
| 1 | MG Car | MG Car + Hydra level 2 | The train is one car longer and shoots back |
| 2 | A-10 | A-10 (1 survivor) + Gun Damage | Your first jet run, with a red stripe |
| 3 | Rocket Pods | Pods (2 survivors) + Napalm Tips | Pods on the heli, rockets in pairs, fire patches |
| 4 | F-4, Scorched | F-4 (3 survivors) + Scorched 1 | A firewall across a stream |
| 5 | Door Gunner | Door Gunner (3 survivors) | Two flash stars on two targets |
| 6 | B-52 | B-52 (5 survivors) | The huge shadow and 20 walking bombs |
| 7 | Katyusha, Resupply | Katyusha Car (4 survivors) | A 12-rocket salvo from the train |
| 8 | AC-130 | AC-130 (6 survivors) | Green tint, an orbit you place, 105mm thumps |
| 9 | Hellfire, B-2 (locked until it is affordable) | Hellfire (4 survivors) | Brutes die on a lock-on bracket |
| 10 | Hangar, Ammo Car | B-2 Spirit (8 survivors) | Silence, the black triangle, the screen erased |
| 11 | Apache Frame | Apache, Hangar or Ammo (pick one) | A new heli sprite, or drones, or more strikes |
| 12 | Finale: the Bridge Horde | Spend what is left | Full arsenal, B-2 on the biggest wave, then the end card |

Survivors on hand never fall below the planned buys. About 4-8 are left at the end, so the player gives up one of Hangar, Ammo, Apache or Gold Rush. That is the choice.

## Build order
1. Remove the station tower defense and the grid panel. Turn stations into milestones with blueprints, and refund old saves.
2. Hydra rockets with the bad-luck timer and the forced first rocket. Rebuild the tree.
3. B-52 and B-2, reusing the Strafing Run code in planes.js.
4. A shared car base, then the MG Car, then the Katyusha Car.
5. Rocket Pods and Door Gunner sprites, then Hellfire.
6. The AC-130 orbit with the tint.
7. The Hangar drones and the Apache Frame. These can move to the full game.
