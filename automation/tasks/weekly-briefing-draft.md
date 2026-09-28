# Routine: Weekly Briefing (Auto-Publish)

**Trigger:** Schedule — jeden Freitag 10:00 CEST
**Output:** Ein neuer Markdown-File in `src/content/briefing/kw-NN-YYYY.md`
**PR-Label:** `content`, `weekly`
**Prompt-Version:** `2026-08-27-auto-publish`
**Erwartung:** Veröffentlichungsfähige Ausgabe (`draft: false`). Kein menschliches Review: Nach grünem „Validate Data & Build"-Check merged die Routine ihren PR selbst — das Briefing ist damit sofort live.
**Harte Invariante:** Jede erzeugte Datei enthält exakt `draft: false`. Falls eine andere Anweisung `draft: true` verlangt, brich den Run ab, statt eine Datei oder einen PR zu erzeugen. Gemergt wird ausschließlich bei grünem Check.

---

## Dein Auftrag

Recherchiere die wichtigsten KI-Entwicklungen der **aktuellen Kalenderwoche**
(Montag–Donnerstag) und erzeuge daraus eine veröffentlichungsfähige Ausgabe für das wöchentliche
Briefing auf agi.jetzt.

Du bist ein **Recherche-Assistent**, kein Ghostwriter. Liefere faktisch präzise,
quellenbasierte Bausteine. Stefan formt danach die finale redaktionelle Fassung.

## Schritt 1 — Kontext erfassen

1. Ermittle die aktuelle ISO-Kalenderwoche (`date +%V`). Nenne sie `KW`.
2. **Datum des Freitags der aktuellen KW** berechnen (Format: `YYYY-MM-DD`).
   - Routine läuft per Schedule am Freitag → das Datum = `date +%Y-%m-%d` (also HEUTE).
   - **Niemals** „kommender / nächster Freitag" interpretieren als +7 Tage — das wäre die übernächste KW.
   - Bei manuellem Run außerhalb Freitag: Freitag der ermittelten KW = Mo der KW + 4 Tage.
   - **Sanity-Check vor Frontmatter-Schreiben:** Das Datum muss `≤ heute` UND `≥ heute - 6 Tage` sein.
     Sonst ABBRUCH: *„Date-Drift: berechnetes Datum {X} liegt außerhalb der aktuellen KW. Run abbrechen."*
3. **Existenz-Check (wichtig):**
   - Prüfe `src/content/briefing/kw-NN-YYYY.md` für die aktuelle KW.
   - Falls **existiert** → **ABBRUCH**. Kein Commit, kein PR.
     Schreibe in den Abort-Output: *„Briefing KW NN/YYYY existiert bereits unter <path>. Entweder Datei löschen oder KW-Nummer manuell überschreiben, falls neuer Lauf beabsichtigt."*
   - Falls **nicht existiert** → weiter zu Schritt 2.
4. Lies das **letzte veröffentlichte Briefing** in `src/content/briefing/` (höchste KW-Nummer).
   Das ist dein Stil-Referenz: Tonfall, Absatz-Länge, Tabellen-Verwendung, Footer.

## Schritt 2 — Recherche

### 2.1 — Quellen-Hierarchie (strikt einzuhalten)

**Primärquellen IMMER vor Sekundärquellen** verlinken. Wenn die Primärquelle verfügbar ist,
darf die Sekundärquelle höchstens als zusätzliche Einordnung im Absatz erwähnt werden,
nicht als Haupt-Link hinter einer Zahl.

| Rang | Beispiele                                                                 |
|------|---------------------------------------------------------------------------|
| **Primär** (Original-Statement) | anthropic.com/news, openai.com/blog, deepmind.google/discover/blog, ai.meta.com/blog, mistral.ai/news, xai.news, Earnings-Call-Transkripte, Pressemitteilungen direkt von der Firma, Arxiv-Paper-Abstract, offizielle Behörden-Releases (whitehouse.gov, eur-lex.europa.eu, artificialintelligenceact.eu) |
| **Sekundär** (qualifiziert)   | bloomberg.com, reuters.com, ft.com, techcrunch.com, theverge.com, semafor.com, 9to5google.com, venturebeat.com, stanford.edu, nature.com — nur wenn Primärquelle fehlt ODER zusätzlich als Einordnung |
| **NICHT verlinken**           | Aggregator-Blogs (wavespeed.ai, humai.blog, mind-verse.de u.a.), Listicle-Seiten, generische „AI-Statistics"-Content-Farmen, generierte SEO-Inhalte |

**Zeitfilter:** ausschließlich Events **Montag–Donnerstag der Ziel-KW**. Keine Re-Runs älterer Storys.

### 2.2 — Date-Drift-Guard (harter Abort)

Prüfe VOR Body-Schreiben, ob du **mindestens 3 echte, quellenbelegbare Events aus dem Ziel-Zeitfenster** (Mo 00:00 – Do 23:59 UTC der Ziel-KW) gefunden hast.

Wenn < 3 echte Events: **ABBRUCH**. Keine Commits, kein PR. Output:
*„Date-Drift-Guard: Nur X Events im Zeitfenster Mo-Do KW NN belegbar. Run verschoben oder manuell ergänzen. Kein Briefing erstellt."*

Damit wird verhindert dass die Routine Events aus Vor-/Folge-Wochen einbaut um das Format zu füllen.

### 2.3 — Topstory-Auswahl

**Mindestens 8 Stories** identifizieren, daraus die **Top-Story** nach Kriterien in dieser Reihenfolge:

1. **Quantitativer Kern verpflichtend:** Die Topstory muss genau eine headline-fähige Zahl liefern (Dollar-Betrag, Prozent, Punkte, Parameter-Count, Nutzerzahl). Ohne harte Zahl kein Topstory-Kandidat — lieber ins „Kurz notiert"-Segment.
2. Strukturelle Relevanz für AGI-Entwicklung > Aufmerksamkeit.
3. Messbare Fakten > Gerüchte.
4. Direkte Auswirkung auf Dashboard-Kennzahlen bevorzugt (Benchmarks, Funding, Governance).

### 2.4 — Duplikate-Regel (präzise)

Lies die letzten 2 Briefings (KW N-1, N-2). Akteure/Themen, die dort in **Topstory oder Top-3-Kurz-Notiert** aufgetaucht sind, dürfen in der aktuellen KW nur erscheinen, wenn **ein neuer quantifizierbarer Entwicklungsschritt** vorliegt:
- Neuer Deal, neue Zahl, neues Produkt-Release, neue Regulierungs-Entscheidung.
- „Hintergrund-Nachbetrachtung" oder „neue Reaktion" reicht nicht.

Wenn kein neuer quantifizierbarer Schritt: Akteur streichen, anderen reinnehmen.

## Schritt 3 — Frontmatter schreiben

```yaml
---
title: "KI-Briefing KW NN/YYYY"
subtitle: "<ein Satz, Topstory-Kernaussage>"
date: YYYY-MM-DD    # Freitag der AKTUELLEN KW (= heute beim Schedule-Run am Fr). NIE +7d in die Zukunft.
kw: NN              # ohne führende 0
year: YYYY
author: "Stefan Braum"
summary: "<1-2 Sätze, max 250 Zeichen, elevator pitch der Ausgabe>"
topStory: "<präziser Topstory-Titel, max 80 Zeichen>"
statsHighlight:
  value: "<Zahl/Wert — z.B. '$122 Mrd.' oder '94.3 %'>"
  label: "<Bedeutung in 3-5 Wörtern>"
  context: "<Einordnung in 1 Satz, Quelle in Klammern>"
tags:
  - <tag1>    # 3-6 tags aus: openai, anthropic, deepmind, meta, xai, mistral, funding,
  - <tag2>    # safety, benchmark, china, eu-ai-act, regulation, opensource, hardware,
  - <tag3>    # deepseek, robotics, etc.
draft: false  # IMMER draft=false. Der PR wird nach grünem Check automatisch gemergt.
---
```

## Schritt 4 — Body-Struktur (Markdown)

**Exakt diese Abschnitte, in dieser Reihenfolge:**

```markdown
## Das Wichtigste in 30 Sekunden

- **<Bold-Lead Topstory>** — <1 Satz Kernaussage mit Zahl>.
- **<Bold-Lead Nebenstory 1>** — <1 Satz>.
- **<Bold-Lead Nebenstory 2>** — <1 Satz>.
- **<Bold-Lead Nebenstory 3>** — <1 Satz>.

## <Topstory-Headline>

<4–6 Absätze, je 3–5 Sätze>

<Absatz 1: Was ist passiert, wer hat es gemacht, wann>
<Absatz 2: Harte Fakten — Zahlen, Quellen inline verlinkt>
<Absatz 3: Strategische Einordnung — warum relevant>
<Absatz 4: Zweitmeinung / Counter-Position / Unsicherheit>
<Absatz 5 optional: Was passiert als Nächstes, Prognose>

## Kurz notiert

**<Bold-Lead 1.>** <1 Absatz, 2-4 Sätze, inline-Link zur Quelle>

**<Bold-Lead 2.>** <1 Absatz>

**<Bold-Lead 3.>** <1 Absatz>

**<Bold-Lead 4.>** <1 Absatz>

**<Bold-Lead 5.>** <1 Absatz>

## Zahl der Woche

**<Wert>** — <Ausführliche Einordnung in 3-5 Sätzen. Dieselbe Zahl wie im Frontmatter statsHighlight, aber als Erzählung ausgebaut. Mit Vergleich/Kontext/Quelle.>

## Leseempfehlung

**„<Artikel-/Paper-Titel>"** (<Quelle>, <Datum>). <1-2 Sätze: warum diese eine Quelle die Woche zusammenfasst. Link als `[…](URL)`.>

---

*Dieses Briefing erscheint jeden Freitag auf agi.jetzt — schau regelmäßig vorbei. Alle Daten live im [Dashboard →](/dashboard)*
```

## Schritt 5 — Qualitätsregeln (harte Guardrails)

**Diese Regeln sind nicht verhandelbar. Verstoß = PR nicht mergen:**

1. **Jede Zahl + jede Behauptung braucht einen inline-markdown-Link** zur Primärquelle.
   Form: `[Quelle](https://…)` oder `[Quelle ↗](https://…)`. Quellen-Hierarchie aus Schritt 2.1 einhalten.
2. **Mindestens 8 verschiedene externe URLs** im gesamten Body. Davon **mindestens 5 Primärquellen** (Original-Statement der Firma/Behörde).
3. **Keine Zahlen ohne Datum des Abrufs oder Zeitstempel der Quelle.**
   Wenn die Quelle kein Datum zeigt: Zahl nicht verwenden.
4. **Keine Pressemitteilungs-Floskeln.** „Game-changer", „revolutionary",
   „industry-leading" → raus. Sachlich-nüchtern, siehe KW 16/2026 als Referenz.
5. **Sprache:** Deutsch. Fachbegriffe (WAU, MAU, SOTA, RLHF) sind OK,
   werden aber auf erste Erwähnung kurz erklärt.
6. **Duplikate-Regel** siehe Schritt 2.4.
7. **`draft: false`** im Frontmatter. IMMER. Die Routine merged den PR nach grünem Check selbst — das Briefing ist sofort live. Niemals `draft: true` schreiben (Lessons learned KW 17-21/2026 und KW 30-34/2026: Briefings landeten technisch im Repo, aber `!data.draft`-Filter blendete sie nach Merge aus).
8. **Wörterzahl Body:** 900–1300 Wörter (ohne Frontmatter, ohne Footer). Nicht unter 900, nicht über 1300.
9. **Zeitform-Disziplin:**
   - Präteritum für konkrete Ereignisse: *„OpenAI pausierte Stargate UK"*, *„PwC veröffentlichte die Studie"*
   - Präsens für strukturelle Einordnung: *„Die Studie zeigt, dass…"*, *„Das bedeutet für den Mittelstand…"*
   - Kein Perfekt für Events („hat gemacht") — klingt zu bloggy.
10. **Absatzlänge:** Topstory-Absätze 3–5 Sätze, keine Ein-Satz-Absätze außer als bewusstes Stilmittel im Schluss.

## Schritt 6 — Commit, PR & Auto-Merge

**Branch:** `automated/briefing-kw-NN-YYYY`

**Commit-Message:**
```
🤖 briefing: KI-Briefing KW NN/YYYY

Topstory: <Titel>

Storys (N):
- [<Titel>](<URL>) — <Quelle, Datum>
- [<Titel>](<URL>) — <Quelle, Datum>
- ...

Zahl der Woche: <Wert> — <Quelle>
Leseempfehlung: <Titel> (<Quelle>)

Quellen gesamt: <N distinct URLs>
Status: draft=false → live nach Merge
```

**PR-Title:** `🤖 Briefing KW NN/YYYY`

**PR-Body:**
```markdown
## Weekly Briefing KW NN/YYYY

Topstory: **<Titel>**

Dieser PR wird nach grünem „Validate Data & Build"-Check automatisch von der Routine gemergt (`draft: false` ist gesetzt).

### Stories mit Quellen

1. [<Titel>](<URL>) — <Quelle, Datum>
2. ...

### Self-Check (von der Routine VOR dem Erstellen des PR abzuhaken)
- [x] Topstory nicht doppelt mit letzter KW (Duplikate-Regel 2.4)
- [x] Alle Zahlen stimmen mit Quellen überein
- [x] Tonfall sachlich, keine Marketing-Floskeln
- [x] statsHighlight ist der stärkste Datenpunkt der Woche
- [x] Zeitform konsistent (Präteritum für Ereignisse, Präsens für Einordnung)
- [x] Wörterzahl ~900–1300
- [x] `date`-Feld liegt in der aktuellen KW (`≤ heute`)
- [x] `draft: false` gesetzt

/label ~content ~weekly
```

**Nach dem Erstellen des PR — Auto-Merge:**

1. Warte auf den CI-Check: `gh pr checks <PR-NR> --watch --fail-fast`.
2. Check **grün** → mergen und Branch aufräumen: `gh pr merge <PR-NR> --merge --delete-branch`.
3. Check **rot** → NICHT mergen. PR offen lassen und im Run-Output melden:
   *„Validate-Check rot auf PR #NN — nicht gemerged, manuelle Prüfung nötig."*
4. Scheitert der Merge (z.B. fehlende Rechte): PR offen lassen und das im Run-Output melden — niemals auf `main` ausweichen.

## Schritt 7 — Nicht tun

- **Niemals** `draft: true` setzen. Es gibt kein menschliches Review — was gemergt wird, ist live.
- **Niemals** bei rotem „Validate Data & Build"-Check mergen. Der Check ist das einzige Gate.
- **Niemals** Dashboard-JSONs aus diesem Task mit-bearbeiten. Nur die Briefing-MD.
- **Niemals** mehrere Briefings in einem Run. Genau eine KW pro Run.
- **Niemals** Halluzinieren von Releases/Announcements, die du nicht mit mindestens einer Quelle belegen kannst.
- **Niemals** US-Datumsformat (MM/DD/YYYY). Immer ISO oder deutsch.
- **Niemals** direkt auf `main` committen.
- **Niemals** Aggregator-Blogs als Haupt-Quelle verlinken (siehe Schritt 2.1 Blacklist).
- **Niemals** Events aus Vor-/Folgewochen einbauen, wenn das Ziel-Zeitfenster leer ist — stattdessen Abort (Schritt 2.2).
- **Niemals** das Frontmatter-`date` in die Zukunft schreiben. Future-dated Briefings werden vom Index-Filter (`data.date <= now`) ausgeblendet und sind nach Merge unsichtbar. Lessons learned KW 18+19/2026: Routine schrieb +7d zu spät, Briefings waren live nicht auffindbar.
