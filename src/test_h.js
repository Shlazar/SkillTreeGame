// test_h.js - test calls for the helicopters (helis.js) and mouse input, added to window.__sr after start-up.
Object.assign(window.__sr, {
  // helis(): the Viper's place (from the engine's nose), order, target and retained 105 reload.
  helis: () => G.helis.map((h) => ({ name: h.name, x: Math.round(h.x), y: Math.round(h.y), dx: Math.round(h.x - G.tr.fx), dy: Math.round(h.y - G.tr.fy),
    hd: +h.hd.toFixed(2), alt: Math.round(h.alt), sel: h.sel, order: h.order ? h.order.kind : 'escort', tgt: h.tgt ? h.tgt.st : -1,
    heR: +h.heR.toFixed(2), sx: Math.round(h.x - G.camX), sy: Math.round(h.y - h.alt - G.camY) })),
  // the mouse as a player uses it, in game px: lclick(x, y) / drag(x0, y0, x1, y1) / rclick(x, y)
  lclick: (x, y, shift) => {
    M.x = x; M.y = y; M.inside = true; M.down = true;
    heliDown(x, y, !!shift);
    M.down = false;
    heliUp(x, y);
  },
  drag: (x0, y0, x1, y1) => {
    M.inside = true; M.down = true;
    heliDown(x0, y0, false);
    M.x = x1; M.y = y1;
    M.down = false;
    heliUp(x1, y1);
  },
  rclickH: (x, y) => heliRight(x, y),
  // A right click in game px, with one frame drawn.
  rclick: (x, y) => {
    window.__sr.rightDown(x, y);
    window.__sr.rightUp(x, y);
    render();
    drawUI();
    M.rpressed = false;
  },
  // Selection injection is retained to test that ordinary right clicks always command the Viper.
  sel: (...ids) => { for (const h of G.helis) h.sel = ids.includes(h.i); },
  heliKey: (k) => heliKey(k),
  // order(i, kind, a, b): give heli i an order: 'attack' (a = zombie), 'move' (a, b = world px), 'escort'
  order: (i, kind, a, b) => {
    const h = G.helis[i];
    h.order = kind === 'attack' ? { kind, z: a } : kind === 'move' ? { kind, x: a, y: b } : null;
    h.cmdT = realT;
  },
  heFire: (x, y) => heFire(G.camX + x, G.camY + y),
  heArm: (on) => (HUI.arm = !!on && G.up.he),
  // boxFrom(x, y): the left button is held down from (x, y): a drag box shows to the mouse
  boxFrom: (x, y) => { HUI.box = { x0: x, y0: y, shift: false }; M.down = true; },
  heliMarks: () => HUI.marks.length
});
