#!/bin/bash
set -e
timeout 60 npx drizzle-kit push --force 2>/dev/null || true
