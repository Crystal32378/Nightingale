#!/usr/bin/env python3
"""Copy verified fixed-script WAV files; retain originals and record provenance."""
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import wave
from array import array

root = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument('--script', required=True, type=Path)
parser.add_argument('--legacy', required=True, type=Path)
parser.add_argument('--recordings', required=True, type=Path)
args = parser.parse_args()
new = json.loads((args.recordings / 'recordings.json').read_text())
manifest = {'routeId': 'renai-001', 'model': 'gemini-2.5-flash-tts', 'utterances': {}}
copies = []
for line in args.script.read_text().splitlines():
    cells = [c.strip() for c in line.split('|')]
    if len(cells) != 6 or cells[4] == '狀態' or cells[1].startswith('-'):
        continue
    key, text, status = cells[1], cells[3], cells[4]
    item = {'text': text, 'voices': {}}
    for voice, folder in [('Leda', 'female-Leda'), ('Puck', 'male-Puck')]:
        if '新錄' in status:
            entry = new['recordings'][voice + ':' + key]
            assert entry['text'] == text
            src = args.recordings / entry['file']
            assert hashlib.sha256(src.read_bytes()).hexdigest() == entry['sha256']
            provenance = {'generatedAt': entry['generatedAt'],
                          'sourceBatch': args.recordings.name, 'generationStyle': entry.get('generationStyle', new['style']),
                          'listeningReview': entry.get('listeningReview', 'pending')}
            if entry.get('reviewedBy'):
                provenance['reviewedBy'] = entry['reviewedBy']
            if new.get('styleApproval'):
                provenance['styleApprovedBy'] = new['styleApproval']['approvedBy']
        else:
            matches = list((args.legacy / folder).glob('*-' + key + '.wav'))
            assert len(matches) == 1, (voice, key)
            src = matches[0]
            provenance = {'source': src.name, 'sourceBatch': args.legacy.name, 'listeningReview': 'inherited'}
        with wave.open(str(src), 'rb') as wav:
            assert wav.getnchannels() == 1 and wav.getsampwidth() == 2
            seconds = wav.getnframes() / wav.getframerate()
            assert seconds > 0.5
            if '新錄' in status:
                samples = array('h', wav.readframes(wav.getnframes()))
                if any(abs(sample) >= 32767 for sample in samples):
                    raise ValueError(f'New recording reaches full scale: {voice}:{key}; keep a new take before importing.')
        target = 'audio/outdoor/renai-001/' + voice.lower() + '/' + key + '.wav'
        item['voices'][voice] = {'file': target, 'sha256': hashlib.sha256(src.read_bytes()).hexdigest(),
                                 'seconds': seconds, **provenance}
        copies.append((src, root / 'public' / target))
    manifest['utterances'][key] = item
assert len(manifest['utterances']) == 22
# Validate every source before writing anything.
for src, dst in copies:
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(src, dst)
(root / 'docs/tts-outdoor-script.md').write_text(args.script.read_text())
(root / 'src/remote/outdoor-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print('Imported', len(copies), 'WAVs; 22 shared texts; original recordings retained.')
