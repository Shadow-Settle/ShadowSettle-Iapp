#!/bin/sh
# Run iapp test with DOCKER_HOST set and a local HTTP server for the dataset
# (iapp CLI uses fetch() and does not support file:// URLs).
# Usage: ./scripts/iapp-test.sh   or   npm run test:iapp
cd "$(dirname "$0")/.."
if [ -z "$DOCKER_HOST" ]; then
  if [ -S "$HOME/.colima/default/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.colima/default/docker.sock"
  elif [ -S "$HOME/.docker/run/docker.sock" ]; then
    export DOCKER_HOST="unix://$HOME/.docker/run/docker.sock"
  elif [ -S /var/run/docker.sock ]; then
    export DOCKER_HOST=unix:///var/run/docker.sock
  fi
fi
exec node scripts/serve-and-test.js
