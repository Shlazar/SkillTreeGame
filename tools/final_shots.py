#!/usr/bin/env python3
"""Capture the 25 BUILD_PLAN visual tasks sequentially after their latest passing checks."""
import json
import os
from pathlib import Path
import re
import shutil
import struct
import subprocess
import time

ROOT = Path(__file__).resolve().parent.parent
OUT = (ROOT / 'tools' / 'out').resolve()
FINAL = OUT / 'final'
SHOTS = [
    ('T1.4', 't1_4_big_shot'), ('T1.7', 't1_7_hud_shot'), ('T1.8', 't1_8_depot_shot'),
    ('T2.2', 't2_2_gold_shot'), ('T2.6', 't2_6_pops_shot'),
    ('T3.2', 't3_2_range4_shot'), ('T3.3', 't3_3_trail_shot'), ('T3.4', 't3_4_salvo_shot'),
    ('T3.5', 't3_5_burn_shot'), ('T3.6', 't3_6_curve_shot'),
    ('T4.1', 't4_1_with_shot'), ('T4.3', 't4_3_over_shot'), ('T4.4', 't4_4_four_shot'),
    ('T4.5', 't4_5_pass_shot'), ('T4.6', 't4_6_mid_shot'), ('T4.7', 't4_7_hangar_shot'),
    ('T5.1', 't5_1_mg_shot'), ('T5.2', 't5_2_launch_shot'), ('T5.4', 't5_4_burst_shot'),
    ('T6.3', 't6_3_mid_shot'), ('T6.4', 't6_4_runner_shot'), ('T6.5', 't6_5_winch_shot'),
    ('T6.6', 't6_6_variants_shot'), ('T6.7', 't6_7_hud_shot'), ('T6.9', 't6_9_strike_shot'),
]


def under_out(path):
    resolved = path.resolve()
    if not resolved.is_relative_to(OUT) or resolved == OUT:
        raise RuntimeError('Output path escapes tools/out: ' + str(resolved))
    return path


def png_info(path):
    data = path.read_bytes()
    if len(data) < 64 or data[:8] != b'\x89PNG\r\n\x1a\n' or data[12:16] != b'IHDR':
        raise RuntimeError('Capture is empty or has an invalid PNG header: ' + str(path))
    if struct.unpack('>I', data[8:12])[0] != 13 or data[-8:-4] != b'IEND':
        raise RuntimeError('Capture has an invalid PNG structure: ' + str(path))
    width, height = struct.unpack('>II', data[16:24])
    if (width, height) != (1280, 720):
        raise RuntimeError('Unexpected capture dimensions: ' + str((width, height)))
    return {'width': width, 'height': height, 'bytes': len(data)}


def main():
    tagged = set(re.findall(r'^###\s+(T\d+\.\d+)\b[^\n]*\[VISUAL\]',
                            (ROOT / 'BUILD_PLAN.md').read_text(encoding='utf-8-sig'), re.M))
    expected = {task for task, _ in SHOTS}
    if len(SHOTS) != 25 or len(expected) != 25 or tagged != expected:
        raise RuntimeError('Visual task mapping differs from BUILD_PLAN: ' +
                           str({'missing': sorted(tagged - expected), 'extra': sorted(expected - tagged)}))
    checks = json.loads((OUT / 't8_5_all.json').read_text(encoding='utf-8-sig'))
    latest = {record['file']: record for record in checks['records']}
    for task, stem in SHOTS:
        source = ROOT / 'tools' / 'scenarios' / (stem + '.js')
        record = latest.get(source.name)
        if not source.is_file() or not record or record.get('passed') is not True or record.get('qaErrors') != []:
            raise RuntimeError(task + ' has no latest passing scenario check: ' + source.name)

    under_out(FINAL).mkdir(parents=True, exist_ok=True)
    manifest_path = under_out(FINAL / 'manifest.json')
    manifest = {'total': 25, 'completed': 0, 'status': 'capturing', 'budgetMs': 3000,
                'viewport': {'width': 1280, 'height': 720},
                'validatedAgainst': 'tools/out/t8_5_all.json', 'records': []}

    def write_manifest():
        manifest_path.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8')

    write_manifest()
    env = os.environ.copy()
    env.pop('QA_REDUCED', None)
    env['QA_REPO'] = str(ROOT)
    node = shutil.which('node') or 'C:/Program Files/nodejs/node.exe'
    for index, (task, stem) in enumerate(SHOTS, 1):
        source = ROOT / 'tools' / 'scenarios' / (stem + '.js')
        target = under_out(FINAL / (task.lower().replace('.', '_') + '.png'))
        # Delete this one guarded filename so qa.js cannot accept a stale screenshot.
        if target.exists() or target.is_symlink():
            target.unlink()
        record = {'task': task, 'scenario': source.relative_to(ROOT).as_posix(),
                  'png': target.relative_to(ROOT).as_posix(),
                  'latestCheck': latest[source.name]['output'], 'passed': False}
        print(f'CAPTURE {index}/25 {task} {source.name}', flush=True)
        tick = time.perf_counter()
        try:
            result = subprocess.run([node, 'tools/qa.js', 'shot', str(source), str(target),
                                     '3000', '1280', '720'], cwd=ROOT, env=env,
                                    capture_output=True, text=True, encoding='utf-8',
                                    errors='replace', timeout=360)
            record['exit'] = result.returncode
            if result.returncode != 0:
                raise RuntimeError((result.stderr or result.stdout or 'Screenshot runner failed')[-1800:])
            record.update(png_info(target))
            record['passed'] = True
        except Exception as error:
            record['error'] = str(error)
            manifest['status'] = 'failed'
        record['seconds'] = round(time.perf_counter() - tick, 2)
        manifest['records'].append(record)
        manifest['completed'] = len(manifest['records'])
        if index == 25 and record['passed']:
            manifest['status'] = 'complete'
        write_manifest()
        if not record['passed']:
            raise RuntimeError(task + ' capture failed: ' + record['error'])
        print('SAVED ' + record['png'], flush=True)
    print('Captured 25 verified PNGs; tools/out/final/manifest.json is complete.', flush=True)


if __name__ == '__main__':
    main()
