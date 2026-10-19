#!/usr/bin/env python3
"""Regenerates sw.js and version.json: the precache list and a version hash of every shipped file.

Run before every release: python3 tools/build-sw.py
"""
import hashlib
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SKIP_DIRS = {'.git', 'supabase', 'shots', 'tools', 'node_modules'}
SKIP_FILES = {'sw.js', 'version.json', 'LICENSE', '.DS_Store'}
SHIP_EXT = {'.html', '.js', '.css', '.png', '.svg', '.json', '.webmanifest', '.txt', '.mp3', '.woff2'}

files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    dirnames[:] = sorted(d for d in dirnames if d not in SKIP_DIRS and not d.startswith('.'))
    for name in sorted(filenames):
        rel = os.path.relpath(os.path.join(dirpath, name), ROOT).replace(os.sep, '/')
        if name in SKIP_FILES or os.path.splitext(name)[1] not in SHIP_EXT:
            continue
        files.append(rel)

digest = hashlib.sha256()
urls = []
for rel in files:
    with open(os.path.join(ROOT, rel), 'rb') as f:
        data = f.read()
    digest.update(rel.encode() + b'\0' + data)
    urls.append(rel)
    if rel.endswith('index.html'):
        urls.append(rel[:-len('index.html')] or './')
    if rel.endswith('.html'):
        # Pages reference assets with cache-busting queries (?v=N); cache those exact URLs too.
        base = os.path.dirname(rel)
        for ref in re.findall(r'(?:src|href)="([^"]+\?[^"]+)"', data.decode('utf-8', 'ignore')):
            if '://' in ref or ref.startswith('//'):
                continue
            path, query = ref.split('?', 1)
            full = os.path.normpath(os.path.join(base, path)).replace(os.sep, '/')
            if full in files:
                urls.append(f'{full}?{query}')

version = digest.hexdigest()[:12]
unique = sorted(set(urls), key=lambda u: (u.count('/'), u))
with open(os.path.join(ROOT, 'tools', 'sw.template.js'), encoding='utf-8') as f:
    template = f.read()
sw = template.replace("'__VERSION__'", json.dumps(version)).replace('[/*__PRECACHE__*/]', json.dumps(unique, indent=4, ensure_ascii=False).replace('\n', '\n    '))
with open(os.path.join(ROOT, 'sw.js'), 'w', encoding='utf-8') as f:
    f.write(sw)
with open(os.path.join(ROOT, 'version.json'), 'w', encoding='utf-8') as f:
    f.write(json.dumps({'v': version}) + '\n')
print(f'version {version}, {len(unique)} URLs')
