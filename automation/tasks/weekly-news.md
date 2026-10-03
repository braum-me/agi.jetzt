# Routine: Weekly News-Feed (Auto-Publish)

**Trigger:** Schedule — jeden Montag 09:00 CEST
**Output:** Neue Einträge am Ende von `src/data/news.json` (Array, additiv — bestehende Einträge bleiben unverändert)
**PR-Label:** `data`, `weekly`, `news`
**Prompt-Version:** `2026-09-28-auto-publish`
**Erwartung:** Kein menschliches Review. Nach grünem „Validate Data & Build"-Check merged die Routine ihren PR selbst — die News sind damit sofort live im News-Feed (`/` Startseite, Sektion „Was heute die KI-Welt bewegt") und im Dashboard.
**Harte Invariante:** Es werden ausschließlich neue Einträge angehängt. Bestehende Einträge in `news.json` werden nie verändert, gelöscht oder umsortiert.

---

## Dein Auftrag

Recherchiere die wichtigsten KI-Nachrichten der **letzten 7 Tage** (seit dem letzten Lauf dieser Routine) und ergänze `src/data/news.json` um 4–8 neue, quellenbelegte Einträge.

Du bist ein **Recherche-Assistent**, kein Ghostwriter. Kurze, präzise, faktenbasierte Einträge — keine Fließtext-Artikel (das ist die Aufgabe des Weekly-Briefings in `weekly-briefing-draft.md`).

## Schritt 1 — Kontext erfassen

1. Lies `src/data/news.json` komplett. Ermittle das neueste `date`-Feld — das ist dein Startpunkt für den Zeitfilter.
2. Ermittle das heutige Datum (`date +%Y-%m-%d`).
3. **Zeitfenster:** Ereignisse zwischen dem neuesten vorhandenen `date` und heute, maximal die letzten 7 Tage. Keine Re-Runs älterer Storys, die schon in `news.json` stehen (Abgleich über `headline`/Thema, nicht nur exaktes Datum).
4. **Duplikat-Check:** Vergleiche Kandidaten-Themen gegen die letzten 20 Einträge in `news.json` (nach Datum sortiert). Gleiches Thema nur aufnehmen, wenn ein neuer quantifizierbarer Schritt vorliegt (neue Zahl, neuer Deal, neues Release) — sonst überspringen.

## Schritt 2 — Recherche & Quellen-Hierarchie

Gleiche Hierarchie wie im Weekly-Briefing (siehe `weekly-briefing-draft.md` Schritt 2.1):

| Rang | Beispiele |
|------|-----------|
| **Primär** | anthropic.com/news, openai.com/blog, deepmind.google/discover/blog, ai.meta.com/blog, mistral.ai/news, xai.news, Arxiv-Abstracts, offizielle Behörden-Releases (whitehouse.gov, eur-lex.europa.eu, artificialintelligenceact.eu) |
| **Sekundär** (nur wenn Primärquelle fehlt) | bloomberg.com, reuters.com, ft.com, techcrunch.com, theverge.com, semafor.com, venturebeat.com, nature.com |
| **NICHT verwenden** | Aggregator-Blogs, Listicle-Seiten, generische „AI-Statistics"-Content-Farmen, generierte SEO-Inhalte |

**Mindestens 4, maximal 8 Einträge** pro Lauf. Weniger als 4 belegbare Events im Zeitfenster gefunden → nimm, was du hast (auch 1-3 sind ok, kein Abort — anders als beim Briefing ist der News-Feed ein kontinuierlicher Strom, kein wöchentliches Pflichtformat).

## Schritt 3 — Eintrag-Schema

Jeder neue Eintrag folgt exakt diesem Schema (siehe bestehende Einträge in `news.json` als Referenz):

```json
{
  "id": "kebab-case-slug-eindeutig",
  "headline": "Prägnante Headline, max ~90 Zeichen",
  "summary": "2-3 Sätze, faktenbasiert, mit konkreten Zahlen wo verfügbar.",
  "category": "research | industrie | open_source | politik | produkt",
  "date": "YYYY-MM-DD",
  "source": "Name der Quelle (z.B. 'Anthropic News', 'Reuters')",
  "source_url": "https://... (Primärquelle wenn möglich)",
  "relevance_score": 1-10,
  "agi_relevance": "1 Satz: warum das für die AGI-Entwicklung strukturell relevant ist (nicht nur 'ist interessant').",
  "tags": ["tag1", "tag2", "tag3"]
}
```

Regeln:
- `id`: eindeutig über die gesamte Datei (prüfe gegen bestehende `id`-Werte).
- `date`: reales Ereignisdatum, nie das heutige Abrufdatum, nie in der Zukunft.
- `category`: exakt einer der 5 erlaubten Werte (siehe `src/components/NewsFeed.astro` für die Kategorie-Liste).
- `relevance_score`: 1-10, kalibriert gegen bestehende Einträge (9-10 = strukturell bedeutsam wie Regulierung/Großfusionen, 5-6 = solide Produkt-News, 1-3 = Randnotiz).
- `source_url`: muss die tatsächlich abgerufene Quelle sein, keine Startseiten-Links.

## Schritt 4 — Qualitätsregeln (harte Guardrails)

1. **Jeder Eintrag braucht eine echte, verifizierbare Quelle** unter `source_url`. Keine Halluzination von Ereignissen.
2. **Sprache:** Deutsch (headline, summary, agi_relevance). Firmennamen/Produktnamen bleiben Original.
3. **Keine Presse-Floskeln** („bahnbrechend", „revolutionär", „game-changer") — sachlich-nüchtern.
4. **Kein Overlap mit dem laufenden Weekly-Briefing:** Wenn ein Thema bereits als Topstory oder in „Kurz notiert" des aktuellsten Briefings (`src/content/briefing/`, höchste KW-Nummer) behandelt wurde, trotzdem als News-Eintrag aufnehmen (News-Feed und Briefing haben unterschiedliche Leser-Journeys), aber `summary` kurz halten statt den Briefing-Text zu duplizieren.
5. **JSON muss valide bleiben:** Gültiges JSON, keine trailing commas, UTF-8, bestehende Einträge byte-identisch erhalten außer der Anhängung.

## Schritt 5 — Commit, PR & Auto-Merge

**Branch:** `automated/news-YYYY-MM-DD` (Datum des Runs)

**Commit-Message:**
```
🤖 news: N neue Einträge (YYYY-MM-DD)

Neue Einträge:
- [<Headline>](<source_url>) — <Quelle, Datum>
- [<Headline>](<source_url>) — <Quelle, Datum>
- ...

Zeitfenster: <letztes vorhandenes Datum> – <heute>
Status: additiv, kein Review-Gate — live nach grünem CI-Check
```

**PR-Title:** `🤖 News-Update YYYY-MM-DD (N Einträge)`

**PR-Body:**
```markdown
## Weekly News-Update

Dieser PR wird nach grünem „Validate Data & Build"-Check automatisch von der Routine gemergt.

### Neue Einträge

1. [<Headline>](<source_url>) — <Quelle, Datum>, Kategorie: <category>
2. ...

### Self-Check
- [x] Alle Einträge haben eine echte, abrufbare Quelle
- [x] Keine Duplikate zu bestehenden Einträgen (Thema + Zeitraum geprüft)
- [x] `id`-Werte sind eindeutig
- [x] `date`-Felder liegen im Zeitfenster und nicht in der Zukunft
- [x] JSON valide (lokal mit `pnpm run validate` geprüft)

/label ~data ~weekly ~news
```

**Nach dem Erstellen des PR — Auto-Merge:**

Nutze dafür die GitHub-Tools, die in deiner Session tatsächlich verfügbar sind (siehe `weekly-briefing-draft.md` Schritt 6 für die identische Logik — `mcp__github__*`-Tools oder `gh`-CLI, je nachdem was vorhanden ist).

1. Warte, bis der „Validate Data & Build"-Check auf dem PR abgeschlossen ist.
2. Check **grün** → mergen und Branch aufräumen.
3. Check **rot** → NICHT mergen. PR offen lassen und im Run-Output melden, welcher Fehler aufgetreten ist.
4. Kein GitHub-Tool zum Mergen verfügbar: PR offen lassen und das im Run-Output melden.

## Schritt 6 — Nicht tun

- **Niemals** bestehende Einträge in `news.json` verändern, löschen oder umsortieren — nur anhängen.
- **Niemals** bei rotem „Validate Data & Build"-Check mergen.
- **Niemals** andere Dateien als `src/data/news.json` in diesem Task anfassen.
- **Niemals** Halluzinieren von Ereignissen ohne verifizierbare Quelle.
- **Niemals** direkt auf `main` committen.
- **Niemals** Aggregator-Blogs als Quelle verwenden.
- **Niemals** mehr als 8 Einträge in einem Lauf (lieber die nächste Woche nachziehen als die Qualität zu verwässern).
