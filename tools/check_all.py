#!/usr/bin/env python3
"""Run saved game scenarios one after another, including frozen screenshot setups."""
import argparse
import json
import os
from pathlib import Path
import re
import subprocess
import time

ROOT = Path(__file__).resolve().parent.parent
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--match', default='', help='Optional filename regular expression for focused reruns')
parser.add_argument('--name', default='t8_5_all', help='Output summary name under tools/out')
args = parser.parse_args()
out = ROOT / 'tools' / 'out' / args.name
out.mkdir(parents=True, exist_ok=True)
scenarios = sorted((ROOT / 'tools' / 'scenarios').glob('*.js'))
if args.match:
    scenarios = [p for p in scenarios if re.search(args.match, p.name)]
if not scenarios:
    parser.error('No scenarios matched')
records = []
started = time.perf_counter()
for index, source in enumerate(scenarios, 1):
    print(f'RUN {index}/{len(scenarios)} {source.name}', flush=True)
    code = source.read_text(encoding='utf-8-sig')
    scenario = source
    if not re.search(r'\bQA_DONE\s*\(', code):
        scenario = out / ('setup_' + source.name)
        scenario.write_text(code + '\n__sr.frames(30);\nQA_DONE({shotSetup: true, late: __sr.late()});\n', encoding='utf-8')
    env = os.environ.copy()
    env.pop('QA_REDUCED', None)
    if source.name == 't8_3_reduced.js':
        env['QA_REDUCED'] = '1'
    tick = time.perf_counter()
    # A blocking child is intentional: Chrome shares one profile, so no two checks may overlap.
    result = subprocess.run(['node', 'tools/qa.js', 'run', str(scenario)], cwd=ROOT,
                            env=env, capture_output=True, text=True, encoding='utf-8', errors='replace')
    raw = out / (source.stem + '.json')
    raw.write_text(result.stdout, encoding='utf-8')
    try:
        data = json.loads(result.stdout)
        errors = data.get('qaErrors', [])
        if data.get('error'):
            errors = errors + [data['error']]
        passed = result.returncode == 0 and data.get('qaErrors') == [] and not data.get('error')
    except (ValueError, TypeError):
        errors = [result.stderr[-1800:] or result.stdout[-1800:] or 'No runner output']
        passed = False
    record = {'file': source.name, 'passed': passed, 'exit': result.returncode,
              'seconds': round(time.perf_counter() - tick, 2), 'qaErrors': errors,
              'output': raw.relative_to(ROOT).as_posix()}
    records.append(record)
    summary = {'total': len(scenarios), 'completed': len(records), 'passed': sum(r['passed'] for r in records),
               'failed': [r for r in records if not r['passed']], 'records': records,
               'seconds': round(time.perf_counter() - started, 2)}
    (ROOT / 'tools' / 'out' / (args.name + '.json')).write_text(json.dumps(summary, indent=2), encoding='utf-8')
    print(('PASS ' if passed else 'FAIL ') + source.name + ('' if passed else ': ' + str(errors)[0:240]), flush=True)
print(json.dumps({k: v for k, v in summary.items() if k not in ('records', 'failed')}), flush=True)
raise SystemExit(0 if not summary['failed'] else 1)
