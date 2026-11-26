#!/usr/bin/env bash
# Runs the same checks as CI: formatting, lint, type check, tests.
set -e
npm run lint
npm run check
npm test
