# Sky Reaper: Style Guide

This guide is for the coding agent that builds `FINAL_DESIGN.md`. It sets the visual rules and the code rules that give the game its look and feel. Read it all before you write code. When you finish a feature, take screenshots with the qa tool and compare them with the reference pictures in `docs/style/`.

Every file, function, constant and colour named here exists in the code today, except where the text says it is new (a proposal or an example). If this guide and the code disagree, the code is right. Copy what the code does.

---

## 0. Reference screenshots (the target look)

The pictures are in `docs/style/`. The scenario that made each one is in `tools/examples/`. The zombies and the effects are random, so your picture will never match pixel for pixel. Compare the **look**: sizes, brightness, colours, how much is on screen, and how readable the zombies are.

| Picture | What it shows | How it was made |
|---|---|---|
| `docs/style/fight.png` | The heli over the horde. Small pale zombies with dark outlines, the red carpet of splats on clean bright ground, the train, the HUD. | `node tools/qa.js shot tools/examples/ref_fight.js tools/out/fight.png 1500` |
| `docs/style/zombies.png` | A 4x close-up of zombies: the outline, the dark head, the red mouth, the pale body lit from the left, the small ground shadow. | `python tools/crop.py tools/out/fight.png tools/out/zombies.png 690 90 180 140 4` (after the line above) |
| `docs/style/boom.png` | The Strafing Run's bombs landing: stacked fireballs, the white shock ring, the dust ring, smoke, chunks, scorch, blood. | `node tools/qa.js shot tools/examples/ref_boom.js tools/out/boom.png 800` |
| `docs/style/strafe.png` | The jet mid-run: the big flash at the nose, a band of hits, fire puffs along the line, glowing holes, the jet's shadow. | `node tools/qa.js shot tools/examples/ref_strafe.js tools/out/strafe.png 800` |
| `docs/style/cannon.png` | The rail cannon 4 frames after a shot: the white-hot beam, a row of blasts, bodies thrown, the burnt groove. **The gold standard for "juicy".** | `node tools/qa.js shot tools/examples/ref_cannon.js tools/out/cannon.png 800` |
| `docs/style/heli.png` | 3x zoom. The Viper firing: a muzzle flash much bigger and brighter than the heli, the rotor blur, the shadow, the train. | `node tools/qa.js shot tools/examples/ref_heli.js tools/out/heli.png 800 1200 1080` |
| `docs/style/train.png` | 3x zoom. The stacked-slice cars with rim light, zombies climbing on, the red carpet beside the rails. | `node tools/qa.js shot tools/examples/ref_train.js tools/out/train.png 800 1200 1080` |
| `docs/style/tree.png` | The Depot's skill tree tab: a dark starry panel, glowing nodes and lines, levels like `3/10`. | `node tools/qa.js shot tools/examples/ref_tree.js tools/out/tree.png 800` |
| `docs/style/depot.png` | The tree tooltip: name, level, kind, one sentence, the NOW > NEXT line, the price with its icon, CLICK TO BUY. | `node tools/qa.js shot tools/examples/ref_depot.js tools/out/depot.png 800` |

**The PNGs in `docs/style/` are fixed references. Never regenerate, overwrite or delete them.** The commands above only reproduce the pictures on the baseline commit (before BUILD_PLAN T0.2). The `ref_*.js` scenarios use node ids that Phases 0-2 delete (`strafe`, `strafeB`, `strafeW`, `gun`, `ram`, `magnet`, ...). `__sr.node()` returns `false` with no error for an unknown id, so after T0.4 these scenarios make different pictures, and `ref_cannon.js` waits 200 frames for a shot that never comes. Write your own scenarios in `tools/scenarios/` for the new game, and send your pictures to `tools/out/`.

**These things in the pictures are NOT part of the target:**
- **Old tutorial UI.** The task box at the top left, the gold tip lines and the "RUNNERS" banner belong to the old tutorial. `FINAL_DESIGN.md` 8.5 replaces them (one tip at a time).
- **The STATION tab** in the Depot. It will be removed.
- **Pink nodes** in the tree. They become **gold** nodes (see 2.7).
- **The rail cannon.** It moves to the full game. Its shot is shown only as the quality bar for effects.
- **A lighter box in the middle of the screen.** It shows on the ground in `fight.png` and `zombies.png`. This is a small existing bug in `drawVignette()` (render.js): it draws only the edge bands of `VIG`, so a seam shows where the bands end. Do not copy it. If you fix it, keep the vignette as light as it is now (the gradient's strongest stop is `rgba(10,20,12,0.3)`).

**Tips for your own shots:**
- Use `__sr.frames(n)` to run whole frames (game step and drawing). Use `__sr.hold(true)` to freeze a moment.
- `__sr.sim()` does not age banners, so a banner made during `sim` stays in the picture. Run `frames(150)` after it.
- To get rid of the first-run tips, start one run and lose it at once: `start(); sim(2); lose(); sim(6); depot('tree'); start();`. See `ref_strafe.js`.
- A window of `1200 1080` gives a 3x zoom, for close-ups.
- Shot mode never prints errors. Run the same setup in run mode first and check `qaErrors` is `[]` (see `tools/README.md`).

---

## 1. Art direction (the look in 10 rules)

1. **A clean, bright stage.** The ground is a few flat colours in big areas: fresh grass, warm tan dirt fields, dark woods at the far sides, a pale railway. There is little small noise. The ground must stay quiet so the zombies and the blood stand out (land.js header: "a calm, clean stage so the dead and their blood stand out"). Bright daylight. No dark colour grade, no fog, no night tint.
2. **Small, high-contrast zombies** (the Orc Problem way):
   - Pale sickly bodies, a dark 1 px outline (`ZOUT`), a dark head and a red mouth pixel (`ZRED`).
   - Walker 8x11, runner 9x10, brute 12x14, before the outline.
   - You must be able to read one zombie at 1x zoom on grass AND on dirt.
3. **Red death splats that stay.** Every gun kill leaves a red splat or a corpse on the ground. These marks are **decals**: they are painted into the ground chunks and fade slowly (`fadeDecals`, 5% every 3 s). After a big fight the ground near the rails is a red carpet. Effects never hide or erase it.
4. **Effects are brighter and bigger than units.** A muzzle flash is a star of light up to 16 px long with a 40 px glow. The zombie it hits is 10 px tall. Explosions are fat white-yellow-orange balls that cool into grey smoke. The player should feel the power.
5. **Effects are short. Readability comes back fast.**
   - Flashes last 0.07–0.3 s.
   - Smoke is see-through (alpha 0.2–0.7) and drifts away.
   - Big glows are capped: `light()` halves every px of radius over 38.
   - After any effect, the zombies must be readable again within about half a second.
6. **Crisp pixel art at a whole-number scale.**
   - The game is drawn at about 640x360 game pixels and scaled up by a whole number (`resize()` in core.js, `SCALE`).
   - `imageSmoothingEnabled = false` everywhere.
   - Always round positions before drawing (`Math.round`).
   - No sub-pixel blur, no smooth scaling of sprites, no anti-aliased canvas paths in the world. The one exception is the tree's soft glow, `tGlow()`.
7. **One light, from the top left.**
   - The sun is low in the north-west (`SUNX = 0.55`, `SUNY = 0.32` in art.js). Every shadow falls down and to the right (south-east).
   - Every sprite is lit on its top and left edges (`rimLight`, `selOut`) and dark on its right and bottom.
8. **The view is three-quarters from above.** Every circle or ring on the ground is squashed by `FORE = 0.72`: the y radius is `r * FORE`. Every ground speed in y is multiplied by `FORE`. Forget this and effects look tilted.
9. **No image files and no sound files.**
   - Every sprite is drawn in code at start-up (`pix()` and the helpers in art.js).
   - Every sound is made live with Web Audio (audio.js, `SFX`, `tone()`, `nz()`).
   - Do not add `.png`, `.wav`, fonts or libraries.
10. **The look is "Ball x Archers" and "Orc Problem".** Hard pixel edges, a few colours per sprite, dithering (`bayer()`) instead of gradients on the ground, and pixel circles (`pcirc`) instead of canvas arcs.

---

## 2. Palette

Use these hex values. Before you add a new colour, look here for one that already fits.

### 2.1 Ground (`LAND` in land.js)

| Use | Values |
|---|---|
| Grass: shade, base, sun patch | `#5e8f38`, `#689b3e`, `#73a645` |
| Grass blades / lit blade / lip at a field's edge | `#4f7f30` / `#8cbd55` / `#84b84e` |
| Woods floor | `#3c6a2c`, `#447433` |
| Dirt: furrow, base, sun patch | `#af824f`, `#b88b56`, `#c29762` |
| Dirt in the shade of the grass edge | `#8d633a`, `#9e7144` |
| Farm tracks | `#ad8150`, `#bd915c` |
| Corn: row gap, stalks, lit tops, tassels | `#4f6e28`, `#6f9434`, `#8db244`, `#d2c873` |
| Yard round a house | `#a58257`, `#b39066`, `#bf9c72` |
| Gravel bed / its edge | `#857e72`, `#9b9588`, `#aea798` / `#6f685d` |
| Sleepers | `#4a3423`, `#6b4b33`, `#835d40` |
| Rails: dark, mid, bright steel | `#2c2e33`, `#5f646c`, `#e6e9ee` |
| Wild flowers | `#f4efdc`, `#f2d250`, `#e98aa0` |

Trees (`TREE_PAL`, each list is rim, shade, base, lit, highlight):
- green `#21401f #2f5c2a #3d7633 #559340 #79b453`
- deep (woods) `#183218 #24481f #2f5d29 #3f7633 #5a9442`
- olive `#2b3e19 #3f5a24 #56752e #6f923a #93b452`
- autumn `#4a2b12 #8a4a1e #b0652a #cf8a3a #ecb85e`

Hay bale: `#6a4c1e`, `#f0d488`, `#d8b562`, `#b08a3e`.

### 2.2 Zombies (`ZPAL` in horde.js)

| Part | Values |
|---|---|
| Outline `ZOUT` | `#0c0f09` |
| Mouth `ZRED` / wound `ZWOUND` | `#c4261c` / `#7e1712` |
| Walker bodies (shade, mid, light) | `#7f9a6a #a3be89 #c6dbab`, `#83907b #a8b59c #cad5bf`, `#8c9864 #b0bc86 #d0d9a6` |
| Runner bodies (paler) | `#97a676 #c0cd9a #e0e8c2`, `#9a9f80 #c3c7a6 #e2e4cc` |
| Brute bodies (darker, bigger) | `#4a6240 #68845a #89a674`, `#55604a #748064 #96a184` |
| Heads (dark) | for example `#1b2216 #2f3b27` |
| Legs | for example `#283124 #414c38` |
| Hit flash (`flashSpr`) | `rgb(255,252,240)` inside; the outline stays dark |
| Silver (`SILVER`) | `rgb(34,40,52)` → `rgb(104,116,136)` → `rgb(164,178,198)` → `rgb(214,226,240)` → white |

A new zombie variant is a new `ZPAL` row or a recolour pass like `silverSpr()`. It always keeps the dark outline, the dark head and the red mouth.

### 2.3 Blood and gore

| Use | Values |
|---|---|
| Drops (`BLOOD` in juice.js, from `P.bl0..bl2`) | `#2a0e0c`, `#4a1512`, `#6a1c18`, `#821f1a` |
| Splat (`splatSpr`): middle, mid, rim | `#b01c14`, `#8e1510`, `#640f0c`; drops `#80120f` `#5a0d0b`; wet highlight `#c8352a` |
| Pools (`poolSpr`) | `#3a0c0a`, `#4a1210`, `#5a1612` / `#401010`, highlight `#7a2a24` |
| Red mist puff (`popKill`) | `rgba(196,38,28,0.6)`, a smoke particle that grows |
| Corpse darkening (`corpseOf`) | `rgba(64,14,10,0.62)` laid over, splashes `#8c1510` |

### 2.4 Fire, light, smoke, dirt

| Use | Values |
|---|---|
| Explosion ramp `BC` (fx.js), hot to cool | `#ffffff`, `#fff3b0`, `#ffd25a`, `#ffa23a`, `#f0702a`, then smoke `#8f8a83`, `#aca79f`, `#cac5bd` |
| Fireball rim | `#c2401a` (smoke rim `#5e5a55`) |
| Sparks | `#fff6e0`, `#ffd27a`, `#ff9a3a` (or `#ffb347`) |
| Embers | `#ffd27a`, `#ff8a3a`, `#e2552f` |
| Flame (`drawFlame`) | `#c9772f`, `#e2552f`, `#ff8a3a`, `#ffcf6a`, `#fff1c2` |
| Hot hole cooling (`drawEmbers`) | `#fff6e0` → `#ffb347` → `#e2552f` → `#9a3320` |
| Dust (`DUSTC`) | `rgba(150,128,96,0.55)`, `rgba(124,106,80,0.55)`, `rgba(170,150,116,0.45)` |
| Earth clods (land and stay) | `#4c4032`, `#362d24`, `#5e5140`, `#2a241d` (also `#3a2e22`, `#4f3f2d`, `#2a221a`) |
| Smoke | dark `rgba(70,64,58,0.55)`, `rgba(96,90,82,0.45)`; light `rgba(128,124,118,0.5)`, `rgba(156,152,146,0.45)` |
| Jet trail | `rgba(210,214,220,0.35)` |
| Shock rings | white-hot `#fff6e0` / `#fff1c2` / `#ffd8a0`; dust ring `#a89878` |
| Screen flash (`drawJuiceTop`) | `#ffcf9a`, at most 0.35 alpha |

**Glow colours (`GLOW_COLS` in land.js):** `#fff1c2 #ffb060 #ffd27a #ffd24a #ff8a3a #ffb347 #ffe2a0 #ffc27a #ff9a4a #ffffff #fff6e0 #fff1d8 #ffd36a #ff9a3a #ff7a28 #ff6a28 #ff4a32 #e3b04b`.
- Use one of these with `light()`.
- If you need a new glow colour, **add it to `GLOW_COLS`**. Then its glow sprite is in the atlas from the start (`warmAtlas()` puts every `GLOW_COLS` glow there).

### 2.5 Units

| Unit | Values |
|---|---|
| Heli body `OLIVE` / glass `GLASS` / pods `POD` | `#87945f #64714a #465034` / `#5f8ca4 #2f4b5d #172630` / `#666b74 #484c54 #33363c` |
| Heli nav lights | red `#ff3a2a`, green `#5aff7a` |
| Engine (loco) | `#151b24 #243042 #34445c #4b5f7d`, hazard `#c9772f`, headlights `#fff1c2` |
| Coach | `#18221a #2a3a2a #3e563c #5b7656`, lit windows `#ffcf6a #ffe2a0` |
| Boxcar | `#2e120f #4e1d18 #6c2c22 #8a3d2c` |
| Tank car | greys `#2b2e35` up to `#b4b9c1`, red band `#9a3326` |
| Jet (planes.js) | `#c3cad0 #a1a9b1 #848d96 #636b74 #454b53`, canopy `#22384a`, glint `#c4ecf8` |
| Rim light on rotating sprites | `#f0e6cc` (train, 0.3), `#f0ead4` (heli, 0.32), `#e8e2cc` (cannon, 0.2) |
| Thermal outline | `#161616` |

### 2.6 UI text and panels

**`U` (sprites.js), the UI colours:**

| Name | Value | Meaning |
|---|---|---|
| `U.ink` | `#e8dfc8` | normal text |
| `U.dim` | `#9a9ca3` | labels |
| `U.faint` | `#5d616b` | off / disabled |
| `U.gold` | `#e3b04b` | gold, primary buttons |
| `U.red` | `#d0553f` | danger, cannot pay |
| `U.teal` | `#56c2a8` | |
| `U.blue` | `#9fd3f2` | info, station names, next stop |
| `U.amber` | `#e8913a` | warnings |
| `U.green` | `#8fd18a` | good, the NEXT value, selected |

**Panels and buttons (art.js, ui.js):**

| Part | Values |
|---|---|
| `panel()` | fill `#101115`, frame `#2e3139`, top line `#1c1e24`, bottom line `#07080a` |
| `card()` | `rgba(12,13,17,0.86)`, frame `#2e3139` |
| `button()` fill | `#131419`, hover `#1d1f25`, pressed `#0b0c0f` |
| `button()` frame | normal `#3a3e48` (hover `#6a6f7b`); primary `#b8862f` (hover `#f0c264`); danger `#8a3a2c` (hover `#e0705a`); off `#24272e` |
| Top bar (`drawHUD`) | `rgba(6,7,9,0.88)`, 18 px tall, line `#24272e` |
| Banners (`drawBanners`) | `rgba(5,6,8,0.55)`, title at scale 2 with `drop` |
| Text outline (default) | `#07080a` |
| Train health bar | green `#6f9a4f`/`#9cc777`, amber `#c9862f`/`#e8b05a`, red `#b8402e`/`#e06a4f` |

### 2.7 The skill tree (`NODE_KIND` in tree.js)

Each kind has c = bright, m = mid, d = dark (the body when maxed), g = its glow.

Today `NODE_KIND` has the kinds `root`, `up`, `big` and `spec`. BUILD_PLAN T2.2 changes them to the kinds below. Use these names (the same names as BUILD_PLAN):

| New kind | Today's kind | c | m | d | g | Use |
|---|---|---|---|---|---|---|
| `scrap` | `up` | `#62c8ff` | `#2f6f9e` | `#0b2234` | `#2a9dff` | **Blue = scrap nodes** |
| `surv` | `big` | `#ffa448` | `#a55a1e` | `#331b08` | `#ff7a1a` | **Orange = survivor unlocks** |
| `gold` | (new) | `#ffd36a` | `#a07a30` | `#2e2410` | `#ffb040` | **Gold = gold specials** (the root's values) |
| `root` | `root` (stays) | `#ffd36a` | `#a07a30` | `#2e2410` | `#ffb040` | the root, VIPER. Its id stays `'root'`. |
| `tease` | (new) | drawn as a locked node | | | | **FULL GAME teases** |
| — | `spec` | `#ff70d4` | `#9e3a84` | `#2e0c26` | `#ff3ab8` | pink: **remove it** |

- Tree background: `#04060a`.
- Locked frame: `#202838` (hover `#3a4458`).
- Tooltip box: `rgba(5,8,13,0.97)`.

**Rules for the new tree:**
- **Gold nodes** use the root's colours. The root stays different because it is bigger and has a double frame (`big` in `drawTreeNode`, set by `n.id === 'root'`).
- **FULL GAME teases** (`tease`): draw them like locked nodes, with the frame `#202838` (hover `#3a4458`) and `ICON.lock`.
- **Remove `spec`.** Code that checks `n.k === 'spec'` must change too, for example the tooltip's kind name in `drawInfo` (tree.js:818).
- **One colour per currency, everywhere** (FINAL_DESIGN: "the color of a node shows its currency"). Price text, counters and pop-ups use the same family:

| Currency | Text colour | Node colour | Icon |
|---|---|---|---|
| Scrap | `U.blue` `#9fd3f2` | `#62c8ff` | `ICON.boltS` / `ICON.scrap`; you may recolour them steel-blue |
| Survivors | `U.amber` `#e8913a` | `#ffa448` | `ICON.survS` / `ICON.surv` |
| Gold | `U.gold` `#e3b04b` | `#ffd36a` | `ICON.coin` (and the new `ICON.goldS` of BUILD_PLAN T1.7) |

- **Gold-coloured numbers mean gold only.** Today the scrap counter, the kill pop-ups (`addTotal(..., U.gold)` in `kill()`) and the flying coins (`drawCoins`) are gold. When gold arrives they must change to the scrap colour.
- This colour choice is a proposal that follows from the design. If the owner disagrees, ask.

---

## 3. How sprites are made

### 3.1 The tools (art.js)

| Function | What it does |
|---|---|
| `pix(w, h, fn)` | A new w x h canvas. `fn` gets `r(x, y, w, h, color)` to fill rectangles, and the context `g`. **All art is made with this.** |
| `outline(src, col)` | 2 px bigger, a solid 1 px outline in `col`. Zombies and icons use `ZOUT` / `P.out` (`#0a0b0e`). |
| `selOut(src)` | A "selective outline": each outline pixel is a dark copy of the pixel next to it. It is a little lighter on top and on the left. Used for rotating units (train, heli, cannon, jet). |
| `rimLight(src, col, a)` | Moves the top-edge pixels toward `col` (the left edge half as much). Always use it before `selOut` on units. |
| `tint(src, col, alpha, mode)` | A colour laid over the sprite's pixels. Used for hit-red cars (`carRed`), the Ram glow (`carGlow`), silhouettes. |
| `castShadow(src)` | A black silhouette, flattened and slanted away from the sun. |
| `shadowSpr(w)` | A round ground shadow w px wide. |
| `unitShadow(src, shw)` | Both shadows together. |
| `stackSpr(slices, ang, box)` | Builds a 3D-looking unit from top-down slices (see 3.3). |
| `rotA(src, a)` (sprites.js) | Turns a sprite with hard edges: alpha is set to 0 or 255, cut at 110. |
| `flipH`, `rot90`, `scaleSpr(src, k)` | Mirror, quarter turn, nearest-pixel scale. |
| `hotSpr(src, base)` | The thermal-camera copy (see 3.5). |
| `strSpr(rows, pal)` | A sprite from rows of letters with the `NPAL` palette. Used for the 12x12 node icons in `NODE_ART` and the small icons like `ICON.star`. |

The style of a sprite:
- Lit from the top left: light on the left and top, dark on the right and bottom.
- 3–5 tones per material.
- A dark or selective outline.
- Small details of 1–2 px: rivets, rust, hazard stripes, wear from `hrnd()` (see `wear()` in sprites.js).

A real example, the walker's head in `hWalker()` (horde.js):

```js
// the head: dark, a red mouth
o(3, 0, 3, 3, h1); o(5, 0, 1, 3, h0); o(3, 0, 1, 1, b0); o(5, 2, 1, 1, ZRED);
```

A real example, a crate prop (sprites.js), with a lit left side and top and a dark right side:

```js
function crateSpr() {
  return pix(8, 8, (r) => {
    r(0, 2, 8, 6, '#5b3f27'); r(0, 2, 2, 6, '#7b5735'); r(7, 2, 1, 6, '#3a2718');
    r(0, 0, 8, 3, '#8a6a44'); r(0, 0, 8, 1, '#a38558'); r(0, 4, 8, 1, '#3a2718'); r(3, 2, 1, 6, '#3a2718');
  });
}
```

### 3.2 Sizes and anchors

| Thing | Size (before outline) | Anchor |
|---|---|---|
| Walker / runner / brute | 8x11 / 9x10 / 12x14 | `S.ax = width >> 1`, `S.ay = height - 1` (feet) |
| Survivor | 4x7 | drawn at `x - 2, y - 8` |
| Prop (`prop()`) | any | `ax = width >> 1`, `ay = height - 1` (middle of the bottom row). Its cast shadow is made at the same time. |
| Train car slice | 16x28 (front at the top) | `n.ox = 19`, `n.oy = 19 + slices` |
| Heli slice | 28x46, 9 slices (`HZ`), box 58 | `ox = B/2 + 1`, `oy = B/2 + n + 1` |
| Rail cannon | turret 22x22, barrel 52x52 | `ox/oy` set in `cannonArt()` |
| Jet | 62x54 (bigger than the heli, as the design asks) | its middle |
| Node icon | 12x12 + outline | its middle |
| HUD icon | 5x5 to 7x7 + outline | top left |

- Sort standing things by the ground y of their feet (`k = y`).
- A sprite drawn "in the air" (heli, jet, bodies) is drawn at `y - z`. Its shadow is on the ground, offset by `alt * SUNX, alt * SUNY`. See `drawHeliGround()` and `drawPlaneShadows()`.

### 3.3 Rotating units: headings

Units that turn are baked at many headings once, at start-up:
- **0 = north (nose up), clockwise.**
- The angle from a direction is `Math.atan2(dx, -dy)`.

| Unit | How many headings | Pick the sprite |
|---|---|---|
| Train cars (`TRAIN[k].n`) | `ANG_N = 33`, only between ±40° (`ANG_MAX`) | `angIdx(c.ang)` |
| Heli (`HSPR.n`) | `HN = 48`, full circle | `mod(Math.round(h.hd / TAU * HN), HN)` |
| Rail cannon (`TURRET`) | `CANNON_N = 64` | `mod(Math.round(g.ang / TAU * CANNON_N), CANNON_N)` |
| Jet (`JET.n`) | `JETC.N = 32` | `jetIdx(j)` |

**Big units are piles of slices** (`stackSpr`): one top-down slice per pixel of height, each drawn 1 px above the one under it, then cut to hard edges. That is why the train looks solid from every angle. This is how `bakeHelis()` makes the heli:

```js
const raw = stackSpr(sl, a, B);
const nn = selOut(rimLight(raw, '#f0ead4', 0.32)), hh = outline(hotSpr(raw, 150), '#161616');
```

Any new car (MG Car, Katyusha Car) is a new `xxxSlices()` function in the style of `boxSlices()` and `tankSlices()`. Start it with `underSlices()` (wheels and frame) and bake it in the same loop as the other cars in `initSprites()`.

A turret on a car is a separate small slice pile at its own headings, drawn on the deck. See `drawCannon()`, `DECK` and `CB_Z`. The turret and the barrel are drawn apart so the barrel can kick back.

### 3.4 The atlas (core.js): when to make sprites

- Small sprites are copied into one 2048x2048 atlas canvas (`ATLAS`) and drawn from there with `blit()`. Only small sprites go in: `w * h <= 4096`, or `h <= 12 and w <= 512` (core.js:79). Bigger ones are drawn from their own canvas, which is fine.
- **Make every sprite once, at start-up, before the first frame.** There are two good places:
  1. a bake function called from `initSprites()`, before `warmAtlas()` (like `bakeHelis()`, `makeHordeSprites()`, `initLand()`), or
  2. a bake call at the top level of your file, like `bakeJet();` in planes.js (planes.js:101). planes.js loads **before** main.js, so this runs before `boot()` and before `warmAtlas()`, and `atl()` still puts the sprite in the main atlas. (`cannonArt();` in cannon.js also works, but cannon.js loads after main.js. New game files go before main.js, see section 9.)
- **Call `atl(c)` on each new sprite yourself, right away.** `warmAtlas()` (land.js) only visits `ZS`, `TRAIN`, `FOOT`, `SURV`, `PROPS`, `SCN`, `STATION`, `SAFE`, their thermal copies, and the `GLOW_COLS` glows. Anything else is not in the atlas unless you call `atl()`.
- A sprite added to the atlas after the first frame goes into small "late pages" (`LATE`, at most 24 pages of 512x512). After that it is drawn from its own canvas, which is slower. `__sr.late()` counts these pages. Today it is already 1 after the first frames; your work must not make it higher.
- **Never make a sprite inside a frame or a step.** If you need a variant (tinted, glowing, white), make it once and keep it (`carRed()`, `carGlow()`, `cbGlow()`, `cbWhite()` cache theirs). Better: make it at start-up and put it in the atlas, as `initSprites()` does with `carGlow(TRAIN[0], i)`.
- Use `blit(src, x, y)` for sprites. The crowd layer (horde.js) writes pixels directly; do not copy that pattern for other things.

### 3.5 Thermal camera

The game has a thermal camera (T key, `thermal`, `setThermal()`).
- Every unit sprite has a hot copy: `outline(hotSpr(raw, heat), '#161616')`.
- Every draw picks `thermal ? hot : normal`.
- Coloured flashes are skipped while `thermal` is on (see `drawJuiceTop`, `drawCannonFx`).
- Keep it working for new units, or at least never crash with `thermal` on.

---

## 4. The effects toolkit

All effects live in world pixels: `x, y` on the ground and `z` = height. The lists are in fx.js. They age in `updateFX(dt)` and `updateJuice(dt)` (called by `step()`) and are drawn in `render()`.

### 4.1 Particles: `part(o)`

`part(o)` adds one particle; `o` itself becomes the particle. It returns `null` when a limit is hit. Fields:

| Field | Meaning |
|---|---|
| `x, y, z` | position (z = height over the ground) |
| `vx, vy, vz` | speed in px/s. **Multiply ground `vy` by `FORE`.** |
| `g` | gravity on `vz`: about 160–320 for things that fall, 0 for smoke, negative (like -6) for embers that rise |
| `life`, `max` | seconds left and the start life. Alpha fades with `life / max` for `add` and `smoke` particles. |
| `s` | size in px (1–2 for sparks and drops, 2–8 for smoke). Smoke of 5 px or more is drawn round (`pcirc`). |
| `c` | colour (hex, or `rgba()` for smoke) |
| `add: true` | a glowing particle, drawn in the additive pass. Limit: about 260 at once. |
| `land: 1` | when it falls to the ground it becomes a **decal pixel** (`stampPix`) and stays. Use it for blood drops, earth clods, shell cases. |
| `drag` | slows it down (`exp(-drag * dt)`): 1–4 |
| `grow` | px of size per second (smoke and puffs: 3–12) |
| `smoke: true` | soft fade (alpha in eighths); round when big |

Real examples:

```js
// a spark (hitSpark, horde.js)
part({ x, y, z: 3, vx: Math.cos(a) * s, vy: Math.sin(a) * s * FORE, vz: rnd(20, 60), g: 180, life: rnd(0.12, 0.28), max: 0.28,
  s: 1, c: pick(['#fff6e0', '#ffd27a', '#ffb347']), add: true, drag: 1.5 });
// a blood drop that lands and stays (popKill)
part({ x: z.x + rnd(-1, 1), y: z.y, z: rnd(2, S.h * 0.7), vx: (dx - dy * s) * v, vy: (dy + dx * s) * v * FORE, vz: rnd(20, 70),
  g: 260, life: 1.2, max: 1.2, s: Math.random() < 0.25 ? 2 : 1, c: pick(BLOOD), land: 1 });
// a puff of dust on the ground
part({ x, y, z: 1, vx: rnd(-10, 10), vy: rnd(-8, 4), vz: rnd(10, 25), g: 0, life: rnd(0.6, 1.1), max: 1.1, s: 2,
  c: pick(DUSTC), grow: 5, drag: 2.5, smoke: true });
```

### 4.2 Fireballs: `addBoom(x, y, R, n, T, cap, delay)`

- `R` = size in px, `n` = how many puffs (4–8), `T` = seconds (0.3–1.1), `cap` = the biggest puff radius, `delay` = seconds before it starts.
- `drawBooms()` draws a white flash with a yellow edge for the first 6% of `T`. Then puffs swell, rise and cool through `BC` into grey smoke.
- Several small booms with growing `delay` along a line make a "row of blasts". `cannonFire` uses `t / 1800` and `strafeFire` places one every `JETC.step` px.
- Stack 2–4 booms at slightly different places for a big blast (`boomFx` does this).

### 4.3 Light: `lights.push(...)` and `light()`

- `lights.push({ x, y, z, r, c, life, max, a })` adds a glow that fades over `life`. It is drawn by `drawLights()` in the additive pass.
- `light(x, y, rad, col, a)` draws a glow now. **Call it only inside the `'lighter'` part of `render()`** or in your own `drawXxxFx()` called from there.
- The radius is softly capped: over 38 px it grows at half speed. Big glows wash out the bright ground.
- Typical values:

| Effect | radius | life (s) | colour | alpha |
|---|---|---|---|---|
| muzzle flash | 40 + 18 | — | | |
| hit | 9 | | | |
| strafe hit | 14–20 | 0.14 | | 0.85 |
| blast | 44–60 | 0.3–0.45 | | 0.35–0.7 |
| crater glow | 18–26 | 3 | `#ff6a28` | 0.5 |

### 4.4 Rings: `rings.push({ x, y, r0, r1, t: 0, T, c, w })`

- A ground ellipse that grows from `r0` to `r1` in `T` seconds and fades.
- `w: 2` makes it 2 px thick.
- Drawn with `pell()` in the additive pass.
- Use a fast white ring (`T` 0.2–0.3) for the shock wave and a slow wider `#a89878` ring (`T` 0.45–0.55) for the dust ring.

### 4.5 Words and numbers

- `addTotal(x, y, v, c, big, neg)` shows a floating `+N`. Totals near each other with the same colour add up.
- `floatText(x, y, s, c)` shows a floating word (OVERHEAT, POWER SHOT!).
- `banner(a, b, c, pri)` shows a big line across the screen at y = 58, for 2.2 s. Use it only for big moments (a leg won, a Dead Wall, MULTI KILL). Banners cover the field, so keep them rare.
- `coins.push({ x0, y0, t, T })` sends a coin from screen point (x0, y0) to the counter. See section 2.7 about its colour.
- Limits: 40 texts. In a horde only big, gold and silver kills show their number (`kill()`). Do not show a number for every small kill.

### 4.6 Feel: `addShake`, `kick`, `hitStop`, `JUICE.flash`

| Tool | Use | Typical values |
|---|---|---|
| `addShake(a)` | screen shake; strength is trauma squared | 0.035 brute hit, 0.08 small blast, 0.12 zombie blast, 0.3 strafe start, 0.45 bomb, 0.6 cannon, 0.75 the 105 |
| `kick(x, y)` | knocks the view (recoil); it springs back. Max ±3 px. | `kick(-ux * 3, -uy * 3)` on the cannon shot |
| `hitStop(d, k)` | slow motion for d seconds at time scale k | 0.02 (3+ kills), 0.04–0.05 bombs and brute kills, 0.07–0.1 cannon or huge blasts |
| `JUICE.flash = Math.max(JUICE.flash, 0.06..0.1)` | a short warm flash of the whole screen, only for big blasts | max alpha 0.35 |

- All four do less, or nothing, with `REDUCED` (prefers-reduced-motion). They do this by themselves.
- Never call them in the demo behind the menus: guard with `if (!G.demo)`.

### 4.7 Marks on the ground (decals)

Decals are painted into a second canvas per 128 px chunk (`DECALS`, world.js) and fade 5% every 3 s.

| Function | Use |
|---|---|
| `stampPix(x, y, c, s)` | one pixel (or s x s), for drops, clods, rubble |
| `stampSpr(spr, x, y, a)` | a sprite on the ground (top left at x, y), for splats, corpses, rays |
| `stampScorch(x, y, k)` | a dithered scorch ellipse: `k` 0 = radius 4 (a bullet hole), 1 = 9, 2 = 16, 3 = 24 (a big crater with a rim) |
| `stampCorpse(S, x, y)` | a corpse and a spreading pool |
| `bloodPool(x, y, S)` | a pool that grows under a body over about 1 s (`stampUnder`, under what is already there) |

- **The heli's gun leaves no mark** (`mgImpact`: "the ground stays clean for the blood").
- Only blasts scorch. Blood is the main mark.

### 4.8 Kills and hits (horde.js, juice.js, game.js)

- `hitZombie(z, dmg, cause)` handles a hit: the white flash (`z.flash`), blood sprayed away from the shot (`juiceHit` → `spray`), a knock back, and a kill when hp ≤ 0.
- Set `JUICE.from = [x, y]` before the hit so the blood flies away from the real source.
- `kill(z, cause, cx, cy, dist)` picks the death by `cause`:
  - `'he'`: thrown away from the blast centre `(cx, cy)`, turning (`G.bodies`), with blood and gibs (`juiceKill`). The throw strength uses `dist` (game.js:925: `1 - Math.min(1, dist / CFG.he.hurt)`).
  - `'train'` / `'ram'`: flung aside.
  - gun kills (`'mg'`, `'gun'`, `'boom'`, `'strafe'`): `popKill()`, a red splat or corpse that stays, 5–10 drops, a red mist puff, sometimes a limb (`gib`).
- **Use `kill()` and `hitZombie()` for every new weapon.** Never remove a zombie yourself. That would skip the pay, the splat, silver and explosive rolls, and the tutorial counts.
- Area damage: `queryEll(x, y, R, (z, d) => ...)`. It uses the zombie grid and the squashed ellipse.
- Choose `cause` for the look you want. Blasts use `'he'` so bodies fly. Bullets use a gun cause so bodies pop into splats.
- **Blast damage: never call `hitZombie(z, dmg, 'he')`.** A lethal `hitZombie` calls `kill(z, cause, 0, 0, 0)` (game.js:985), so an `'he'` body would fly away from world point (0, 0). Also never call `kill(z, 'he', x, y)` without `dist` (the speed becomes NaN). Do what `strafeFire()` does (planes.js:276-282):

```js
queryEll(x, y, R, (z, d) => {
  if (z.hp <= dmg) kill(z, 'he', x, y, d);          // lethal: the body flies from the blast centre
  else { JUICE.from = [x, y]; hitZombie(z, dmg, 'boom'); }   // not lethal: a hit (strafeFire uses 'strafe' here)
});
```

### 4.9 The gold standard: the cannon shot and the strafe

Read `cannonFire()` (cannon.js) and `strafeFire()` / `strafeHit()` / `strafeBlast()` (planes.js) before you make any new weapon effect. They show the layered recipe:

1. **Anticipation:** the barrel glows hotter while it reloads (`cbGlow`), sparks are drawn into the muzzle, the pips fill up. For a plane: the shadow races in first.
2. **The flash:** a fireball at the muzzle, 18 sparks out of the brake, a white light, a shock ring, a smoke ring.
3. **The line:** a white-hot beam that thins and breaks into dashes (`drawBeam`), a row of small booms with growing delay, dust, clods thrown to both sides.
4. **The victims:** each one killed with `kill()`, bodies thrown off the line spinning, red bursts.
5. **The aftermath:** a burnt groove (`cannonScorch`), a glowing line that cools from orange to dark red over 1.6 s, smoke curling from the barrel, a brass shell case.
6. **The feel:** `addShake(0.6)`, `hitStop(0.07, 0.1)`, `kick()`, the flatcar jolts, `SFX.cannon()`.

A good effect has **a short wind-up, a white-hot peak, coloured falloff, smoke, and a mark that stays**.

### 4.10 Recipes

Start from these real patterns and change only the sizes.

**A big explosion** (B-52 bomb, Hellfire, Katyusha rocket, a Dead Wall breaking). Copy `bombHit()`:

```js
function bombHit(x, y) {
  juiceBoom(x, y, false);                 // hot core, screen flash, dust ring, flying chunks, smoke column, crater with rays
  addBoom(x, y - 2, 24, 8, 0.9, 11);      // the fat fireball
  queryEll(x, y, JETC.bombR, (z, d) => kill(z, 'he', x, y, d));
  if (!G.demo) { addShake(0.45); hitStop(0.04, 0.3); SFX.boom(); }
}
```

For a huge blast (B-2), use `boomFx(x, y, true)` (more booms, rings, 16 smoke puffs, 34 clods, 18 sparks, small fires, crater) together with `kill()` on everyone in range. `boomFx` sizes its rings from `CFG.he.kill` / `CFG.he.hurt`. For another radius, push your own rings. Do not use `explode()` for friendly weapons: it hurts the train (BUILD_PLAN Trap 8).

**A medium blast** (heli rocket, pod rocket, cluster bomb). Copy `strafeBlast()`:

```js
addBoom(x, y - 1, rnd(13, 17), 7, 0.8, 8);
lights.push({ x, y, z: 4, r: rnd(44, 56), c: '#ffb060', life: 0.3, max: 0.3, a: 0.7 });
rings.push({ x, y, r0: 4, r1: 26, t: 0, T: 0.22, c: '#fff1c2', w: 2 });
// + 6 sparks (add: true, '#fff6e0' / '#ffd27a' / '#ff9a3a'), stampScorch(x, y, 1), addShake(0.08)
```

**A small blast** (a bomblet, an explosive zombie): copy `zombieBlast()`. It has two lights, `addBoom(x, y, R * 0.7, 5, 0.45, ...)`, a ring, 10 sparks, 4 smoke puffs, and `stampScorch(x, y, 1)`.

**A hit (a bullet lands).** Do what `mgImpact()` does:
- `JUICE.from = [shooterX, shooterY]; hitZombie(z, dmg, cause);` on the target, then
- `hitSpark(x, y)` at the impact. That adds a star of light (`drawHits` → `starFlash`), 3 sparks and a little dust.
- **No mark, no tracer.**

Stat nodes that "give a bigger hit flash" scale the `len0, len1` of `starFlash()` and the `light()` radius, and nothing else.

**A muzzle flash** (heli, MG Car turret). Copy `heliShot()` + `drawMuzzle()`:
- On each shot set `h.flash = 0.07; h.fs = (Math.random() * 1e6) | 0;` so every shot gets a new star.
- Throw a spent case: `part({... g: 200, c: pick(['#e3b04b', '#c9952f', '#f0c85a']), land: 1 })`.
- In the additive pass, at the muzzle, `drawMuzzle` draws:

```js
light(x, y, 40, '#ff9a3a', 0.9 * k);
light(x, y, 18, '#fff1c2', k);
starFlash(x, y, h.fs || 1, 6, 16, 0.5 + 0.5 * k);
// + a fat streak forward (white -> '#ffe2a0' -> '#ffb347'), and a 5x3 + 3x5 white cross at the muzzle
```

- For a smaller gun (MG Car), use about 60% of these sizes. The flash must still be clearly bigger and brighter than a zombie.

**A plane strike** (A-10, F-4, B-52, B-2). Follow planes.js and the order in FINAL_DESIGN 6.2:
1. A red marker blinks on the ground. Copy `drawShellMarks()`: a `pell()` ring that closes on the spot plus a small cross, `'#ff2a1a'` / `'#ff6a28'`, alpha 0.35–0.65 blinking with `realT * 22`.
2. The shadow races in from the edge. `drawPlaneShadows()`: alpha 0.3, offset by `alt * SUNX, alt * SUNY`.
3. The plane is drawn high above everything, after the helis (`drawPlanes()` is called after `drawHeliTop()`). It leaves jet trails: one `part()` per engine every 0.05 s, `c: 'rgba(210,214,220,0.35)'`, `grow: 3`.
4. Hits along its path. Call `addShake(0.3)` once when it starts firing. Hits come every `JETC.step` px across the band (`strafeHit`), a puff of fire every 3rd, a big blast every 8th (`strafeBlast`), glowing holes (`STRAF.embers`, `drawEmbers`), scorch `k = 0`.
5. It leaves on the other side (`jetEdge`). Planes cannot be hit.

For the F-4 fire line, use the new burning-ground system of BUILD_PLAN T3.5 (`BURN`, a new name). Draw its flames with `drawFlame(x, y, big, seed)`, plus a `light()` of `'#ff9a4a'` each (as `render()` does for its fires), embers and smoke. Give `BURN` its own cap. Two names that already exist are **not** this system:
- `FIRES` (render.js:39) = the burning wrecks of the scenery. `render()` empties it and fills it again every frame from the chunk plans (`pl.fires`, land.js). Do not reuse or redeclare this name.
- `flames` = small fires from blasts, capped at 30 by its callers (`flames.length < 30`).

**A rocket in flight** (heli rocket, pods, Hellfire, Katyusha). Copy `drawHeShell()` + `updateHeShells()`:
- A bright head: `ctx.fillRect(x - 1, y - 1, 3, 2)` in `'#fff6e0'`.
- A short hot streak behind it: `pl()` segments, `'#ffd27a'` then `'#c9772f'`, fading.
- `light(x, y, 12, '#ffd27a', 0.8)`.
- One smoke particle per step: `s: 2, grow: 4, drag: 1.2, smoke: true, c: pick(['rgba(176,168,158,0.6)', 'rgba(136,128,120,0.55)'])`. For FINAL_DESIGN's "short smoke trail", use `life` 0.4–0.6.
- On impact: the medium blast above. For a Hellfire on a Dead Wall: the big one.
- Rockets fly in an arc: `z = lerp(z0, 0, u) + Math.sin(u * Math.PI) * height`.

---

## 5. Layers and draw order (`render()` in render.js)

The order is from the back to the front. New things go in the right layer. Do not just add them at the end.

| # | What | How |
|---|---|---|
| 1 | Clear to `#060708`. If the skill tree covers the screen (`treeCovers()`), stop here. | |
| 2 | **Ground chunks** (`GROUND`) and their **decals** (`DECALS`) | normal blend |
| 3 | `drawGroundLife()`, `drawShellMarks()` | marks on the ground |
| 4 | `drawHorde()`: the crowd layer A (most zombies, written as pixels), with stream warnings | |
| 5 | Shadows: zombies, train (`drawTrainShadow`), bodies, `drawHeliGround()` (heli shadows, selection rings, order lines), `drawPlaneShadows()` (with the glowing strafe holes) | alpha 0.25–0.42, black |
| 6 | **Everything standing, sorted by `k`** (DL): trees, props, train cars (`drawCar`, with the riders and the cannon), people, the zombies drawn one by one | normal blend |
| 7 | `drawHordeTop()`: crowd layer B, and zombies behind trees showing through them at 0.45 alpha | |
| 8 | Fires (`drawFlame` for `FIRES`, the burning scenery wrecks), `drawParts(false)` (blood, dirt, smoke), `drawBooms()`, `drawBodies()`, `drawJuice()` (gibs, chunks, coins in the air), `drawHelis()`. The new `BURN` flames (T3.5) go here too. | normal blend |
| 9 | **The additive pass** (`globalCompositeOperation = 'lighter'`): `drawLights()`, fire glows, headlights, lamps, searchlights, `drawRings()`, `drawParts(true)`, `drawRounds()`, `drawHeliFx()` (muzzle flashes, nav lights, `drawHits`), `drawCannonFx()`, `drawZaps()`, `drawTowerFx()`, `drawJuiceTop()` (screen flash) | |
| 10 | Back to normal: `drawSky()` (birds, wires), place names, `drawLoot()`, `drawHeliTop()`, `drawPlanes()` (jets and their own lighter flashes), `drawTexts()`, `drawRamCount()` | |
| 11 | Outside the world transform: `drawVignette()`, or the thermal look | |
| 12 | `drawUI()` (screen pixels: HUD, cards, radar, banners, tips), then `drawFade()` | |

(`drawZaps()` and `drawTowerFx()` are removed in BUILD_PLAN Phase 0.)

What goes in the **additive (`'lighter'`) pass**: anything that is light. That means glows (`light()`), sparks (`add: true`), muzzle flashes and stars, beams, rings, hot holes, and the screen flash.

What does **NOT** go there: smoke, blood, dirt, fireball puffs (`drawBooms` is normal blend, so the colours stay solid), sprites, text.

Reset `ctx.globalAlpha = 1` and `ctx.globalCompositeOperation = 'source-over'` after any change, as every draw function here does.

For a new system, add two functions:
- `drawXxx()` for its sprites, in layer 6 (into DL with a `k`) or layer 8;
- `drawXxxFx()` for its light, in layer 9.

Call them from `render()` at those places.

---

## 6. UI rules

### 6.1 The font

- A 5x7 pixel font (`GL` in art.js) drawn with `text(s, x, y, col, o)`. **Everything is upper case** (text() makes it upper case).
- Allowed characters: `A–Z 0–9 space . , : ! ? + - / % ' ( ) > < = # * [ ] & $ ×`.
- Any other character shows as `?`. That includes `"`, `;`, `_`, `@`, accents and long dashes. Check your strings.
- There is no star glyph. A 5x5 star sprite already exists: `ICON.star` (sprites.js:684). Use it (scaled or recoloured at start-up) for stars.
- `text()` options:
  - `scale`: 1 for almost everything, 2 for banners and big counts.
  - `align`: `'center'` or `'right'`.
  - `outline`: a colour, or `false`. The default is a dark `#07080a` outline, so text reads on any ground.
  - `drop`: an extra shadow below, for big titles.
- `text()` returns the width.
- Measure with `tw(s, scale)`. Wrap with `wrap(s, w)` (tree.js).
- Text images are cached (`TXC`). Do not draw many different strings every frame (like a timer with decimals in many places). Round numbers so the cache keeps working.

### 6.2 Words

- **Simple English, short.** One idea per line.
  - Tips are one sentence: "KILLS GIVE SCRAP. SCRAP BUYS UPGRADES."
  - Node descriptions are one sentence that fits `INFO_W - 14` px. Test with `__sr.infoFit()`.
- Use the exact tip texts from FINAL_DESIGN 4 and 8.5.
- **Tips show once per save.** Use `tip(key, msg, at)`, `bannerOnce(key, ...)`, `radioOnce(key, who, msg)` and `task(key, ...)` from tut.js. They record the key in `SAVE.seen`.
- **Only one tip shows at a time.** The tip queue (`TUT.tipQ`) already does that. The next tip waits.

### 6.3 Panels, cards, buttons

- `panel(x, y, w, h, bg)` for boxes, `card(...)` for weapon and plane cards (icon, name, tag on the right, a bar), `button(x, y, w, h, label, o)` for buttons.
  - `o.primary` = gold, `o.danger` = red, `o.off` = greyed.
- `frame()` is a 1 px box without corner pixels. `corners()` draws L-shaped target marks. `bar()` draws a progress bar.
- Cards are 26 px tall, in a row at the bottom left (`drawUnitCards`, `drawRamCard`, `drawStrafeCard`). The bar shows the cooldown or the charges.
- A ready card blinks its tag. An armed card blinks its frame `#ffd36a` / `#b8862f` with `realT * 8`.
- The **planes band** (FINAL_DESIGN 6.2) is a thin band about 18 px tall **below the play area**. The world view must end above it, so it never covers zombies or the train. Draw it like the top bar: `rgba(6,7,9,0.88)` with a `#24272e` line.

### 6.4 Info lines: NOW > NEXT

- Every stat line in the tree tooltip is `LABEL NOW > NEXT` (`statSegs()` in tree.js): label in `U.dim`, NOW in `U.ink`, `>` in `U.faint`, NEXT in `U.green`.
- When the node is maxed, or the value does not change, show only NOW.
- The numbers come from the `UP` functions (game.js, tree.js), the same ones the game reads through `G.up`. **Never type a number into a description that the code does not read.**
- Use the format helpers: `pctS`, `perS`, `secs`, `metres`.

### 6.5 Where UI may go

- **Never cover the zombies or the train with UI during play.**
  - Top: the 18 px top bar and the one-line warnings under it.
  - Bottom left: cards. Bottom right: radar.
  - Banners: only for big moments, 2.2 s.
- Arrows at the screen edge (`edgeArrow`) point to things out of view. Do not use big boxes over the field.
- UI animation uses `realT` (real time), so it still moves during hit-stop and pause. Game effects use the step's `dt`.

---

## 7. Performance rules

The game runs at 60 fps: a fixed `STEP = 1/60` and at most 8 steps a frame (main.js).

Measured in headless Chrome with the busy-fight scenario of `tools/README.md` section 6 (about 290 zombies):
- `__sr.bench(60)` (render + UI) ≈ 3.3 ms;
- `__sr.cost(20).render` ≈ 2.7 ms, and `renderNoDead` ≈ 0.4 ms;
- `__sr.landBench(5).full` ≈ 2.2 ms per chunk.

Run that scenario in BUILD_PLAN T0.1 and note your own baseline. **The rule: `__sr.bench(60)` stays under 8 ms in a busy fight, and one new system adds at most about 1 ms.** If a frame costs more than 12 ms, find the cause and fix it. (`stats().fps` and `worstMs` are always 0 headless, because only the real `loop()` updates them. Do not use them.)

- **Particle caps:** 2600 particles in all, about 260 glowing (`part()` returns `null` past them). Other caps:

| List | Cap |
|---|---|
| `texts` | 40 |
| `coins` | 45–60 |
| `JUICE.gibs` | 60 |
| `JUICE.debris` | 24 |
| `JUICE.pools` | 50 |
| `JUICE.coins` | 70 |
| `flames` | 30 |
| `HITS` | 60 |
| `BOOMS` | 80 (and only `BOOM_STEP = 6` go off per step) |
| flying bodies (`room = bs.length < 160`) | 160 |
| `STRAF.embers` | 200 |

  Every new list gets a cap like these.
- **Skip work out of view.** Use `offView(x, y, margin)` before you spawn effects (`juiceKill`, `popKill`, `bloodPool` all do).
- **No heavy math per zombie per frame.**
  - Use `queryEll()` (grid) for area checks.
  - Use `railX()` / `railLocal()` (the row cache in horde.js) instead of `trackX()` / `trackLocal()` in per-zombie code.
  - Look for targets every 0.1–0.25 s, not every step (`HC.look`, the cannon's `g.look`).
- **Cached drawing:**
  - `pcirc()` caches circles of radius 3–24.
  - `pell()` caches ellipses.
  - `text()` caches strings.
  - `glow()` caches glow sprites per colour (put new colours in `GLOW_COLS`).
  - Ground chunks are baked once (`bakeChunk`, about 1 ms each, at most 1 extra per frame through `bakeSome`).
- **Decals, not lists:** marks that stay are painted into the decal chunks (`stampPix` / `stampSpr`). Never keep an array of splats to redraw every frame.
- **Atlas:** make sprites at start-up (section 3.4). A sprite made in play costs a late page or a slow draw.
- Do not use `getImageData` / `putImageData` in a frame. The crowd layer is the only exception, on purpose.
- Do not use canvas `shadowBlur`, filters, `arc()` + `stroke()` in the world, or gradients made each frame. The skill tree's `tGlow` builds its gradient once per colour.

---

## 8. DO and DON'T

**DO**
- Light every sprite from the top left. Cast shadows down-right with `SUNX` / `SUNY`.
- Squash every ground circle and ground speed by `FORE`.
- Give every weapon a flash, a hit, a mark, and a feel (shake, hit-stop, sound). Follow the cannon and strafe recipes.
- Make the first level of every node change what the player sees (FINAL_DESIGN rule "See the change"). Bigger hit flash for damage, wider ring for range, a faster filling clock for cooldown.
- Use `kill()` / `hitZombie()` / `queryEll()` for all damage, with the blast pattern of 4.8.
- Let blood and splats stay on the ground. Keep the ground clean otherwise.
- Use `SFX` sounds (add new ones in audio.js with `tone()` / `nz()` and `gap()` limits).
- Guard shake, hit-stop, sound and floating text with `!G.demo`.
- Keep the thermal camera and `REDUCED` (reduced motion) working.
- Take a screenshot and compare it with `docs/style/` after every visual change.

**DON'T**
- **Don't add bullet tracers or bullet lines to the heli.** The heli shows only the muzzle flash and the hit (`drawHeliRound` draws nothing for nose-gun rounds).
- Don't darken or tint the whole screen. No colour grades, no night, no heavy vignette, no fog. The only screen flash is the short warm `JUICE.flash` of a big blast.
- Don't cover zombies with UI, and don't leave big effects on screen for long. Smoke must be see-through and must drift.
- Don't make effects that hide the zombies for more than about 0.5 s (huge full-screen glows, thick smoke over a crowd).
- Don't use smooth scaling, sub-pixel positions, canvas anti-aliased shapes, or blur in the world.
- Don't load image, sound or font files, and don't add libraries.
- Don't put bullet holes or scorch on the ground for small guns. Scorch is for blasts.
- Don't show a `+N` for every small kill in a horde.
- Don't add new colours when a palette colour fits. No pure neon colours in the world: neon belongs to the skill tree.
- Don't make sprites during play, and don't call `tint()` / `outline()` in a draw function.
- Don't use gold text for scrap once gold exists (see 2.7).
- Don't regenerate or overwrite the pictures in `docs/style/`.

---

## 9. Code style

- **Plain JavaScript in one scope.**
  - `build.py` joins the files in `ORDER` into `index.html`, inside one function with `'use strict'`.
  - No modules, no `import`, no classes, no build tools, no TypeScript.
  - Everything is a top-level `function` or `const`. Use plain objects and arrays.
  - **All files share one scope.** Before you add a top-level name, grep it (`grep -n "NAME" src/*.js`). A second `const` with the same name is a SyntaxError and the whole build stops. Names like `FIRES`, `CARS`, `DL`, `TREES`, `VZ`, `HITS`, `BOOMS`, `NEAR` and `KILLED` are already taken.
- **New game files go BEFORE `main.js` in `ORDER`** (for example after `planes.js`). Every task in BUILD_PLAN names the place. Reason: `main.js` calls `boot()` the moment it loads, and boot builds the demo game (`newGame(true)`). If boot touches a top-level `const` from a file that loads later, the game fails with "Cannot access before initialization". A file before `main.js` can bake its sprites at load time with a top-level call, like `bakeJet();` in planes.js.
- **Test helpers never go in a game file.** `window.__sr` does not exist until `boot()` runs, so `Object.assign(window.__sr, ...)` at the end of a file before `main.js` throws. Put helpers in `src/test_f.js` (after `main.js` in `ORDER`, see BUILD_PLAN). `cannon.js`, `loot.js` and `tut.js` hold their own helpers only because they load after `main.js`. Do not copy that.
- **Each file starts with a header comment.** It says what the file holds, in simple English, and lists its **Hooks**: which of its functions are called from where. See juice.js and land.js. An example for a **new** file (these names do not exist yet):

  ```js
  // pods.js - the ROCKET PODS: every few seconds a salvo of small rockets at the biggest crowd near
  // the heli. Each rocket flies in an arc with a short smoke trail and blows up where it lands.
  // Hooks: updatePods (step), drawPods (render, with the other effects), drawPodsFx (render, the 'lighter' pass).
  ```

- **Sections** are marked with `// ---------- name`.
- **Short functions with a comment above each one.** The comment says what it does in one or two simple sentences.
- **Constants:**
  - Tuning numbers go in one small object at the top of the file. Each field has a short comment with its unit (px, s, px/s), like `HC`, `JETC`, `SK`, `LOOT`, `TOWER`.
  - Numbers that come from the tree go into `UP` (`Object.assign(UP, {...})`) and are read through `G.up` (see `treeUp()` in tree.js).
- **Names:** short and clear, in the code's habits. `G` = the game state, `S` = a zombie's sprite set, `z` = a zombie, `h` = a heli, `x, y, z` = ground position and height, `dt` = step time.
- **State per run:** reset lists when a new run starts, with the pattern `if (STRAF.g !== G) {...}` (`srSync`) or `if (J.g !== G)` (`updateJuice`).
- **Hook calls:** call your `updateXxx(dt)` from `step()` in game.js and your draw functions from `render()` (section 5).
- **Test helpers:** add calls for the qa scenarios to `src/test_f.js`, with a one-line comment each. An example (the names are new):

  ```js
  Object.assign(window.__sr, {
    // the pods now: ready or not, rockets per salvo, rockets in the air
    pods: () => ({ ready: PODS.cd <= 0, salvo: PODS.salvo, inAir: PODS.rockets.length }),
    // fire a salvo now
    podsFire: () => podsFire()
  });
  ```

- **Formatting:** 2-space indent, single quotes, semicolons. Lines may be long (up to about 160 characters), as in the current code.
- **Testing:**
  - After every change, run `node tools/qa.js run tools/examples/run_smoke.js`. `qaErrors` must be `[]`.
  - Then run `node tools/qa.js run tools/examples/run_loop.js`.
  - For visual work, write a shot scenario in `tools/scenarios/`, run it once in run mode to check `qaErrors`, take the shot, look at it, and compare it with `docs/style/`.
  - For close-ups, use the `1200 1080` window or `tools/crop.py`.
  - Outputs go to `tools/out/` (git-ignored).

---

## 10. Checklist before you say "done"

1. `run_smoke.js` and `run_loop.js` pass with no `qaErrors`.
2. A screenshot of the new feature sits next to the matching `docs/style/` picture and looks like the same game: same brightness, outlines, light direction, effect size, red carpet.
3. Zombies are still readable during your biggest effect.
4. `__sr.bench(60)` is still under 8 ms in a busy fight, and at most about 1 ms above the baseline you noted in T0.1.
5. Every new string uses only the font's characters and fits its box.
6. Every new sprite is made at start-up, is in the atlas (`atl()`), and has a thermal copy. `__sr.late()` is not higher than the T0.1 baseline (today 1 after the first frames).
7. Nothing in the world uses smoothing, blur, or a full-screen darkening.
8. The heli still has no tracers.
9. No new top-level name clashes with an existing one, and `docs/style/` is unchanged.
