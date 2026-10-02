#!/usr/bin/env python3
"""Join src/ into index.html: the page shell with every script inlined in one scope."""
from pathlib import Path

ROOT = Path(__file__).parent
ORDER = ['core.js', 'world.js', 'zombies.js', 'fx.js', 'game.js', 'hud.js', 'app.js']

shell = (ROOT / 'src' / 'shell.html').read_text()
code = '\n'.join((ROOT / 'src' / name).read_text() for name in ORDER)
script = "<script>\n(() => {\n'use strict';\n" + code + "\n})();\n</script>"
assert '<!-- SCRIPT -->' in shell
(ROOT / 'index.html').write_text(shell.replace('<!-- SCRIPT -->', script))
print('index.html', len((ROOT / 'index.html').read_text()) // 1024, 'KB')
