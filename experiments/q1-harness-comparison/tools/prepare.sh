#!/bin/sh
# prepare.sh <workdir>: fresh copy of the baseline (with its git history) for one run
set -e
Q=$(cd "$(dirname "$0")/.." && pwd)
W="$1"
rm -rf "$W"; mkdir -p "$W"
cp -R "$Q/baseline/." "$W/"
ln -s "$HOME/Desktop/yuhui-station/node_modules" "$W/node_modules"
printf 'node_modules\n.check/\nlogs/\n.pi/\n.omp/\n.claude/\n*.sqlite*\n' >> "$W/.git/info/exclude"
