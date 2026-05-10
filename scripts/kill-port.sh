#!/bin/bash

PORT=${1:-8081}

kill $(netstat -plten 2>/dev/null | grep "$PORT" | grep -oP '\d+(?=/node)')
