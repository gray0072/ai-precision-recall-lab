#!/usr/bin/env bash
# Renders the PWA icons with headless Chrome (no other tools needed). Copied from the ivan repo and adapted:
# here the game is the repo root, so `.` writes the PNGs into the root next to the SVGs.
#   icon.svg          -> icon-192.png, icon-512.png                (manifest "any", rounded tile, transparent corners)
#   icon-maskable.svg -> icon-maskable-512.png, apple-touch-icon.png (180 px)  (full-bleed square)
# Usage: bash tools/pwa-icons.sh .        (or any folder that holds an icon.svg and an icon-maskable.svg)
# After a re-render bump ?v=N of the icons in index.html and manifest.webmanifest.
set -euo pipefail
CHROME="${CHROME:-/c/Program Files/Google/Chrome/Application/chrome.exe}"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

winpath() { if command -v cygpath >/dev/null; then cygpath -m "$1"; else echo "$1"; fi; }

abspath() { echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; }

render() {  # render <svg> <size> <out.png>
  local svg page
  svg="$(winpath "$(abspath "$1")")"
  page="$TMP/page-$2.html"
  printf '<!doctype html><style>html,body{margin:0;background:transparent}img{display:block;width:%spx;height:%spx}</style><img src="file:///%s">' "$2" "$2" "$svg" > "$page"
  "$CHROME" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=1 \
    --default-background-color=00000000 --window-size="$2,$2" \
    --screenshot="$(winpath "$(abspath "$3")")" "file:///$(winpath "$page")" >/dev/null 2>&1
  echo "  $3"
}

[ $# -gt 0 ] || { echo "usage: bash tools/pwa-icons.sh <folder>   (. = the repo root)" >&2; exit 2; }
for dir in "$@"; do
  icon="$dir/icon.svg"; mask="$dir/icon-maskable.svg"
  [ -f "$icon" ] || { echo "no $icon" >&2; exit 1; }
  [ -f "$mask" ] || { echo "no $mask" >&2; exit 1; }
  echo "$dir:"
  render "$icon" 192 "$dir/icon-192.png"
  render "$icon" 512 "$dir/icon-512.png"
  render "$mask" 512 "$dir/icon-maskable-512.png"
  render "$mask" 180 "$dir/apple-touch-icon.png"
done
