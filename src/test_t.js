// test_t.js - skill-tree diagnostics and direct plane transport fixtures.
Object.assign(window.__sr, {
  // hoverNode(id) / clickNode(id): as in main.js, but the view first moves so the node is on the panel
  hoverNode: (id) => {
    treeFocus(id);
    testHover = NODE[id] ? id : null;
    const p = nodeXY(id);
    if (p) {
      M.x = p.x;
      M.y = p.y;
      M.inside = true;
    }
    return p;
  },
  clickNode: (id) => {
    treeFocus(id);
    const p = nodeXY(id);
    if (p) window.__sr.click(p.x, p.y);
    return p;
  },
  // treeCam(x, y, z): put the view on cell (x, y) at zoom z (at once); treeCam() = the view now
  treeCam: (x, y, z) => {
    if (x != null) Object.assign(TREE.cam, { x, y, z: z || TREE.cam.z });
    if (z) TREE.zt = z;
    TREE.anchor = TREE.goTo = null;
    return Object.assign({}, TREE.cam);
  },
  treeZoom: (d) => treeZoom(d),
  // strafe is a direct A-10 transport fixture, without consuming AIR charges. Real input tests
  // use plane keys/pointer helpers. strafeState copies current AIR charges and airborne objects.
  strafe: (sx, sy, ux, uy) => {
    srSync();
    const [a, b] = ux != null ? [ux, uy] : strafeDir(sx, sy, sx, sy), l = Math.hypot(a, b) || 1;
    return callStrafe(G.camX + sx, G.camY + sy, a / l, b / l);
  },
  strafeState: () => {
    srSync();
    const a = airSnapshot().find((p) => p.id === 'a10');
    return { left: a?.charges || 0, arm: airAimActive(), jets: STRAF.jets.length, bombs: STRAF.bombs.length, up: a?.maxCharges || 0 };
  },
  treeNodes: () => NODES.map((n) => ({ id: n.id, name: n.name, p: n.p || null, k: n.k, cur: n.cur || 'scrap',
    cost: n.cost.slice(), charge: !!n.charge, star: !!n.star, x: n.x, y: n.y,
    lv: lv(n.id), max: maxLv(n), st: nodeState(n) }))
});
// fx() = how many effects are alive; fxDrop(name) empties one list (tests: what a frame costs)
Object.assign(window.__sr, {
  fx: () => ({ parts: parts.length, lights: lights.length, booms: booms.length, rings: rings.length, embers: STRAF.embers.length, texts: texts.length }),
  fxDrop: (k) => { ({ parts, lights, booms, rings, embers: STRAF.embers })[k].length = 0; }
});
Object.assign(window.__sr, { treeState: () => ({ drag: TREE.drag, M: Object.assign({}, M), tab: depotTab, mode }) });
