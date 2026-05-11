/**
 * Glossary inline tooltips.
 *
 * Scans elements with [data-glossary-scope] for the first text-occurrence of each
 * known glossary term and wraps it in a <span class="gloss-term"> with a tooltip
 * that shows the definition and links to /glossar.
 *
 * Heuristic, runtime-only:
 * - Skips text inside headings, links, code, em (italic), and existing gloss-terms.
 * - Only wraps the FIRST occurrence per term per scope (avoids visual noise).
 * - Whole-word match, case-sensitive (e.g. "AGI" hits, "agile" doesn't).
 */

import glossaryData from '../data/glossary.json';

interface GlossEntry {
  term: string;
  long: string;
  definition: string;
  category: string;
}

const SKIP_TAGS = new Set([
  'A', 'CODE', 'PRE', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6',
  'EM', 'STRONG', 'BUTTON', 'INPUT', 'TEXTAREA', 'SCRIPT', 'STYLE',
]);

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildSlug(term: string): string {
  return term.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function initGlossaryTooltips() {
  // Auf der Glossar-Seite selbst deaktivieren — Begriffe sind dort ohnehin erklärt,
  // Tooltips würden auf dieselbe Seite rückverweisen (UX-Loop).
  if (/^\/glossar\/?$/.test(window.location.pathname)) return;

  const scopes = document.querySelectorAll<HTMLElement>('[data-glossary-scope]');
  if (!scopes.length) return;

  const entries = (glossaryData as GlossEntry[])
    .slice()
    .sort((a, b) => b.term.length - a.term.length);

  scopes.forEach((scope) => {
    const used = new Set<string>();

    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        if (SKIP_TAGS.has(el.tagName)) return;
        if (el.classList.contains('gloss-term')) return;
        // Snapshot children — wrapping mutates the live list
        Array.from(el.childNodes).forEach(walk);
        return;
      }
      if (node.nodeType !== Node.TEXT_NODE) return;
      const text = node.textContent || '';
      if (text.length < 3) return;

      for (const entry of entries) {
        if (used.has(entry.term)) continue;
        const re = new RegExp(`(?<![A-Za-z0-9])${escapeRegex(entry.term)}(?![A-Za-z0-9])`);
        const match = re.exec(text);
        if (!match) continue;

        used.add(entry.term);

        const before = text.slice(0, match.index);
        const after = text.slice(match.index + entry.term.length);

        const span = document.createElement('span');
        span.className = 'gloss-term';
        span.dataset.term = entry.term;
        span.tabIndex = 0;

        const labelNode = document.createTextNode(entry.term);
        span.appendChild(labelNode);

        const tip = document.createElement('span');
        tip.className = 'gloss-tip';
        tip.setAttribute('role', 'tooltip');

        const tipTitle = document.createElement('span');
        tipTitle.className = 'gloss-tip-title';
        tipTitle.textContent = `${entry.term} · ${entry.long}`;
        tip.appendChild(tipTitle);

        const tipBody = document.createElement('span');
        tipBody.className = 'gloss-tip-body';
        tipBody.textContent = entry.definition;
        tip.appendChild(tipBody);

        const tipLink = document.createElement('a');
        tipLink.className = 'gloss-tip-link';
        tipLink.href = `/glossar#${buildSlug(entry.term)}`;
        tipLink.textContent = 'Im Glossar →';
        tip.appendChild(tipLink);

        span.appendChild(tip);

        const parent = node.parentNode!;
        if (before) parent.insertBefore(document.createTextNode(before), node);
        parent.insertBefore(span, node);
        if (after) parent.insertBefore(document.createTextNode(after), node);
        parent.removeChild(node);

        return;
      }
    };

    Array.from(scope.childNodes).forEach(walk);
  });
}
