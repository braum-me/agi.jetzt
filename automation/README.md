# Automation — Routine-Prompts für agi.jetzt

> **Status (Stand 16.04.2026):** Nur `weekly-briefing-draft` ist produktiv konfiguriert.
> Die restlichen Tasks in der Tabelle unten sind Prompt-Drafts in Vorbereitung —
> Scheduling und `scripts/run-task.sh` werden in den kommenden Wochen nachgezogen.

Portable Task-Definitionen. Werden 1:1 in die **Claude Code Routine**-Konfiguration
kopiert (Anthropic Cloud) — oder in einem Plan-B-Szenario von einem dem internen Cron-Host-Cron-Wrapper aufgerufen.

## Architektur

Ein Routine:

1. Läuft auf Claude-Cloud-Infra per Schedule/GitHub-Trigger
2. Liest den aktuellen `main`-Branch auf GitHub
3. Folgt dem Prompt im passenden `tasks/*.md`
4. Erstellt Branch `automated/YYYY-MM-DD-<task-name>`
5. Committed geänderte Dateien mit ausführlicher Commit-Message (Quellen!)
6. Öffnet PR gegen `main` mit Label `automated` + Task-spezifischem Label
7. **Stefan reviewt manuell auf GitHub**. Merge ist das Qualitäts-Gate.
8. Merge → Coolify webhook → `pnpm build` → Production-Deploy

## Task-Inventar & Scheduling

| Task                      | Schedule           | PR-Label                 | Files                                                     |
|---------------------------|--------------------|--------------------------|-----------------------------------------------------------|
| `weekly-news`             | Mo 09:00 CEST      | `data`, `weekly`, `news` | `src/data/news.json`                                      |
| `weekly-watchlist`        | Do 09:00 CEST      | `data`, `weekly`         | `src/data/watchlist.json`                                 |
| `weekly-briefing-draft`   | Fr 10:00 CEST      | `content`, `draft`       | `src/content/briefing/kw-NN-YYYY.md`                      |
| `monthly-batch-a`         | 1. 09:00           | `data`, `monthly`        | `dashboard/benchmarks.json`, `model-specs.json`, `landscape.json` |
| `monthly-batch-b`         | 1. 10:00           | `data`, `monthly`        | `dashboard/investments.json`, `companies.json`, `hiring.json` |
| `monthly-batch-c`         | 2. 09:00           | `data`, `monthly`        | `dashboard/regulations.json`, `incidents.json`, `adoption.json` |
| `monthly-batch-d`         | 2. 10:00           | `data`, `monthly`        | `dashboard/papers.json`, `trends.json`, `timeline-12m.json` |
| `quarterly-proximity`     | 3. Jan/Apr/Jul/Okt 09:00 | `data`, `quarterly` | `dashboard/proximity-pillars.json` (single source — composite_score build-time abgeleitet), `proximity-history.json`, `stats.json`, `funding-breakdown.json`, `compute.json` |

Budget-Check: Max-Plan hat 15 Routines/Tag. Peak = 2 (Monthly-Tage). Budget-Auslastung: ~13 %.

## Quellenpflicht (harter Guardrail)

Jede geänderte Zahl MUSS im Commit-Body mit URL + Abrufdatum belegt sein. Ohne Quelle:
merge-blockiert. Validator + Review-Gate fangen Verstöße.

## Plan B (Fallback)

Falls Claude Code Routines nicht stabil/verfügbar:

1. `scripts/run-task.sh <task-name>` auf dem internen Cron-Host via systemd-timer
2. Wrapper ruft Claude-Code-CLI mit dem gleichen Prompt auf
3. Rest identisch (branch, commit, PR via `gh`-CLI)

Die Prompts bleiben portabel — Trigger-Mechanismus ist austauschbar.
