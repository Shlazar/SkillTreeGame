// Run mode: a fresh run has no free Ram, gate crowd or boiler radio; station nodes are gone.
__sr.reset();
const nodes = __sr.treeNodes();
const removedIds = ['farm', 'nestspd', 'wire', 'mortar'];
const removed = nodes.filter((node) => removedIds.includes(node.id)).map((node) => node.id);
if (removed.length) throw new Error('Station nodes remain: ' + removed.join(', '));
const ids = new Set(nodes.map((node) => node.id));
if (nodes.some((node) => !Object.prototype.hasOwnProperty.call(node, 'p'))) {
  throw new Error('treeNodes does not expose parents for the orphan check');
}
const orphans = nodes.filter((node) => node.p && !ids.has(node.p)).map((node) => node.id);
if (orphans.length) throw new Error('Nodes have missing parents: ' + orphans.join(', '));
for (const key of ['taste', 'tasteDur', 'prompt']) {
  if (key in __sr.CFG.ram) throw new Error('Old Ram config remains: ' + key);
}
if ('nest' in __sr.CFG || 'wire' in __sr.CFG) throw new Error('Old station config remains');

__sr.start();
__sr.bot(true);
const initialRail = __sr.G.zombies.filter((zombie) => zombie.st === 1).length;
if (initialRail > 5) throw new Error('First run still starts with a gate crowd: ' + initialRail);
const radios = new Set();
function freshRunState() {
  const game = __sr.G;
  if (game.up.ram || game.ram.on || game.ram.card || game.ram.uses !== 0 || __sr.ramState() !== 'none') {
    throw new Error('Fresh run received an unowned Ram');
  }
  if ('taste' in game || 'prompt' in game || 'taste' in game.ram) {
    throw new Error('Old taste or prompt state remains');
  }
  if (game.zombies.some((zombie) => zombie.gate)) throw new Error('A first-run gate zombie remains');
  const flags = Object.keys(__sr.SAVE.flags).filter((key) => /taste|pressE/.test(key));
  if (flags.length) throw new Error('Old first-run flags remain: ' + flags.join(', '));
  const radio = __sr.tutState().radio;
  if (radio) {
    radios.add(radio);
    if (/BOILER|FULL STEAM|DEAD ON THE TRACK/i.test(radio)) {
      throw new Error('Old boiler radio appeared: ' + radio);
    }
  }
}
freshRunState();
// Whole frames let delayed radio lines and tutorial UI appear, rather than skipping their drawing.
for (let sample = 0; sample < 80; sample++) {
  __sr.frames(6);
  freshRunState();
}
const fresh = __sr.stats();

// Keep this setup identical to t0_6_cleanup_shot.js so run mode catches its drawing errors.
__sr.reset();
__sr.start();
__sr.bot(true);
__sr.sim(8);
__sr.frames(30);
__sr.hold(true);
freshRunState();
QA_DONE({
  removed,
  orphans,
  initialRail,
  ram: fresh.ram,
  radio: [...radios],
  mode: fresh.mode,
  seconds: fresh.t,
  flags: __sr.save().flags,
  shotRamState: __sr.ramState()
});
