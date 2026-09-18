#!/usr/bin/env sh
# Runs every WhatsApp bot test:
#  1. pure unit tests (no DB) via node's built-in type stripping
#  2. end-to-end scenario tests through the real router against an in-memory MongoDB
#     (binary shared with test/after-sales — run that suite once first if the mongod
#     download is missing)
set -e
cd "$(dirname "$0")/../.."
node --experimental-strip-types --no-warnings --test test/whatsapp/*.test.mjs
NODE_OPTIONS="--no-warnings" node --import ./test/whatsapp/scenarios/register.mjs --test --test-timeout=120000 test/whatsapp/scenarios/*.test.mjs
