#!/bin/sh
# git has no pre-pull hook, so this fetches first, scans what upstream would
# bring in, and only merges if it is clean.  Usage: npm run safe-pull
set -e
. "$(git rev-parse --show-toplevel)/.githooks/lib.sh"
git fetch
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}')
base=$(git merge-base HEAD "$upstream")
if ! scan range "$base" "$upstream"; then
  echo "safe-pull: refusing to merge $upstream" >&2
  exit 1
fi
git merge "$upstream"
