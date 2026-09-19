#!/bin/bash
# Claim the newest MiniMax download and file it under its canonical name.
#
#   scripts/claim-download.sh <female|male> <fileStem> <since-epoch-seconds>
#
# Refuses if the newest download is older than <since>, which is how we avoid
# filing the same audio twice when a generation silently failed. The duration is
# printed so a sentence that came out the wrong length is visible immediately.
set -euo pipefail
GENDER="$1"; STEM="$2"; SINCE="$3"
DL="$HOME/mnt/Downloads"
REPO="$HOME/mnt/Opus Chamber/Nightingale"
DEST="$REPO/public/audio/zh-TW/$GENDER/$STEM.mp3"

NEW=$(find "$DL" -maxdepth 1 -name 'MiniMax_*.mp3' -newermt "@$SINCE" -print0 \
      | xargs -0 ls -t 2>/dev/null | head -1)

if [ -z "${NEW:-}" ]; then echo "NO-NEW-DOWNLOAD (nothing newer than $SINCE)"; exit 1; fi

cp "$NEW" "$DEST"
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$DEST")
printf '%-34s %6.2fs  %7d bytes   <- %s\n' "$STEM" "$D" "$(stat -c%s "$DEST")" "$(basename "$NEW")"
