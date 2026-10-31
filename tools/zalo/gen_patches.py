#!/usr/bin/env python3
"""Generate zalo-patches/ from an official Zalo app tree and our modified tree.

Developer tool, run once per Zalo base version (or after editing a patched file):

    python3 -I tools/zalo/gen_patches.py <official-app-dir> <modified-zalo_source-dir> <out-dir>

<official-app-dir> is the extracted app.asar of the official installer (see fetch.js).
Writes <out-dir>/files/<path>.json (one list of find/replace edits per modified Zalo file)
and prints the "remove" list (paths present in the official app but deleted in ours).
Files we own entirely (OVERLAY) are skipped; they live in the repo as-is.
"""
import hashlib
import json
import os
import re
import sys

OVERLAY_PREFIXES = (
    'bootstrap.js',
    'linux_compat/',
    'native/nativelibs/sqlite3/binding/napi-v6-linux-x64/',
)
TOKEN_RE = re.compile(r'([;,{}()\[\]\n])')
MIN_CONTEXT = 24


def sha256(data):
    return hashlib.sha256(data).hexdigest()


def tokens(text):
    return [t for t in TOKEN_RE.split(text) if t]


def token_hunks(a, b):
    """Token-level diff via `git diff --histogram` (fast on multi-MB minified files).
    Returns opcodes (i1, i2, j1, j2) over token indices for every non-equal region."""
    import subprocess
    import tempfile
    esc = lambda t: t.replace('\\', '\\\\').replace('\n', '\\n')
    with tempfile.TemporaryDirectory() as tmp:
        fa, fb = os.path.join(tmp, 'a'), os.path.join(tmp, 'b')
        with open(fa, 'w', encoding='utf-8') as f:
            f.write(''.join(esc(t) + '\n' for t in a))
        with open(fb, 'w', encoding='utf-8') as f:
            f.write(''.join(esc(t) + '\n' for t in b))
        out = subprocess.run(['git', 'diff', '--no-index', '--histogram', '-U0', '--no-color', fa, fb],
                             capture_output=True, text=True).stdout
    ops = []
    for m in re.finditer(r'^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@', out, re.M):
        s1, n1 = int(m.group(1)), int(m.group(2) if m.group(2) is not None else 1)
        s2, n2 = int(m.group(3)), int(m.group(4) if m.group(4) is not None else 1)
        i1 = s1 if n1 == 0 else s1 - 1   # with count 0 git reports the line *before* the gap
        j1 = s2 if n2 == 0 else s2 - 1
        ops.append((i1, i1 + n1, j1, j1 + n2))
    return ops


def make_edits(old, new):
    """Return find/replace edits that turn `old` into `new`, each `find` unique when applied in order."""
    a, b = tokens(old), tokens(new)
    a_off = [0]
    for t in a:
        a_off.append(a_off[-1] + len(t))
    b_off = [0]
    for t in b:
        b_off.append(b_off[-1] + len(t))

    hunks = [[a_off[i1], a_off[i2], b_off[j1], b_off[j2]] for i1, i2, j1, j2 in token_hunks(a, b)]

    # merge hunks that are close together
    merged = []
    for h in hunks:
        if merged and h[0] - merged[-1][1] < 2 * MIN_CONTEXT:
            merged[-1][1] = h[1]
            merged[-1][3] = h[3]
        else:
            merged.append(h)

    edits = []
    current = old
    shift = 0  # offset difference between `current` and `old` for positions after applied edits
    for o1, o2, n1, n2 in merged:
        replacement_mid = new[n1:n2]
        c1, c2 = o1 + shift, o2 + shift
        left = right = MIN_CONTEXT
        while True:
            s = max(0, c1 - left)
            e = min(len(current), c2 + right)
            find = current[s:e]
            if current.count(find) == 1:
                break
            left *= 2
            right *= 2
            if s == 0 and e == len(current):
                break
        replace = current[s:c1] + replacement_mid + current[c2:e]
        edits.append({'find': find, 'replace': replace})
        current = current[:s] + replace + current[e:]
        shift += len(replacement_mid) - (o2 - o1)
    if current != new:
        raise RuntimeError('edit simulation did not reproduce the modified file')
    return edits


def walk(root):
    out = set()
    for d, dirs, files in os.walk(root):
        for f in files:
            out.add(os.path.relpath(os.path.join(d, f), root))
    return out


def main():
    official, modified, out_dir = sys.argv[1:4]
    off_files = walk(official) - {'.complete'}  # cache marker written by zalo_runtime.js
    mod_files = walk(modified)
    files_dir = os.path.join(out_dir, 'files')
    import shutil
    shutil.rmtree(files_dir, ignore_errors=True)  # drop patches for files that are no longer modified
    os.makedirs(files_dir, exist_ok=True)

    patched = []
    for rel in sorted(off_files & mod_files):
        if rel.startswith(OVERLAY_PREFIXES):
            continue
        with open(os.path.join(official, rel), 'rb') as f:
            o = f.read()
        with open(os.path.join(modified, rel), 'rb') as f:
            m = f.read()
        if o == m:
            continue
        edits = make_edits(o.decode('utf-8'), m.decode('utf-8'))
        target = os.path.join(files_dir, rel + '.json')
        os.makedirs(os.path.dirname(target), exist_ok=True)
        with open(target, 'w', encoding='utf-8') as f:
            json.dump({'path': rel, 'base_sha256': sha256(o), 'result_sha256': sha256(m), 'edits': edits},
                      f, ensure_ascii=False, indent=1)
        size = sum(len(e['find']) + len(e['replace']) for e in edits)
        patched.append(rel)
        print(f'patch  {rel}: {len(edits)} edits, {size} chars', file=sys.stderr)

    # Directories/files that exist only in the official tree (Windows binaries we drop).
    removed = sorted(off_files - mod_files)
    roots = []
    for rel in removed:
        if any(rel == r or rel.startswith(r + '/') for r in roots):
            continue
        # collapse to the highest directory whose files are all removed
        parts = rel.split('/')
        best = rel
        for i in range(1, len(parts)):
            d = '/'.join(parts[:i])
            if not any(x == d or x.startswith(d + '/') for x in mod_files):
                best = d
                break
        roots.append(best)
    manifest_path = os.path.join(out_dir, 'manifest.json')
    if os.path.exists(manifest_path):
        with open(manifest_path, encoding='utf-8') as f:
            manifest = json.load(f)
        manifest['patched'] = patched
        # The runtime cache already has these removed, so keep the known list as well.
        manifest['remove'] = sorted(set(manifest.get('remove', [])) | set(roots))
        with open(manifest_path, 'w', encoding='utf-8') as f:
            json.dump(manifest, f, indent=2)
            f.write('\n')
        print(f'updated {manifest_path}: {len(patched)} patched files', file=sys.stderr)
    else:
        print(json.dumps({'patched': patched, 'remove': sorted(set(roots))}, indent=1))


if __name__ == '__main__':
    main()
