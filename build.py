#!/usr/bin/env python3
"""Join src/ into index.html: the page shell with every script inlined in one scope."""
from pathlib import Path

ROOT = Path(__file__).parent
ORDER = ['core.js', 'art.js', 'sprites.js', 'world.js', 'fx.js', 'audio.js', 'game.js', 'station.js', 'towers.js', 'skills.js', 'helis.js', 'juice.js', 'scenery.js', 'render.js', 'ui.js', 'depot.js', 'tree.js', 'planes.js', 'stationtab.js', 'main.js', 'loot.js', 'tut.js', 'cannon.js', 'test_a.js', 'test_h.js', 'test_j.js', 'test_t.js']

shell = (ROOT / 'src' / 'shell.html').read_text()
code = '\n'.join((ROOT / 'src' / name).read_text() for name in ORDER)
script = "<script>\n(() => {\n'use strict';\n" + code + "\n})();\n</script>"
assert '<!-- SCRIPT -->' in shell
(ROOT / 'index.html').write_text(shell.replace('<!-- SCRIPT -->', script))
print('index.html', len((ROOT / 'index.html').read_text()) // 1024, 'KB')
