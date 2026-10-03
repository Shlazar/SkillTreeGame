// Shot mode: owned VIPER and exactly four starter upgrades, with unrevealed currencies.
function startTree() {
  __sr.hold(false);
  __sr.reset();
  __sr.depot('tree');
  __sr.treeCam(0, 0, 1);
  __sr.frames(120);
}

startTree();

