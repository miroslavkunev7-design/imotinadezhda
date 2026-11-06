#!/usr/bin/env bash
set -euo pipefail
ffmpeg -version | head -1
ffprobe -version | head -1
TMP=$(mktemp -d)
ffmpeg -y -f lavfi -i color=c=red:s=320x240:d=1 -c:v libx264 -pix_fmt yuv420p "$TMP/t.mp4"
ffprobe -v error -show_entries format=duration -of csv=p=0 "$TMP/t.mp4"
rm -rf "$TMP"
echo OK
