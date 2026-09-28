# Automation — Routine-Prompts für agi.jetzt

> **Status (Stand 28.09.2026):** `weekly-briefing-draft` und `weekly-news` sind produktiv
> konfiguriert und laufen **ohne menschliches Review** — Publish-Gate ist ausschließlich
> der grüne „Validate Data & Build"-CI-Check, die Routine merged ihren eigenen PR selbst.
> Die restlichen Tasks in der Tabelle unten sind Prompt-Drafts in Vorbereitung —
> Scheduling und `scripts/run-task.sh` werden in den kommenden Wochen nachgezogen.
>
> **Lessons learned (KW 17-39/2026):** Der größte wiederkehrende Fehler war ein
> auseinandergelaufener Routine-Prompt — die Routine speichert ihre Anweisung beim Erstellen
> als Kopie, nicht als Live-Referenz auf dieses Repo. Wird `weekly-briefing-draft.md` geändert,
> muss der gespeicherte Routine-Prompt (Claude Code Remote → Routine bearbeiten) **manuell
> nachgezogen werden**, sonst driftet er wieder auseinander wie zwischen KW 30-39.

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
| `weekly-news` ✅ LIVE      | Mo 09:00 CEST      | `data`, `weekly`, `news` | `src/data/news.json` (additiv, Auto-Merge bei grünem CI)  |
| `weekly-watchlist`        | Do 09:00 CEST      | `data`, `weekly`         | `src/data/watchlist.json`                                 |
| `weekly-briefing-draft` ✅ LIVE | Fr 10:00 CEST | `content`, `weekly`      | `src/content/briefing/kw-NN-YYYY.md` (`draft: false`, Auto-Merge bei grünem CI) |
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
