#!/bin/bash

PORT=${1:-8081}

PID=$(netstat -plten 2>/dev/null | grep "$PORT" | grep -oP '\d+(?=/node)')

if [ -z "$PID" ]; then
  echo "No process found listening on port $PORT"
  exit 0
fi

kill $PID
