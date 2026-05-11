# Brand Logos — agi.jetzt Landscape Section

Lege Logos hier als **SVG** (bevorzugt) oder **PNG** (transparent) ab.
Der `BrandLogo`-Component nutzt diese automatisch bevorzugt vor den eingebauten Inline-Varianten.

## Erwartete Dateinamen

Exakt wie hier aufgelistet — klein, bindestrichlos, keine Leerzeichen:

| Datei            | Brand              | Status heute      |
|------------------|--------------------|-------------------|
| `openai.svg`     | OpenAI             | OK (inline)       |
| `anthropic.svg`  | Anthropic          | OK (inline)       |
| `deepmind.svg`   | Google DeepMind    | **Platzhalter**   |
| `meta.svg`       | Meta AI            | OK (inline)       |
| `mistral.svg`    | Mistral AI         | **Platzhalter**   |
| `xai.svg`        | xAI                | OK (inline)       |
| `huggingface.svg`| Hugging Face       | OK (inline, cartoon) |
| `deepseek.svg`   | DeepSeek           | **fehlt**         |
| `stability.svg`  | Stability AI       | **Text-Platzhalter** |
| `nvidia.svg`     | NVIDIA             | **Text-Platzhalter** |
| `amd.svg`        | AMD                | **Text-Platzhalter** |
| `cerebras.svg`   | Cerebras           | **Text-Platzhalter** |
| `groq.svg`       | Groq               | **Text-Platzhalter** |
| `chatgpt.svg`    | ChatGPT App        | OK (inline)       |
| `claude.svg`     | Claude App         | OK (inline, A-Logo)|
| `perplexity.svg` | Perplexity         | **Text-Platzhalter** |

## Design-Empfehlungen

- **Monochrom** (ein Farbwert, idealerweise `currentColor`-kompatibel) damit Hover-Color-Wechsel klappt.
- Viewbox idealerweise quadratisch oder horizontal bis max 3:1.
- **Größe:** 56×56px Basis, aber SVG scaled automatisch.
- **Lizenz:** offizielle Brand-Guideline-konforme Versionen (Presskits der Unternehmen).

## Woher bekommen?

Fast alle Unternehmen haben eigene Press/Brand-Pages:
- openai.com/brand, anthropic.com/presskit, nvidia.com/brand-guidelines,
  mistral.ai/press, huggingface.co/brand, perplexity.ai/press

Nach dem Upload committen — `BrandLogo.astro` erkennt die Dateien
beim nächsten Build automatisch.
