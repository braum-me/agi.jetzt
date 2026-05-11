<div align="center">

![agi.jetzt — Der Weg zur Allgemeinen Intelligenz](docs/hero.png)

# agi.jetzt

**Der Weg zur Künstlichen Allgemeinen Intelligenz — kuratiert von KI, gebaut von Menschen.**

[**→ agi.jetzt**](https://agi.jetzt)

</div>

---

## Was das ist

Eine deutschsprachige, datengetriebene Lagebild-Seite zur AGI-Frage. Kein Hype-Aggregator, kein Newsletter-Sammler — sondern ein **Proximity-Index** aus acht öffentlichen Benchmarks, ein redaktionell kuratierter News-Feed und wöchentliche Briefings, die einordnen statt aufzählen.

Die Seite richtet sich an Leute, die nicht jeden Tweet lesen wollen, aber wissen müssen, wo wir stehen.

## Vier Säulen

| | | |
|---|---|---|
| **Landing** | Aktueller Proximity-Score, Live-News, Watchlist, Methodik-Disclosure | [`/`](https://agi.jetzt) |
| **Dashboard** | 17 Widgets: Benchmarks, Modell-Specs, Funding, Compute, Adoption, Regulierung | [`/dashboard`](https://agi.jetzt/dashboard) |
| **Briefings** | Wöchentliche Lagebilder, je ~1500 Wörter, ein klarer Call der Woche | [`/briefing`](https://agi.jetzt/briefing) |
| **Deep Dives** | Kapital · Compute · Länder · Kontroversen · Geschichte · Glossar | [`/kapital`](https://agi.jetzt/kapital) etc. |

## Methodik

Der **AGI Proximity Index** ist ein gewichtetes geometrisches Mittel über acht Säulen. Pro Säule:

```
gap_i  =  min(100, SOTA_i ÷ Baseline_i × 100)
score  =  exp( Σ wᵢ · ln(gapᵢ) ÷ Σ wᵢ )
```

Keine Bauchgefühle, keine Stimmungsindizes. Jede Zahl hat eine Quelle, jede Quelle ist verlinkt.

| Säule | Benchmark | Gewicht |
|---|---|---:|
| Long-Horizon Agency | METR Agent Eval (24h) | 20 |
| Abstract Reasoning | ARC-AGI-2 | 15 |
| Self-Improvement | METR RE-Bench + MLE-bench | 15 |
| Coding Agency | SWE-bench Verified | 12 |
| Tool Use & Autonomie | OSWorld | 12 |
| Multimodal | MMMU | 10 |
| Expert Knowledge | GPQA Diamond | 8 |
| Advanced Math | MATH + AIME | 8 |

Die [Methodik-Seite](https://agi.jetzt/#proximity) zeigt Baselines, SOTA-Werte, Quellen-URLs und das Update-Datum pro Säule.

## Datenintegrität

- **Single Source of Truth** für die Pillars: `src/data/dashboard/proximity-pillars.json`. Composite und Dimension-Werte werden zur Build-Zeit daraus abgeleitet.
- **Validator-Gate** (`scripts/validate-data.mjs`) prüft Range-Checks, Source-Pflicht und Delta-Plausibilität bei jedem Build.
- **Quellenpflicht** für Automation-Routinen: Jede geänderte Zahl braucht URL + Abrufdatum im Commit-Body.

## Stack

Astro 5 · Tailwind 4 · Three.js · GSAP · Apache ECharts · Pagefind · Instrument Serif + Inter Tight + JetBrains Mono (alle selbstgehostet, DSGVO-konform). Analytics via cookieloses Umami.

Das ist eine statische Seite — kein Backend, kein Tracking, keine Cookies.

## Autor

**Stefan Braum** — IT-Architekt, [braum.consulting](https://braum.consulting) · [LinkedIn](https://linkedin.com/in/stefanbraum)

## Lizenz

Code: [MIT](./LICENSE). Inhalte (Briefings, Deep Dives, Texte): © Stefan Braum, alle Rechte vorbehalten.
