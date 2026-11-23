#!/bin/bash
# Probe glm-4.7-flash every 10 min (max 12 h). When 3 of 3 probes succeed, run the Codex batch.
S="$1"; Q=~/Desktop/harness游戏/game-x-harness-research/experiments/q1-harness-comparison
K=$(grep '^ZHIPU_API_KEY=' ~/Desktop/yuhui-station/.env.local | cut -d= -f2-)
export LITELLM_MASTER_KEY=$(cat "$S/litellm.key")
for n in $(seq 1 72); do
  ok=0
  for i in 1 2 3; do
    c=$(curl -s -m 60 -o /dev/null -w '%{http_code}' https://open.bigmodel.cn/api/anthropic/v1/messages -H "x-api-key: $K" -H 'anthropic-version: 2023-06-01' -H 'content-type: application/json' -d '{"model":"glm-4.7-flash","max_tokens":5,"messages":[{"role":"user","content":"hi"}]}')
    [ "$c" = 200 ] && ok=$((ok+1)); sleep 5
  done
  echo "$(date '+%F %T') probe $n: $ok/3 ok"
  if [ $ok = 3 ]; then
    curl -s localhost:4011/health/liveliness >/dev/null || { echo "bridge down"; exit 1; }
    cd "$Q"; for spec in "A 2" "A 3" "B 1" "B 2" "C 1"; do set -- $spec; python3 tools/run.py codex "$1" "$2"; sleep 20; done
    exit 0
  fi
  sleep 600
done
echo "gave up after 12 h"
