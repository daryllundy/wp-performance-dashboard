#!/bin/bash

get_free_port() {
  comm -23 <(seq 3000 3100 | sort) <(ss -Htan | awk '{print $4}' | grep -oE '[0-9]+$' | sort -n | uniq) | head -n 1
}

PORT=$(get_free_port)
echo "Using free port: $PORT"
export FREE_PORT=$PORT
docker-compose up
