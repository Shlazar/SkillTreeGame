// Run mode: the Depot has only its tree tab, and generic right-click testing still works.
__sr.give(400, 6);
__sr.depot('tree');
__sr.press('Tab');
__sr.frames(30);
if (__sr.treeState().tab !== 'tree') throw new Error('Tab left the tree');
if (typeof __sr.rclick !== 'function') throw new Error('Missing right-click helper');
__sr.rclick(12, 25);
__sr.depot('station');
__sr.frames(30);
if (__sr.treeState().tab !== 'tree') throw new Error('Removed tab is still reachable');
QA_DONE({mode: __sr.mode, tab: __sr.treeState().tab, rclick: typeof __sr.rclick});
