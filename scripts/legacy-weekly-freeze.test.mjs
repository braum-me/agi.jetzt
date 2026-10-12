// Tests für den Weekly-Archiv-Freeze (scripts/legacy-weekly-freeze.mjs + .json).
// Laufen mit `pnpm test` (node:test, keine zusätzlichen Abhängigkeiten). Jeder Test arbeitet in
// einem Wegwerf-Verzeichnis; die echte Zustandsdatei wird nie verändert. Alle „frozen"-Fälle laufen
// für mehrere verschiedene letzte Ausgaben (auch über eine Jahresgrenze), damit nichts an einer
// bestimmten Woche hängt. Die Tests am echten Archiv rechnen von dessen jüngster Ausgabe aus.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, describe, it } from 'node:test';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import {
  WeeklyArchiveFrozenError,
  WeeklyFreezeContractError,
  archiveProblems,
  assertPublicationAllowed,
  ARTIFACT_SCHEMA,
  assertWeeklyFreeze,
  buildFreezeArtifact,
  canonicalJson,
  buildFrozenContract,
  contractText,
  formatIssue,
  freezeProblems,
  freezeRepository,
  isoWeeksInYear,
  issueOfFile,
  latestIssue,
  nextIssue,
  parseFreezeContract,
  parseIssue,
  publicationProblem,
  readFreezeContract,
} from './legacy-weekly-freeze.mjs';

const createHashHex = (text) => createHash('sha256').update(text).digest('hex');
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HASH = 'c'.repeat(64);
const OPEN = { state: 'open' };
const temps = [];
const tempDir = (prefix) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  temps.push(dir);
  return dir;
};
after(() => temps.forEach((dir) => fs.rmSync(dir, { recursive: true, force: true })));

const file = (year, week) => `kw-${String(week).padStart(2, '0')}-${year}.md`;
const label = (year, week) => `${year}-KW${String(week).padStart(2, '0')}`;
/** Synthetische Ausgabe mit vollständigem Frontmatter — Platzhaltertext, kein redaktioneller Inhalt. */
const fixtureIssue = (year, week, overrides = {}) =>
  [
    '---',
    `title: "Freeze-Fixture ${label(year, week)}"`,
    'subtitle: "Fixture"',
    'date: 2026-10-02',
    `kw: ${overrides.kw ?? week}`,
    `year: ${overrides.year ?? year}`,
    'author: "Fixture"',
    'summary: "Fixture"',
    'topStory: "Fixture"',
    'statsHighlight:',
    '  value: "1"',
    '  label: "Fixture"',
    '  context: "Fixture"',
    'tags:',
    '  - fixture',
    `draft: ${overrides.draft ?? false}`,
    '---',
    '',
    `Fixture ${label(year, week)} https://example.invalid/1 https://example.invalid/2 https://example.invalid/3`,
    '',
  ].join('\n');

/** Wegwerf-Repo mit den genannten Ausgaben ([Jahr, Woche]) und der Seitenstruktur von /briefing/. */
const repo = (issues) => {
  const root = tempDir('weekly-freeze-');
  const dir = path.join(root, 'src/content/briefing');
  fs.mkdirSync(dir, { recursive: true });
  fs.mkdirSync(path.join(root, 'src/pages/briefing'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src/pages/briefing/index.astro'), '---\n---\n');
  const add = (year, week, text) => fs.writeFileSync(path.join(dir, file(year, week)), text ?? fixtureIssue(year, week));
  for (const [year, week] of issues) add(year, week);
  return { root, dir, add };
};
/**
 * Vier Archive mit verschiedenen letzten Ausgaben: zwei aufeinanderfolgende Wochen, das Jahresende
 * (KW 53 → die nächste Ausgabe ist KW 01 des Folgejahres) und ein Archiv über die Jahresgrenze.
 */
const CUTOFFS = [
  { issues: [[2030, 9], [2030, 10]], next: [2030, 11] },
  { issues: [[2030, 9], [2030, 10], [2030, 11]], next: [2030, 12] },
  { issues: [[2026, 52], [2026, 53]], next: [2027, 1] },
  { issues: [[2026, 53], [2027, 1], [2027, 2]], next: [2027, 3] },
].map((c) => ({ ...c, first: c.issues[0], final: c.issues.at(-1) }));
const frozenRepo = (cutoff) => {
  const r = repo(cutoff.issues);
  return { ...r, contract: buildFrozenContract(r.root, label(...cutoff.final)) };
};
const refused = (root, contract, pattern) => {
  const problems = freezeProblems(root, contract);
  assert.ok(problems.length >= 1, 'expected a freeze problem');
  assert.ok(problems.every((p) => /refused/.test(p)), problems.join('\n'));
  if (pattern) assert.ok(problems.some((p) => pattern.test(p)), problems.join('\n'));
  assert.throws(() => assertWeeklyFreeze(root, contract), WeeklyArchiveFrozenError);
  assert.throws(() => assertWeeklyFreeze(root, contract), /nothing was published/);
};

describe('Zustandsdatei', () => {
  it('liest open und frozen und schreibt sie stabil zurück', () => {
    assert.deepEqual(parseFreezeContract({ version: 1, state: 'open' }), OPEN);
    const frozen = parseFreezeContract({
      version: 1,
      state: 'frozen',
      finalLegacyIssue: '2030-KW10',
      archive: { 'kw-10-2030.md': HASH, 'kw-09-2030.md': HASH },
    });
    assert.deepEqual(frozen.finalLegacyIssue, { year: 2030, week: 10 });
    assert.equal(contractText(OPEN), '{\n  "version": 1,\n  "state": "open"\n}\n');
    assert.deepEqual(Object.keys(JSON.parse(contractText(frozen)).archive), ['kw-09-2030.md', 'kw-10-2030.md']);
    assert.deepEqual(parseFreezeContract(JSON.parse(contractText(frozen))), frozen);
    assert.equal(formatIssue(parseIssue('2027-KW03')), '2027-KW03');
    assert.deepEqual(issueOfFile('kw-10-2030.md'), { year: 2030, week: 10 });
    assert.deepEqual(nextIssue({ year: 2030, week: 10 }), { year: 2030, week: 11 });
    assert.deepEqual(nextIssue({ year: 2025, week: 52 }), { year: 2026, week: 1 });
    assert.deepEqual(nextIssue({ year: 2026, week: 52 }), { year: 2026, week: 53 });
    assert.deepEqual(nextIssue({ year: 2026, week: 53 }), { year: 2027, week: 1 });
    assert.deepEqual(latestIssue([{ year: 2026, week: 53 }, { year: 2027, week: 1 }, { year: 2026, week: 9 }]), { year: 2027, week: 1 });
    assert.equal(latestIssue([]), null);
    assert.equal(isoWeeksInYear(2026), 53);
    assert.equal(isoWeeksInYear(2025), 52);
  });

  it('die eingecheckte Zustandsdatei ist gültig', () => {
    assert.doesNotThrow(() => readFreezeContract());
  });

  const frozenWith = (extra) => ({ version: 1, state: 'frozen', finalLegacyIssue: '2030-KW10', archive: { 'kw-10-2030.md': HASH }, ...extra });
  for (const [name, value] of [
    ['null', null],
    ['ein Array', []],
    ['ohne version', { state: 'open' }],
    ['unbekannte version', { version: 2, state: 'open' }],
    ['ohne state', { version: 1 }],
    ['unbekannter state', { version: 1, state: 'paused' }],
    ['open mit Grenze', { version: 1, state: 'open', finalLegacyIssue: '2030-KW10' }],
    ['frozen ohne Grenze', { version: 1, state: 'frozen', archive: { 'kw-10-2030.md': HASH } }],
    ['frozen ohne archive', { version: 1, state: 'frozen', finalLegacyIssue: '2030-KW10' }],
    ['frozen mit Zusatzfeld', frozenWith({ note: 'x' })],
    ['Grenze nicht im Archiv', frozenWith({ archive: { 'kw-09-2030.md': HASH } })],
    ['leeres Archiv', frozenWith({ archive: {} })],
    ['Archiv-Eintrag nach der Grenze', frozenWith({ archive: { 'kw-10-2030.md': HASH, 'kw-11-2030.md': HASH } })],
    ['Archiv-Eintrag im Folgejahr', frozenWith({ archive: { 'kw-10-2030.md': HASH, 'kw-01-2031.md': HASH } })],
    ['Archiv-Eintrag ohne Hash', frozenWith({ archive: { 'kw-10-2030.md': 'kein-hash' } })],
    ['Archiv-Eintrag ist keine Ausgabe', frozenWith({ archive: { 'kw-10-2030.md': HASH, 'notes.md': HASH } })],
    ...['2030-10', 'KW10', '2030-KW00', '2030-KW54', '2025-KW53', '2030-KW4', '30-KW10', 10, ''].map((finalLegacyIssue) => [
      `Grenze ${JSON.stringify(finalLegacyIssue)}`,
      frozenWith({ finalLegacyIssue }),
    ]),
  ]) {
    it(`ungültig: ${name}`, () => {
      assert.throws(() => parseFreezeContract(value), WeeklyFreezeContractError);
    });
  }

  it('eine fehlende oder kaputte Zustandsdatei ist ein Fehler, nie „open"', () => {
    const dir = tempDir('weekly-freeze-contract-');
    assert.throws(() => readFreezeContract(path.join(dir, 'legacy-weekly-freeze.json')), /is missing/);
    fs.writeFileSync(path.join(dir, 'broken.json'), '{ kein json');
    assert.throws(() => readFreezeContract(path.join(dir, 'broken.json')), /not JSON/);
  });

  it('ein doppelter Schlüssel ist ungültig — JSON.parse nähme stillschweigend den letzten', () => {
    const dir = tempDir('weekly-freeze-duplicate-');
    const duplicate = path.join(dir, 'duplicate.json');
    fs.writeFileSync(duplicate, '{ "version": 1, "state": "frozen", "state": "open" }');
    assert.throws(() => readFreezeContract(duplicate), /names "state" more than once/);
    fs.writeFileSync(duplicate, '{ "version": 1, "version": 1, "state": "open" }');
    assert.throws(() => readFreezeContract(duplicate), WeeklyFreezeContractError);
    // … auch hinter einer Escape-Sequenz versteckt, und auch bei einem Archiv-Eintrag.
    fs.writeFileSync(duplicate, '{ "version": 1, "state": "frozen", "st\\u0061te": "open" }');
    assert.throws(() => readFreezeContract(duplicate), /escape sequence/);
    fs.writeFileSync(
      duplicate,
      `{ "version": 1, "state": "frozen", "finalLegacyIssue": "2030-KW10", "archive": { "kw-10-2030.md": "${HASH}", "kw-10-2030.md": "${'d'.repeat(64)}" } }`,
    );
    assert.throws(() => readFreezeContract(duplicate), /names "kw-10-2030\.md" more than once/);
    // Eine ordentliche frozen-Datei (wie sie das freeze-Kommando schreibt) bleibt gültig.
    fs.writeFileSync(duplicate, contractText(parseFreezeContract({ version: 1, state: 'frozen', finalLegacyIssue: '2030-KW10', archive: { 'kw-10-2030.md': HASH, 'kw-09-2030.md': HASH } })));
    assert.doesNotThrow(() => readFreezeContract(duplicate));
  });
});

describe('Veröffentlichung einer neuen Ausgabe', () => {
  it('open: jede echte ISO-Woche, in jedem Jahr', () => {
    for (const [year, week] of [[2026, 42], [2026, 53], [2027, 1], [2030, 10], [2020, 53]]) {
      assert.equal(publicationProblem(OPEN, year, week), null);
      assert.doesNotThrow(() => assertPublicationAllowed(OPEN, year, week));
    }
  });

  for (const cutoff of CUTOFFS) {
    const at = label(...cutoff.final);
    describe(`frozen bei ${at}`, () => {
      const contract = parseFreezeContract({ version: 1, state: 'frozen', finalLegacyIssue: at, archive: { [file(...cutoff.final)]: HASH } });
      for (const [year, week] of [cutoff.next, [cutoff.final[0] + 1, 10], [cutoff.final[0] + 4, 1]]) {
        it(`lehnt ${label(year, week)} ab, nennt Ausgabe und Grenze`, () => {
          const problem = publicationProblem(contract, year, week);
          assert.ok(problem.includes(`${label(year, week)} refused`));
          assert.ok(problem.includes(`frozen at ${at}`));
          assert.match(problem, /no later issue may be published/);
          assert.throws(() => assertPublicationAllowed(contract, year, week), WeeklyArchiveFrozenError);
        });
      }
      it('auch eine ältere Woche ist keine NEUE Veröffentlichung mehr: das Archiv ist unveränderlich', () => {
        assert.match(publicationProblem(contract, ...cutoff.final), /immutable; no issue may be added or replaced/);
        assert.match(publicationProblem(contract, cutoff.final[0] - 1, 42), /immutable/);
      });
    });
  }

  for (const [name, year, week] of [
    ['Woche 0', 2026, 0],
    ['negative Woche', 2026, -1],
    ['Woche 53 in einem 52-Wochen-Jahr', 2025, 53],
    ['Woche 54', 2026, 54],
    ['gebrochene Woche', 2026, 40.5],
    ['NaN', 2026, Number.NaN],
    ['Woche als String', 2026, '40'],
    ['Jahr als String', '2026', 40],
    ['fehlende Woche', 2026, undefined],
    ['fehlendes Jahr', undefined, 40],
    ['null', null, null],
    ['zweistelliges Jahr', 26, 40],
    ['BigInt', 2026, 40n],
  ]) {
    it(`fail closed: ${name} — in jedem Zustand`, () => {
      for (const contract of [OPEN, parseFreezeContract({ version: 1, state: 'frozen', finalLegacyIssue: '2030-KW10', archive: { 'kw-10-2030.md': HASH } })]) {
        assert.match(publicationProblem(contract, year, week), /not a valid ISO year and week/);
        assert.throws(() => assertPublicationAllowed(contract, year, week), WeeklyArchiveFrozenError);
      }
    });
  }
});

describe('Zustand open: Normalbetrieb', () => {
  it('das Archiv und jede weitere Ausgabe sind in Ordnung — keine Freeze-Ablehnung', () => {
    for (const cutoff of CUTOFFS) {
      const r = repo(cutoff.issues);
      assert.deepEqual(freezeProblems(r.root, OPEN), []);
      r.add(...cutoff.next);
      r.add(cutoff.final[0] + 1, 10);
      assert.deepEqual(freezeProblems(r.root, OPEN), []);
      assert.deepEqual(archiveProblems(OPEN, r.dir), []);
      assert.doesNotThrow(() => assertWeeklyFreeze(r.root, OPEN));
    }
  });

  it('eine bestehende Ausgabe darf korrigiert werden, solange nicht eingefroren ist', () => {
    const r = repo(CUTOFFS[0].issues);
    fs.appendFileSync(path.join(r.dir, file(...CUTOFFS[0].first)), '\nKorrektur.\n');
    assert.deepEqual(freezeProblems(r.root, OPEN), []);
  });

  it('auch ungewöhnliche Dateien stören nicht — der Check greift erst im Zustand frozen', () => {
    const r = repo(CUTOFFS[0].issues);
    fs.writeFileSync(path.join(r.dir, 'notes.md'), 'x');
    fs.writeFileSync(path.join(r.root, 'src/pages/briefing/extra.md'), 'x');
    assert.deepEqual(freezeProblems(r.root, OPEN), []);
  });
});

for (const cutoff of CUTOFFS) {
  const at = label(...cutoff.final);
  const finalFile = file(...cutoff.final);
  const firstFile = file(...cutoff.first);
  const esc = (text) => text.replaceAll('.', '\\.');

  describe(`Zustand frozen bei ${at}`, () => {
    it('das Archiv bis einschließlich der letzten Ausgabe ist in Ordnung', () => {
      const { root, dir, contract } = frozenRepo(cutoff);
      assert.deepEqual(contract.finalLegacyIssue, { year: cutoff.final[0], week: cutoff.final[1] });
      assert.deepEqual(Object.keys(contract.archive).sort(), fs.readdirSync(dir).sort());
      assert.ok(Object.hasOwn(contract.archive, finalFile));
      assert.deepEqual(archiveProblems(contract, dir), []);
      assert.deepEqual(freezeProblems(root, contract), []);
      assert.doesNotThrow(() => assertWeeklyFreeze(root, contract));
    });

    for (const [year, week] of [cutoff.next, [cutoff.final[0] + 1, 10]]) {
      it(`eine neue Ausgabe ${label(year, week)} wird abgelehnt und beim Namen genannt`, () => {
        const { root, add, contract } = frozenRepo(cutoff);
        add(year, week);
        refused(root, contract, new RegExp(`${label(year, week)} refused: the weekly archive is frozen at ${at}; no later issue`));
      });
    }

    it('eine archivierte Ausgabe zu ändern wird abgelehnt', () => {
      const { root, dir, contract } = frozenRepo(cutoff);
      fs.appendFileSync(path.join(dir, firstFile), '\nNachtrag.\n');
      refused(root, contract, new RegExp(`${esc(firstFile)}: refused: archived issue was modified`));
    });

    it('die letzte Ausgabe zu ersetzen wird abgelehnt', () => {
      const { root, dir, contract } = frozenRepo(cutoff);
      fs.writeFileSync(path.join(dir, finalFile), fixtureIssue(...cutoff.final).replace('Fixture 20', 'Neuer Text 20'));
      refused(root, contract, new RegExp(`${esc(finalFile)}: refused: archived issue was modified`));
    });

    it('eine archivierte Ausgabe zu löschen wird abgelehnt', () => {
      const { root, dir, contract } = frozenRepo(cutoff);
      fs.rmSync(path.join(dir, firstFile));
      refused(root, contract, new RegExp(`${esc(firstFile)}: refused: archived issue is missing`));
    });

    it('ein altes Jahr als Etikett öffnet keinen freien Platz', () => {
      const { root, add, contract } = frozenRepo(cutoff);
      add(2025, 42);
      refused(root, contract, /kw-42-2025\.md: weekly issue 2025-KW42 refused: .* immutable; no issue may be added/);
    });

    it('`slug:` und YAML-Formen, die ein Zeilen-Parser anders liest, helfen nicht', () => {
      const nextSlug = file(...cutoff.next).replace('.md', '');
      for (const frontmatter of [
        `slug: ${nextSlug}\nkw: 41\nyear: 2025`,
        `subtitle: "x\nkw: 41\nyear: 2025\n y"\n"kw": ${cutoff.next[1]}\n"year": ${cutoff.next[0]}`,
        `? kw\n: ${cutoff.next[1]}\nyear: 2025`,
      ]) {
        const { root, dir, contract } = frozenRepo(cutoff);
        fs.writeFileSync(path.join(dir, 'kw-41-2025.md'), `---\n${frontmatter}\n---\n\nFixture\n`);
        refused(root, contract, /kw-41-2025\.md/);
      }
    });

    it('Unterordner, andere Endungen, fremde Dateien und Symlinks werden abgelehnt', () => {
      for (const rel of [`spaeter/${file(...cutoff.next)}`, `${file(...cutoff.next)}x`, 'kw99.md', 'notes.txt']) {
        const { root, dir, contract } = frozenRepo(cutoff);
        fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
        fs.writeFileSync(path.join(dir, rel), fixtureIssue(...cutoff.next));
        refused(root, contract);
      }
      const linked = frozenRepo(cutoff);
      fs.mkdirSync(path.join(linked.root, 'extra'));
      fs.writeFileSync(path.join(linked.root, 'extra/woche.md'), fixtureIssue(...cutoff.next));
      fs.symlinkSync(path.join(linked.root, 'extra'), path.join(linked.dir, 'spaeter'));
      refused(linked.root, linked.contract, /spaeter: refused: symlinks are not allowed/);
      const pages = frozenRepo(cutoff);
      fs.mkdirSync(path.join(pages.root, 'extra'));
      fs.symlinkSync(path.join(pages.root, 'extra'), path.join(pages.root, 'src/pages/archiv'));
      refused(pages.root, pages.contract, /src\/pages\/archiv: refused: symlinks are not allowed/);
    });

    it('eine Ausgabe als Seite oder statische Datei wird abgelehnt', () => {
      const name = file(...cutoff.next).replace('.md', '');
      for (const rel of [`briefing/${name}.md`, `briefing/${name}.astro`, `${name}/index.astro`, 'neu.mdx', 'briefing/woche.html']) {
        const { root, contract } = frozenRepo(cutoff);
        const page = path.join(root, 'src/pages', rel);
        fs.mkdirSync(path.dirname(page), { recursive: true });
        fs.writeFileSync(page, fixtureIssue(...cutoff.next));
        refused(root, contract, /an issue may not be published as a page/);
      }
      const { root, contract } = frozenRepo(cutoff);
      fs.mkdirSync(path.join(root, 'public/briefing', name), { recursive: true });
      fs.writeFileSync(path.join(root, 'public/briefing', name, 'index.html'), '<h1>Fixture</h1>');
      refused(root, contract, /public\/briefing: refused/);
    });

    it('ein fehlender Briefing-Ordner ist ein Fehler, kein Freifahrtschein', () => {
      const { root, contract } = frozenRepo(cutoff);
      fs.rmSync(path.join(root, 'src/content/briefing'), { recursive: true });
      refused(root, contract, /briefing directory is missing/);
    });
  });
}

describe('Einfrieren (freeze --final)', () => {
  for (const cutoff of CUTOFFS) {
    it(`nur bei der zuletzt veröffentlichten Ausgabe (${label(...cutoff.final)}) — die Grenze ist nie geraten`, () => {
      const { root } = repo(cutoff.issues);
      const final = label(...cutoff.final);
      const next = label(...cutoff.next);
      const earlier = label(...cutoff.issues.at(-2));
      assert.throws(() => buildFrozenContract(root, next), new RegExp(`cannot freeze at ${next}: .* does not exist`));
      assert.throws(() => buildFrozenContract(root, earlier), new RegExp(`cannot freeze at ${earlier}: ${final} is already published`));
      assert.deepEqual(buildFrozenContract(root, final).finalLegacyIssue, { year: cutoff.final[0], week: cutoff.final[1] });
    });
  }

  it('eine Grenze, die keine echte Ausgabe bezeichnet, wird abgelehnt', () => {
    const { root } = repo(CUTOFFS[0].issues);
    assert.throws(() => buildFrozenContract(root, 'KW10'), WeeklyFreezeContractError);
    assert.throws(() => buildFrozenContract(root, '2030-KW54'), WeeklyFreezeContractError);
    assert.throws(() => buildFrozenContract(root, undefined), WeeklyFreezeContractError);
  });

  it('der Ordner muss aus eindeutigen, veröffentlichten Ausgaben bestehen', () => {
    const [year, week] = CUTOFFS[0].final;
    for (const [prepare, pattern] of [
      [(r) => r.add(year, week, fixtureIssue(year, week, { draft: true })), /is a draft/],
      [(r) => r.add(year, week, fixtureIssue(year, week, { kw: week + 1 })), /frontmatter kw\/year does not match/],
      [(r) => fs.writeFileSync(path.join(r.dir, 'notes.md'), 'x'), /notes\.md is not a kw-NN-YYYY\.md issue file/],
      [(r) => fs.writeFileSync(path.join(r.dir, file(year, week - 5)), 'kein Frontmatter'), /has no frontmatter/],
      [(r) => fs.symlinkSync(r.root, path.join(r.dir, 'link')), /symlink in the briefing directory/],
    ]) {
      const r = repo(CUTOFFS[0].issues);
      prepare(r);
      assert.throws(() => buildFrozenContract(r.root, label(year, week)), pattern);
    }
  });

  it('CRLF, ein draft-Feld mit Kommentar und Lücken im Archiv sind in Ordnung', () => {
    const r = repo([[2030, 3], [2030, 10]]);
    r.add(2030, 10, fixtureIssue(2030, 10).replaceAll('\n', '\r\n').replace('draft: false', 'draft: false # veröffentlicht'));
    const contract = buildFrozenContract(r.root, '2030-KW10');
    assert.deepEqual(Object.keys(contract.archive).sort(), ['kw-03-2030.md', 'kw-10-2030.md']);
    assert.deepEqual(freezeProblems(r.root, contract), []);
  });

  it('schreibt die Zustandsdatei nur aus open heraus und nur einmal', () => {
    const cutoff = CUTOFFS[1];
    const { root, dir } = repo(cutoff.issues);
    const final = label(...cutoff.final);
    const contractFile = path.join(root, 'legacy-weekly-freeze.json');
    fs.writeFileSync(contractFile, contractText(OPEN));
    assert.throws(() => freezeRepository(root, label(...cutoff.issues.at(-2)), contractFile), new RegExp(`${final} is already published`));
    assert.deepEqual(readFreezeContract(contractFile), OPEN);
    const frozen = freezeRepository(root, final, contractFile);
    assert.deepEqual(readFreezeContract(contractFile), frozen);
    assert.equal(Object.keys(frozen.archive).length, fs.readdirSync(dir).length);
    assert.throws(() => freezeRepository(root, final, contractFile), new RegExp(`already frozen at ${final}`));
  });
});

describe('Der echte Publikationspfad in einer Wegwerf-Kopie: validate-data.mjs, freeze-Kommando, Build-Hook', () => {
  // Diese Tests rechnen von der jüngsten echten Ausgabe aus (nächste Ausgabe über die Jahresgrenze
  // hinweg) und setzen die Kopie immer auf „open" — sie laufen also in jedem Zustand des Repos.
  const realFiles = fs.readdirSync(path.join(ROOT, 'src/content/briefing'));
  const latest = latestIssue(realFiles.map(issueOfFile).filter(Boolean));
  const next = nextIssue(latest);
  const after = nextIssue(next);

  /** Kopie der Dateien, die Validator und Freeze lesen — immer im Zustand open. */
  const disposableRepo = () => {
    const dir = tempDir('weekly-freeze-validate-');
    for (const rel of ['scripts', 'src/data', 'src/pages', 'src/content/briefing', 'astro.config.mjs']) {
      fs.cpSync(path.join(ROOT, rel), path.join(dir, rel), { recursive: true });
    }
    fs.writeFileSync(path.join(dir, 'scripts/legacy-weekly-freeze.json'), contractText(OPEN));
    return dir;
  };
  const run = (dir, script, ...args) =>
    spawnSync(process.execPath, [path.join(dir, 'scripts', script), ...args], { cwd: dir, encoding: 'utf-8' });
  const addIssue = (dir, issue) =>
    fs.writeFileSync(path.join(dir, 'src/content/briefing', file(issue.year, issue.week)), fixtureIssue(issue.year, issue.week));
  /** Lässt sich das echte Archiv überhaupt einfrieren? Wenn nicht, ist das im Zustand open kein Fehler. */
  const freezable = (() => {
    try {
      buildFrozenContract(ROOT, formatIssue(latest));
      return true;
    } catch (error) {
      return error.message;
    }
  })();
  const frozenIt = (name, fn) =>
    it(name, (t) => (freezable === true ? fn(t) : t.skip(`das echte Archiv lässt sich derzeit nicht einfrieren: ${freezable}`)));

  it('open: das echte Archiv und die nächste Ausgabe bestehen den Check', () => {
    const dir = disposableRepo();
    assert.equal(run(dir, 'validate-data.mjs').status, 0);
    addIssue(dir, next);
    const result = run(dir, 'validate-data.mjs');
    assert.equal(result.status, 0, result.stderr);
    const status = run(dir, 'legacy-weekly-freeze.mjs', 'status');
    assert.equal(status.status, 0);
    assert.match(status.stdout, /"state":"open"/);
    assert.ok(status.stdout.includes(`"latestPublishedIssue":"${formatIssue(next)}"`), status.stdout);
  });

  frozenIt('frozen bei der letzten echten Ausgabe: Archiv besteht, nächste Ausgabe macht den Check rot', () => {
    const dir = disposableRepo();
    const frozen = run(dir, 'legacy-weekly-freeze.mjs', 'freeze', '--final', formatIssue(latest));
    assert.equal(frozen.status, 0, frozen.stderr);
    assert.ok(frozen.stdout.includes(`"finalLegacyIssue":"${formatIssue(latest)}"`));
    assert.equal(run(dir, 'validate-data.mjs').status, 0);
    addIssue(dir, next);
    const result = run(dir, 'validate-data.mjs');
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`${formatIssue(next)} refused: the weekly archive is frozen at ${formatIssue(latest)}`), result.stderr);
    assert.match(result.stderr, /Validation FAILED/);
    assert.equal(run(dir, 'legacy-weekly-freeze.mjs', 'status').status, 1);
  });

  frozenIt('frozen eine Ausgabe später: dieselbe Mechanik, andere Grenze', () => {
    const dir = disposableRepo();
    addIssue(dir, next);
    assert.equal(run(dir, 'legacy-weekly-freeze.mjs', 'freeze', '--final', formatIssue(latest)).status, 1);
    assert.equal(run(dir, 'legacy-weekly-freeze.mjs', 'freeze', '--final', formatIssue(next)).status, 0);
    assert.equal(run(dir, 'validate-data.mjs').status, 0);
    addIssue(dir, after);
    const result = run(dir, 'validate-data.mjs');
    assert.equal(result.status, 1);
    assert.ok(result.stderr.includes(`${formatIssue(after)} refused: the weekly archive is frozen at ${formatIssue(next)}`), result.stderr);
  });

  frozenIt('frozen: eine geänderte archivierte Ausgabe macht den Check rot', () => {
    const dir = disposableRepo();
    assert.equal(run(dir, 'legacy-weekly-freeze.mjs', 'freeze', '--final', formatIssue(latest)).status, 0);
    fs.appendFileSync(path.join(dir, 'src/content/briefing', file(latest.year, latest.week)), '\nNachtrag.\n');
    const result = run(dir, 'validate-data.mjs');
    assert.equal(result.status, 1);
    assert.match(result.stderr, /refused: archived issue was modified/);
  });

  // Der Production-Build läuft über die Astro-Integration in astro.config.mjs. Hier wird genau
  // deren Hook ausgeführt (ohne den ganzen Build): open lässt durch, frozen + neue Ausgabe wirft.
  const buildHook = (dir) => {
    if (!fs.existsSync(path.join(dir, 'node_modules'))) fs.symlinkSync(path.join(ROOT, 'node_modules'), path.join(dir, 'node_modules'));
    const script =
      "const config = (await import('./astro.config.mjs')).default;" +
      "const gate = config.integrations.find((i) => i.name === 'weekly-archive-freeze');" +
      "if (!gate) { console.error('integration missing'); process.exit(3); }" +
      "gate.hooks['astro:config:setup']();";
    return spawnSync(process.execPath, ['--input-type=module', '-e', script], { cwd: dir, encoding: 'utf-8' });
  };

  it('Build-Hook, open: lässt das Archiv und die nächste Ausgabe durch', () => {
    const dir = disposableRepo();
    addIssue(dir, next);
    const result = buildHook(dir);
    assert.equal(result.status, 0, result.stderr);
  });

  frozenIt('Build-Hook, frozen: bricht bei einer neuen Ausgabe mit Exit-Code ≠ 0 ab', () => {
    const dir = disposableRepo();
    assert.equal(run(dir, 'legacy-weekly-freeze.mjs', 'freeze', '--final', formatIssue(latest)).status, 0);
    assert.equal(buildHook(dir).status, 0);
    addIssue(dir, next);
    const result = buildHook(dir);
    assert.notEqual(result.status, 0);
    assert.ok(result.stderr.includes(`${formatIssue(next)} refused: the weekly archive is frozen at ${formatIssue(latest)}`), result.stderr);
    assert.match(result.stderr, /nothing was published/);
  });

  for (const [name, text] of [
    ['fehlende Zustandsdatei', null],
    ['frozen ohne Grenze', JSON.stringify({ version: 1, state: 'frozen', archive: {} })],
    ['ungültige Grenze', JSON.stringify({ version: 1, state: 'frozen', finalLegacyIssue: '2030-KW54', archive: {} })],
    ['Grenze ohne veröffentlichte Ausgabe', JSON.stringify({ version: 1, state: 'frozen', finalLegacyIssue: '2030-KW50', archive: { 'kw-10-2030.md': HASH } })],
    ['doppelter Schlüssel', '{ "version": 1, "state": "frozen", "state": "open" }'],
  ]) {
    it(`ungültige Konfiguration (${name}) macht Check und Build-Hook rot`, () => {
      const dir = disposableRepo();
      const contractFile = path.join(dir, 'scripts/legacy-weekly-freeze.json');
      if (text === null) fs.rmSync(contractFile);
      else fs.writeFileSync(contractFile, text);
      const result = run(dir, 'validate-data.mjs');
      assert.equal(result.status, 1);
      assert.match(result.stderr, /invalid weekly freeze contract/);
      const hook = buildHook(dir);
      assert.notEqual(hook.status, 0);
      assert.match(hook.stderr, /invalid weekly freeze contract/);
    });
  }
});

/** Wegwerf-Repo mit Zustandsdatei, damit das Nachweisdokument den Vertrag lesen kann. */
const artifactRepo = (issues, contract = OPEN) => {
  const r = repo(issues);
  fs.mkdirSync(path.join(r.root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(r.root, 'scripts/legacy-weekly-freeze.json'), contractText(contract));
  return r;
};
const NOW = new Date('2030-03-15T10:00:00Z');

describe('Nachweisdokument (artifact)', () => {
  it('open: nennt die jüngste Ausgabe und ist ausdrücklich nicht final', () => {
    const { root } = artifactRepo([[2030, 9], [2030, 10]]);
    const a = buildFreezeArtifact(root, { contract: OPEN, now: NOW });
    assert.equal(a.schema, ARTIFACT_SCHEMA);
    assert.equal(a.state, 'open');
    assert.equal(a.final, false);
    assert.equal(a.finalLegacyIssue, null);
    assert.equal(a.latestPublishedIssue, '2030-KW10');
    assert.equal(a.issueCount, 2);
    assert.deepEqual(a.issues.map((i) => i.file), [file(2030, 9), file(2030, 10)]);
    assert.equal(a.feed.latestItem, '2030-KW10');
  });

  it('frozen: nennt finalLegacyIssue, Hashes und Archiv-Hash; artifactSha256 prüft sich nach', () => {
    const { root } = artifactRepo([[2030, 9], [2030, 10]]);
    const frozen = buildFrozenContract(root, '2030-KW10');
    fs.writeFileSync(path.join(root, 'scripts/legacy-weekly-freeze.json'), contractText(frozen));
    const a = buildFreezeArtifact(root, { contract: readFreezeContract(path.join(root, 'scripts/legacy-weekly-freeze.json')), now: NOW });
    assert.equal(a.final, true);
    assert.equal(a.finalLegacyIssue, '2030-KW10');
    assert.equal(a.latestPublishedIssue, '2030-KW10');
    for (const entry of a.issues) assert.equal(entry.sha256, frozen.archive[entry.file]);
    const { generatedAt, artifactSha256, ...body } = a;
    assert.equal(artifactSha256, createHashHex(canonicalJson(body)));
    assert.ok(generatedAt);
  });

  it('der Hash hängt nicht vom Zeitpunkt der Erzeugung ab, wohl aber von jedem Byte einer Ausgabe', () => {
    const r = artifactRepo([[2030, 9], [2030, 10]]);
    const a = buildFreezeArtifact(r.root, { contract: OPEN, now: NOW });
    const b = buildFreezeArtifact(r.root, { contract: OPEN, now: new Date('2030-03-16T00:00:00Z') });
    assert.equal(a.artifactSha256, b.artifactSha256);
    r.add(2030, 10, `${fixtureIssue(2030, 10)}\nGeändert.\n`);
    const c = buildFreezeArtifact(r.root, { contract: OPEN, now: NOW });
    assert.notEqual(a.artifactSha256, c.artifactSha256);
    assert.notEqual(a.archiveSha256, c.archiveSha256);
  });

  it('über die Jahresgrenze: chronologisch geordnet, jüngste Ausgabe ist die des neuen Jahres', () => {
    const { root } = artifactRepo([[2026, 52], [2026, 53], [2027, 1], [2027, 2]]);
    const a = buildFreezeArtifact(root, { contract: OPEN, now: new Date('2027-02-01T00:00:00Z') });
    assert.deepEqual(a.issues.map((i) => i.issue), ['2026-KW52', '2026-KW53', '2027-KW01', '2027-KW02']);
    assert.equal(a.latestPublishedIssue, '2027-KW02');
    assert.equal(a.feed.latestItem, '2027-KW02');
    const frozen = buildFrozenContract(root, '2027-KW02');
    assert.equal(frozen.state, 'frozen');
  });

  it('ein Entwurf ist keine veröffentlichte Ausgabe', () => {
    const r = artifactRepo([[2030, 9]]);
    r.add(2030, 10, fixtureIssue(2030, 10, { draft: true }));
    const a = buildFreezeArtifact(r.root, { contract: OPEN, now: NOW });
    assert.equal(a.latestPublishedIssue, '2030-KW09');
    assert.equal(a.drafts, 1);
    assert.equal(a.issueCount, 1);
  });

  it('frozen, aber das Archiv weicht ab (neue Ausgabe, geändertes Byte): kein Dokument', () => {
    const r = artifactRepo([[2030, 9], [2030, 10]]);
    const frozen = buildFrozenContract(r.root, '2030-KW10');
    r.add(2030, 11);
    assert.throws(() => buildFreezeArtifact(r.root, { contract: frozen, now: NOW }), WeeklyArchiveFrozenError);
    const r2 = artifactRepo([[2030, 9], [2030, 10]]);
    const frozen2 = buildFrozenContract(r2.root, '2030-KW10');
    r2.add(2030, 9, `${fixtureIssue(2030, 9)}\nGeändert.\n`);
    assert.throws(() => buildFreezeArtifact(r2.root, { contract: frozen2, now: NOW }), WeeklyArchiveFrozenError);
  });

  it('Revision und erster Commit kommen aus git; ohne git sind sie null', () => {
    const r = artifactRepo([[2030, 9]]);
    const none = buildFreezeArtifact(r.root, { contract: OPEN, now: NOW });
    assert.equal(none.repository.revision, null);
    assert.equal(none.issues[0].firstCommit, null);
    const run = (...args) => spawnSync('git', ['-C', r.root, '-c', 'user.name=t', '-c', 'user.email=t@example.invalid', ...args], { encoding: 'utf-8' });
    run('init', '-q');
    run('add', '-A');
    run('commit', '-q', '-m', 'init');
    const head = run('rev-parse', 'HEAD').stdout.trim();
    const a = buildFreezeArtifact(r.root, { contract: OPEN, now: NOW });
    assert.equal(a.repository.revision, head);
    assert.equal(a.repository.dirty, false);
    assert.equal(a.issues[0].firstCommit.sha, head);
  });

  it('das echte Archiv: ein Dokument im Zustand der Datei, jüngste Ausgabe = Maximum der Dateien', () => {
    const a = buildFreezeArtifact(ROOT, { now: new Date() });
    const files = fs.readdirSync(path.join(ROOT, 'src/content/briefing')).filter((f) => issueOfFile(f));
    assert.equal(a.issueCount + a.drafts, files.length);
    const contract = readFreezeContract();
    assert.equal(a.state, contract.state);
    assert.equal(a.final, contract.state === 'frozen');
  });
});
