# Shared by the malware-scan hooks. Sourced, not executed.
ROOT=$(git rev-parse --show-toplevel)

scan() {
  if ! command -v node >/dev/null 2>&1; then
    echo "malware-scan: node is not installed, cannot scan" >&2
    return 2
  fi
  node "$ROOT/.githooks/scan-malware.mjs" "$@"
}

is_zero() {
  expr "$1" : '0*$' >/dev/null
}

# Post-* hooks cannot stop git, so they shout and print the undo command.
post_alarm() {
  cat >&2 <<MSG

!!! malware-scan: the code you just brought in looks malicious (details above).
!!! Do NOT run npm install / npm run dev / build / start on it.
!!! Undo it with:  $1

MSG
}
