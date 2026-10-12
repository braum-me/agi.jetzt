#!/usr/bin/env bash
# Weekly-Archiv-Freeze — End-to-End-Probe des echten Publikationspfads.
#
# Fährt genau die Schritte, über die ein Briefing live geht — `pnpm run validate` (Merge-Gate in CI)
# und `pnpm build` (Production-Build im Dockerfile) — sowie das echte freeze-Kommando in
# Wegwerf-Kopien dieses Repos. „Letzte Ausgabe" ist die jeweils jüngste im Briefing-Ordner; die
# Probe ist an keine bestimmte Woche gebunden und läuft deshalb für zwei Grenzen:
#
#   open                     Archiv + nächste Ausgabe → validate und build laufen durch
#   frozen bei der letzten   Archiv wird weiter gebaut; nächste Ausgabe, Folgejahr, geänderte und
#                            ersetzte Ausgabe → Exit-Code ≠ 0, kein dist/
#   frozen eine Ausgabe später  dieselbe Mechanik mit anderer Grenze
#
# Es wird nichts committet, gepusht, deployt oder im Arbeitsverzeichnis verändert; die echte
# Zustandsdatei bleibt, wie sie ist.
#
#   bash scripts/freeze-rehearsal.sh            # validate + astro build
#   bash scripts/freeze-rehearsal.sh --docker   # zusätzlich: `docker build` einer abgelehnten Kopie muss scheitern
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WITH_DOCKER=0
[ "${1:-}" = "--docker" ] && WITH_DOCKER=1
[ -d "$ROOT/node_modules" ] || { echo "node_modules fehlt — erst 'pnpm install --frozen-lockfile'" >&2; exit 2; }

WORK="$(mktemp -d "${TMPDIR:-/tmp}/freeze-rehearsal.XXXXXX")" || exit 2
[ -n "$WORK" ] && [ -d "$WORK" ] || { echo "kein temporäres Verzeichnis" >&2; exit 2; }
trap 'rm -rf "$WORK"' EXIT
FAILED=0
ok()   { printf '  PASS  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILED=1; }
expect() { if [ "$2" "$3" "$4" ]; then ok "$1"; else fail "$1 (got $2)"; fi; }
BRIEF=src/content/briefing
status_before="$(cd "$ROOT" && git status --porcelain 2>/dev/null | shasum -a 256)"
contract_before="$(shasum -a 256 < "$ROOT/scripts/legacy-weekly-freeze.json")"

# Wegwerf-Kopie des Arbeitsstands (ohne node_modules/dist/.git). node_modules wird als eigener
# Ordner mit Links auf die Pakete angelegt, damit Astros Cache in der Kopie landet.
copy_tree() {
  mkdir -p "$1/node_modules"
  (cd "$ROOT" && tar -cf - --exclude ./node_modules --exclude ./dist --exclude ./.git --exclude ./.astro --exclude ./.claude .) | tar -xf - -C "$1"
  local entry name
  for entry in "$ROOT"/node_modules/* "$ROOT"/node_modules/.[!.]*; do
    name="$(basename "$entry")"
    case "$name" in .astro | .vite | .cache) continue ;; esac
    [ -e "$entry" ] && ln -s "$entry" "$1/node_modules/$name"
  done
}
slug() { printf 'kw-%02d-%d' "$2" "$1"; }      # slug <year> <week>
label() { printf '%d-KW%02d' "$1" "$2"; }      # label <year> <week>
fixture() { # fixture <tree> <year> <week> — synthetischer Platzhalter, kein redaktioneller Inhalt
  cat > "$1/$BRIEF/$(slug "$2" "$3").md" <<EOF
---
title: "Freeze-Rehearsal-Fixture $(label "$2" "$3")"
subtitle: "Fixture"
date: 2026-10-02
kw: $3
year: $2
author: "Fixture"
summary: "Fixture"
topStory: "Fixture"
statsHighlight:
  value: "1"
  label: "Fixture"
  context: "Fixture"
tags:
  - fixture
draft: false
---

Fixture https://example.invalid/1 https://example.invalid/2 https://example.invalid/3
EOF
}
issues_in() { find "$1/$BRIEF" -maxdepth 1 -name 'kw-*.md' | wc -l | tr -d ' '; }
built_in() { find "$1/dist/briefing" -maxdepth 1 -type d -name 'kw-*' 2>/dev/null | wc -l | tr -d ' '; }
freeze() { (cd "$1" && node scripts/legacy-weekly-freeze.mjs freeze --final "$2"); }
# Jede echte Ausgabe der Kopie ist Byte für Byte die des Arbeitsverzeichnisses (außer einer genannten).
archive_untouched() {
  local f
  for f in "$ROOT"/$BRIEF/kw-*.md; do
    [ "$(basename "$f")" = "${2:-}" ] && continue
    cmp -s "$f" "$1/$BRIEF/$(basename "$f")" || return 1
  done
}

# Basis: der Arbeitsstand im Zustand „open" (unabhängig davon, wie die echte Zustandsdatei steht).
BASE="$WORK/base"
copy_tree "$BASE"
printf '{\n  "version": 1,\n  "state": "open"\n}\n' > "$BASE/scripts/legacy-weekly-freeze.json"
# Jüngste Ausgabe, die beiden folgenden (über die Jahresgrenze hinweg) und die vorletzte — aus dem
# tatsächlichen Ordner berechnet, mit derselben Logik wie der Check.
cat > "$BASE/scripts/.rehearsal-issues.mjs" <<'EOF'
import fs from 'node:fs';
import { issueOfFile, latestIssue, nextIssue, formatIssue } from './legacy-weekly-freeze.mjs';
const issues = fs.readdirSync('src/content/briefing').map(issueOfFile).filter(Boolean);
const latest = latestIssue(issues);
const older = latestIssue(issues.filter((i) => formatIssue(i) !== formatIssue(latest)));
const next = nextIssue(latest);
const after = nextIssue(next);
const later = nextIssue(after);
later.year += 1;
later.week = 10;
const slug = (i) => 'kw-' + String(i.week).padStart(2, '0') + '-' + i.year;
for (const [name, i] of [['LATEST', latest], ['OLDER', older], ['NEXT', next], ['AFTER', after], ['LATER', later]]) {
  console.log(`${name}=${formatIssue(i)} ${name}_SLUG=${slug(i)} ${name}_YEAR=${i.year} ${name}_WEEK=${i.week}`);
}
EOF
eval "$(cd "$BASE" && node scripts/.rehearsal-issues.mjs)"
rm -f "$BASE/scripts/.rehearsal-issues.mjs"
[ -n "${LATEST:-}" ] && [ -n "${OLDER:-}" ] || { echo "letzte Ausgaben nicht bestimmbar" >&2; exit 2; }
N="$(issues_in "$BASE")"
echo "Letzte veröffentlichte Ausgabe: $LATEST ($N Ausgaben). Nächste: $NEXT."

accept_case() { # accept_case <tree> <titel> <erwartete Anzahl> <slug, der gebaut sein muss>
  echo; echo "== $2 =="
  (cd "$1" && pnpm run validate) > "$1.validate.log" 2>&1; expect "validate läuft durch (Exit 0)" "$?" -eq 0
  (cd "$1" && pnpm build) > "$1.build.log" 2>&1; expect "build läuft durch (Exit 0)" "$?" -eq 0
  [ -f "$1/dist/briefing/$4/index.html" ] && ok "dist enthält /briefing/$4/" || fail "dist enthält /briefing/$4/ nicht"
  expect "dist enthält genau $3 Ausgaben" "$(built_in "$1")" -eq "$3"
  archive_untouched "$1" && ok "bestehende Ausgaben unverändert" || fail "bestehende Ausgaben verändert"
}
refuse_case() { # refuse_case <quelle> <name> <titel> <erwartete Meldung> <mutation…>
  local tree="$WORK/$2"; cp -R "$1" "$tree"; rm -rf "$tree/dist"
  echo; echo "== $3 =="
  "${@:5}" "$tree"
  (cd "$tree" && pnpm run validate) > "$tree.validate.log" 2>&1; expect "validate bricht ab (Exit ≠ 0)" "$?" -ne 0
  (cd "$tree" && pnpm build) > "$tree.build.log" 2>&1; expect "build bricht ab (Exit ≠ 0)" "$?" -ne 0
  grep -q "$4" "$tree.validate.log" && ok "validate nennt Ausgabe und Grenze" || fail "validate nennt Ausgabe und Grenze nicht ($4)"
  grep -q "$4" "$tree.build.log" && ok "build nennt Ausgabe und Grenze" || fail "build nennt Ausgabe und Grenze nicht"
  [ ! -e "$tree/dist" ] && ok "kein dist/ entstanden (nichts zu deployen)" || fail "dist/ ist entstanden"
  echo "  → $(grep -m1 'refused' "$tree.validate.log" | sed 's/^ *· *//' | cut -c1-220)"
}
add_issue() { fixture "$3" "$1" "$2"; }                                  # add_issue <year> <week> <tree>
modify_issue() { printf '\nNachtrag (Rehearsal).\n' >> "$2/$BRIEF/$1"; } # modify_issue <datei> <tree>

# ── open ────────────────────────────────────────────────────────────────────────────────
echo; echo "== open: das Archiv besteht den Check =="
(cd "$BASE" && pnpm run validate) > "$BASE.validate.log" 2>&1; expect "validate läuft durch (Exit 0)" "$?" -eq 0
OPEN_NEXT="$WORK/open-next"; cp -R "$BASE" "$OPEN_NEXT"; fixture "$OPEN_NEXT" "$NEXT_YEAR" "$NEXT_WEEK"
accept_case "$OPEN_NEXT" "open: die nächste Ausgabe $NEXT wird veröffentlicht" $((N + 1)) "$NEXT_SLUG"

# ── frozen bei der letzten Ausgabe ──────────────────────────────────────────────────────
FROZEN="$WORK/frozen"; cp -R "$BASE" "$FROZEN"
echo; echo "== freeze-Kommando =="
freeze "$FROZEN" "$NEXT" > "$FROZEN.freeze-wrong.log" 2>&1; expect "einfrieren bei $NEXT wird abgelehnt (nicht veröffentlicht)" "$?" -ne 0
freeze "$FROZEN" "$LATEST" > "$FROZEN.freeze.log" 2>&1; expect "einfrieren bei $LATEST gelingt" "$?" -eq 0
grep -q '"state": "frozen"' "$FROZEN/scripts/legacy-weekly-freeze.json" && ok "Zustandsdatei der Kopie: frozen bei $LATEST" || fail "Zustandsdatei nicht frozen"
accept_case "$FROZEN" "frozen bei $LATEST: das Archiv inkl. der letzten Ausgabe wird weiter gebaut" "$N" "$LATEST_SLUG"
refuse_case "$FROZEN" f-next "frozen bei $LATEST: neue Ausgabe $NEXT" "$NEXT refused: the weekly archive is frozen at $LATEST" add_issue "$NEXT_YEAR" "$NEXT_WEEK"
refuse_case "$FROZEN" f-year "frozen bei $LATEST: neue Ausgabe $LATER" "$LATER refused: the weekly archive is frozen at $LATEST" add_issue "$LATER_YEAR" "$LATER_WEEK"
OLDER_FILE="$OLDER_SLUG.md"; FINAL_FILE="$LATEST_SLUG.md"
refuse_case "$FROZEN" f-modified "frozen bei $LATEST: archivierte Ausgabe $OLDER_FILE geändert" "$OLDER_FILE: refused: archived issue was modified" modify_issue "$OLDER_FILE"
archive_untouched "$WORK/f-modified" "$OLDER_FILE" && ok "übrige Ausgaben unverändert" || fail "übrige Ausgaben verändert"
refuse_case "$FROZEN" f-final "frozen bei $LATEST: letzte Ausgabe $FINAL_FILE ersetzt" "$FINAL_FILE: refused: archived issue was modified" modify_issue "$FINAL_FILE"

# ── frozen eine Ausgabe später ──────────────────────────────────────────────────────────
FROZEN2="$WORK/frozen-next"; cp -R "$OPEN_NEXT" "$FROZEN2"; rm -rf "$FROZEN2/dist"
echo; echo "== freeze-Kommando, eine Ausgabe später =="
freeze "$FROZEN2" "$LATEST" > "$FROZEN2.freeze-wrong.log" 2>&1; expect "einfrieren bei $LATEST wird abgelehnt ($NEXT ist schon veröffentlicht)" "$?" -ne 0
freeze "$FROZEN2" "$NEXT" > "$FROZEN2.freeze.log" 2>&1; expect "einfrieren bei $NEXT gelingt" "$?" -eq 0
accept_case "$FROZEN2" "frozen bei $NEXT: das Archiv inkl. $NEXT wird weiter gebaut" $((N + 1)) "$NEXT_SLUG"
refuse_case "$FROZEN2" f2-next "frozen bei $NEXT: neue Ausgabe $AFTER" "$AFTER refused: the weekly archive is frozen at $NEXT" add_issue "$AFTER_YEAR" "$AFTER_WEEK"
refuse_case "$FROZEN2" f2-year "frozen bei $NEXT: neue Ausgabe $LATER" "$LATER refused: the weekly archive is frozen at $NEXT" add_issue "$LATER_YEAR" "$LATER_WEEK"

if [ "$WITH_DOCKER" = 1 ]; then
  echo; echo "== Docker (Production-Build: frozen bei $LATEST + neue Ausgabe $NEXT, erwartet: Abbruch) =="
  rm -rf "$WORK/f-next/node_modules"
  tag="freeze-rehearsal-$$"
  docker build -t "$tag" "$WORK/f-next" > "$WORK/f-next.docker.log" 2>&1; expect "docker build bricht ab (Exit ≠ 0)" "$?" -ne 0
  grep -q "$NEXT refused: the weekly archive is frozen at $LATEST" "$WORK/f-next.docker.log" && ok "docker build nennt Ausgabe und Grenze" || fail "docker build nennt Ausgabe und Grenze nicht"
  [ -z "$(docker images -q "$tag" 2>/dev/null)" ] && ok "kein Image entstanden" || { fail "Image ist entstanden"; docker rmi "$tag" >/dev/null 2>&1; }
fi

echo
[ "$(cd "$ROOT" && git status --porcelain 2>/dev/null | shasum -a 256)" = "$status_before" ] && ok "Arbeitsverzeichnis unverändert (git status)" || fail "Arbeitsverzeichnis verändert"
[ "$(shasum -a 256 < "$ROOT/scripts/legacy-weekly-freeze.json")" = "$contract_before" ] && ok "echte Zustandsdatei unverändert" || fail "echte Zustandsdatei verändert"
echo
if [ "$FAILED" = 0 ]; then echo "FREEZE REHEARSAL: PASS"; else echo "FREEZE REHEARSAL: FAIL"; fi
exit "$FAILED"
