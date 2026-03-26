#!/usr/bin/env bash
set -euo pipefail
LOG_FILE=/opt/openmaic-test/resource-monitor.log

while true; do
  ts=$(date "+%F %T")
  mem_avail_mb=$(free -m | sed -n '2p' | tr -s ' ' | cut -d ' ' -f7)
  swap_used_mb=$(free -m | sed -n '3p' | tr -s ' ' | cut -d ' ' -f3)
  disk_use_pct=$(df -P / | tail -1 | tr -s ' ' | cut -d ' ' -f5 | tr -d '%')
  cstats=$(docker stats --no-stream --format "{{.Name}}|{{.CPUPerc}}|{{.MemUsage}}" | grep "^openmaic-test|" || true)

  echo "[$ts] mem_avail=${mem_avail_mb}MB swap_used=${swap_used_mb}MB disk=${disk_use_pct}% ${cstats}" >> "$LOG_FILE"

  if [ "$mem_avail_mb" -lt 120 ] && [ "$swap_used_mb" -gt 1400 ]; then
    echo "[$ts] WARN low memory pressure, restarting openmaic-test" >> "$LOG_FILE"
    docker restart openmaic-test >/dev/null 2>&1 || true
  fi

  if [ "$disk_use_pct" -ge 85 ]; then
    echo "[$ts] WARN disk high usage, pruning dangling images" >> "$LOG_FILE"
    docker image prune -f >/dev/null 2>&1 || true
  fi

  sleep 30
done
