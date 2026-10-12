#!/usr/bin/env node
/**
 * agi.jetzt — Weekly-Archiv-Freeze
 *
 * Schutz des Briefing-Archivs. Der Zustand steht maschinenlesbar in
 * `scripts/legacy-weekly-freeze.json`:
 *
 *   { "version": 1, "state": "open" }
 *       Normalbetrieb. Neue Ausgaben werden wie bisher veröffentlicht; dieser Check lässt alles zu.
 *
 *   { "version": 1, "state": "frozen", "finalLegacyIssue": "YYYY-KWNN", "archive": { … } }
 *       Das Archiv ist abgeschlossen. `archive` nennt jede veröffentlichte Ausgabe bis einschließlich
 *       `finalLegacyIssue` mit ihrem SHA-256. Der Briefing-Ordner muss genau diesem Stand
 *       entsprechen — keine Datei mehr, keine weniger, kein geändertes Byte. Die letzte Ausgabe
 *       wird weiter gebaut und ausgeliefert; eine neue Ausgabe wird hart abgelehnt.
 *
 * Zwei Fragen sind getrennt:
 *   - Archiv-Prüfung:  Entspricht der Ordner dem festgeschriebenen Archiv?   (freezeProblems)
 *   - Veröffentlichung: Darf eine NEUE Ausgabe dieser Woche erscheinen?       (publicationProblem)
 *
 * Aufgerufen von (beide brechen mit Exit-Code ≠ 0 ab):
 *   - scripts/validate-data.mjs  → CI-Check „Validate Data & Build"
 *   - astro.config.mjs           → jeder `astro build`, also auch der Production-Build
 *
 * Kommandos:
 *   node scripts/legacy-weekly-freeze.mjs status
 *   node scripts/legacy-weekly-freeze.mjs artifact [--out <datei>]
 *       gibt den Zustand als maschinenlesbares Nachweisdokument aus (nur lesend, ändert nichts):
 *       Zustand, letzte Ausgabe, je Ausgabe Datei/SHA-256/Datum/erster Commit, Archiv-Hash,
 *       Feed-Stand, Repository-Revision. Im Zustand „open" ist es ausdrücklich nicht final.
 *   node scripts/legacy-weekly-freeze.mjs freeze --final YYYY-KWNN
 *       schreibt den Zustand „frozen". `--final` ist immer ausdrücklich anzugeben und muss die
 *       zuletzt veröffentlichte Ausgabe sein; die Hashes werden aus dem tatsächlichen Ordner
 *       berechnet. Ein Kommando zum Wiederöffnen gibt es bewusst nicht — das ist ein geprüfter
 *       Edit der JSON-Datei.
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const FREEZE_VERSION = 1;
const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(SCRIPT_DIR, '..');
export const CONTRACT_FILE = path.join(SCRIPT_DIR, 'legacy-weekly-freeze.json');
const BRIEFING_DIR = 'src/content/briefing';

/** Eine Ausgabe wurde abgelehnt, oder das Archiv entspricht nicht dem festgeschriebenen Stand. */
export class WeeklyArchiveFrozenError extends Error {
  constructor(message) {
    super(message);
    this.name = 'WeeklyArchiveFrozenError';
  }
}

/** Die Zustandsdatei fehlt oder sagt nicht eindeutig, in welchem Zustand das Archiv ist. */
export class WeeklyFreezeContractError extends Error {
  constructor(message) {
    super(`invalid weekly freeze contract: ${message}`);
    this.name = 'WeeklyFreezeContractError';
  }
}

const show = (value) =>
  value === undefined ? 'missing' : typeof value === 'bigint' ? `${value}n` : JSON.stringify(value);

/** ISO-Wochen eines ISO-Jahres (52 oder 53): der 28. Dezember liegt immer in der letzten. */
export function isoWeeksInYear(year) {
  const dec28 = new Date(Date.UTC(year, 11, 28));
  const thursday = new Date(dec28.getTime() + (3 - ((dec28.getUTCDay() + 6) % 7)) * 86_400_000);
  const jan1 = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - jan1) / (7 * 86_400_000)) + 1;
}

function isIsoWeek(year, week) {
  return (
    typeof year === 'number' && Number.isInteger(year) && year >= 1000 && year <= 9999 &&
    typeof week === 'number' && Number.isInteger(week) && week >= 1 && week <= isoWeeksInYear(year)
  );
}

/** Schreibweise einer Ausgabe: "YYYY-KWNN". */
export const formatIssue = ({ year, week }) => `${year}-KW${String(week).padStart(2, '0')}`;
const fileOf = ({ year, week }) => `kw-${String(week).padStart(2, '0')}-${year}.md`;
const isAfter = (a, b) => a.year > b.year || (a.year === b.year && a.week > b.week);

/** Die Ausgabe der Folgewoche — über die Jahresgrenze hinweg (KW 52/53 → KW 01 des Folgejahres). */
export function nextIssue({ year, week }) {
  return week < isoWeeksInYear(year) ? { year, week: week + 1 } : { year: year + 1, week: 1 };
}

/** Die jüngste Ausgabe einer Liste, oder null. */
export function latestIssue(issues) {
  return issues.reduce((latest, issue) => (latest && !isAfter(issue, latest) ? latest : issue), null);
}

/** Liest "YYYY-KWNN"; alles andere und jede Woche, die es nicht gibt, ist ein Fehler. */
export function parseIssue(text) {
  const m = typeof text === 'string' ? /^(\d{4})-KW(\d{2})$/.exec(text) : null;
  const issue = m ? { year: Number(m[1]), week: Number(m[2]) } : null;
  if (!issue || !isIsoWeek(issue.year, issue.week)) {
    throw new WeeklyFreezeContractError(`${show(text)} is not an issue of the form YYYY-KWNN with a real ISO week`);
  }
  return issue;
}

/** Die Ausgabe eines Dateinamens `kw-NN-YYYY.md` (direkt im Ordner), sonst null. */
export function issueOfFile(relPath) {
  const m = typeof relPath === 'string' ? /^kw-(\d{2})-(\d{4})\.md$/.exec(relPath) : null;
  const issue = m ? { year: Number(m[2]), week: Number(m[1]) } : null;
  return issue && isIsoWeek(issue.year, issue.week) ? issue : null;
}

/** Prüft eine eingelesene Zustandsdatei. Unbekannte oder fehlende Felder sind Fehler. */
export function parseFreezeContract(value) {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new WeeklyFreezeContractError('not an object');
  }
  const keys = Object.keys(value).sort().join(',');
  if (value.version !== FREEZE_VERSION) {
    throw new WeeklyFreezeContractError(`version ${show(value.version)} is not supported`);
  }
  if (value.state === 'open') {
    if (keys !== 'state,version') throw new WeeklyFreezeContractError('an open contract has no further fields');
    return { state: 'open' };
  }
  if (value.state !== 'frozen') {
    throw new WeeklyFreezeContractError(`state ${show(value.state)} is neither open nor frozen`);
  }
  if (keys !== 'archive,finalLegacyIssue,state,version') {
    throw new WeeklyFreezeContractError('a frozen contract needs exactly finalLegacyIssue and archive');
  }
  const finalLegacyIssue = parseIssue(value.finalLegacyIssue);
  const archive = value.archive;
  if (typeof archive !== 'object' || archive === null || Array.isArray(archive)) {
    throw new WeeklyFreezeContractError('archive is not an object');
  }
  for (const [file, hash] of Object.entries(archive)) {
    const issue = issueOfFile(file);
    if (!issue) throw new WeeklyFreezeContractError(`archive entry ${show(file)} is not a kw-NN-YYYY.md issue`);
    if (isAfter(issue, finalLegacyIssue)) {
      throw new WeeklyFreezeContractError(`archive entry ${show(file)} lies after the final issue ${formatIssue(finalLegacyIssue)}`);
    }
    if (typeof hash !== 'string' || !/^[0-9a-f]{64}$/.test(hash)) {
      throw new WeeklyFreezeContractError(`archive entry ${show(file)} has no SHA-256`);
    }
  }
  // Die Grenze ist immer eine Ausgabe, die wirklich veröffentlicht wurde.
  if (!Object.hasOwn(archive, fileOf(finalLegacyIssue))) {
    throw new WeeklyFreezeContractError(`the final issue ${formatIssue(finalLegacyIssue)} is not part of the archive`);
  }
  return { state: 'frozen', finalLegacyIssue, archive: { ...archive } };
}

/** Liest die Zustandsdatei. Fehlt sie oder ist sie unlesbar, ist das ein Fehler — nie „open". */
export function readFreezeContract(file = CONTRACT_FILE) {
  if (!fs.existsSync(file)) throw new WeeklyFreezeContractError(`${path.basename(file)} is missing`);
  const text = fs.readFileSync(file, 'utf-8');
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new WeeklyFreezeContractError(`${path.basename(file)} is not JSON`);
  }
  // Die Datei braucht keine Escape-Sequenzen — mit einer ließe sich ein Schlüssel unbemerkt ein
  // zweites Mal schreiben.
  if (text.includes('\\')) {
    throw new WeeklyFreezeContractError(`${path.basename(file)} contains an escape sequence`);
  }
  // JSON.parse nimmt bei doppelten Schlüsseln stillschweigend den letzten. Ein Mensch (oder eine
  // Routine) liest den ersten — also ist eine Datei mit doppeltem Schlüssel ungültig. Das gilt
  // auch für Archiv-Einträge: jede Ausgabe steht genau einmal da.
  const contract = parseFreezeContract(parsed);
  const keys = ['version', 'state', 'finalLegacyIssue', 'archive', ...Object.keys(contract.archive ?? {})];
  for (const key of keys) {
    const pattern = new RegExp(`"${key.replaceAll('.', '\\.')}"\\s*:`, 'g');
    if ((text.match(pattern) ?? []).length > 1) {
      throw new WeeklyFreezeContractError(`${path.basename(file)} names ${show(key)} more than once`);
    }
  }
  return contract;
}

/**
 * Veröffentlichung: Grund, warum eine NEUE Ausgabe dieser ISO-Woche nicht erscheinen darf — oder null.
 * open: jede echte ISO-Woche. frozen: keine — nach der letzten Ausgabe ist Schluss, und davor ist
 * das Archiv unveränderlich. Was keine echte ISO-Woche ist, wird in beiden Zuständen abgelehnt.
 */
export function publicationProblem(contract, year, week) {
  if (!isIsoWeek(year, week)) {
    return `weekly issue refused: year ${show(year)} / week ${show(week)} is not a valid ISO year and week`;
  }
  if (contract.state === 'open') return null;
  const final = formatIssue(contract.finalLegacyIssue);
  const attempted = formatIssue({ year, week });
  return isAfter({ year, week }, contract.finalLegacyIssue)
    ? `weekly issue ${attempted} refused: the weekly archive is frozen at ${final}; no later issue may be published`
    : `weekly issue ${attempted} refused: the weekly archive is frozen at ${final} and immutable; no issue may be added or replaced`;
}

/** Wirft, wenn eine neue Ausgabe dieser ISO-Woche nicht erscheinen darf. */
export function assertPublicationAllowed(contract, year, week) {
  const problem = publicationProblem(contract, year, week);
  if (problem) throw new WeeklyArchiveFrozenError(problem);
}

/** Dateien und Symlinks unter `dir` (rekursiv). Symlinks werden nie verfolgt, sondern gemeldet. */
function walk(dir, base = dir, found = { files: [], links: [] }) {
  if (!fs.existsSync(dir)) return found;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const rel = path.relative(base, full);
    if (entry.name === '.DS_Store') continue;
    if (entry.isSymbolicLink()) found.links.push(rel);
    else if (entry.isDirectory()) walk(full, base, found);
    else found.files.push(rel);
  }
  found.files.sort();
  found.links.sort();
  return found;
}

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

/**
 * Archiv-Prüfung des Briefing-Ordners. open: keine Einschränkung. frozen: der Ordner ist Byte für
 * Byte das festgeschriebene Archiv. Jede Datei, die nicht dazugehört, ist ein Versuch, eine neue
 * Ausgabe zu veröffentlichen — egal, wie sie heißt oder was ihr Frontmatter behauptet.
 */
export function archiveProblems(contract, briefingDir) {
  if (contract.state === 'open') return [];
  const final = formatIssue(contract.finalLegacyIssue);
  if (!fs.existsSync(briefingDir)) return [`refused: briefing directory is missing — the weekly archive is frozen at ${final}`];
  const { files, links } = walk(briefingDir);
  const problems = links.map((rel) => `${rel}: refused: symlinks are not allowed in the frozen weekly archive (${final})`);
  for (const rel of files) {
    if (!Object.hasOwn(contract.archive, rel)) {
      const issue = issueOfFile(rel);
      problems.push(
        issue
          ? `${rel}: ${publicationProblem(contract, issue.year, issue.week)}`
          : `${rel}: refused: not an archived issue — the weekly archive is frozen at ${final}; no issue may be added`,
      );
    } else if (sha256(fs.readFileSync(path.join(briefingDir, rel))) !== contract.archive[rel]) {
      problems.push(`${rel}: refused: archived issue was modified — the weekly archive is frozen at ${final} and immutable`);
    }
  }
  for (const rel of Object.keys(contract.archive).sort()) {
    if (!files.includes(rel)) problems.push(`${rel}: refused: archived issue is missing — the weekly archive is frozen at ${final}`);
  }
  return problems;
}

const MARKDOWN_PAGE = /\.(md|mdx|markdown|mdown|mkdn|mkd|mdwn)$/i;
/** Die drei Dateien, aus denen /briefing/ besteht. Jede weitere wäre eine Ausgabe am Archiv vorbei. */
const BRIEFING_PAGES = ['[...slug].astro', 'feed.xml.ts', 'index.astro'].map((name) => path.join('briefing', name));

/**
 * Seiten, die im Zustand „frozen" eine Ausgabe am Archiv vorbei veröffentlichen würden:
 * Markdown-Seiten (es gibt keine), alles, was wie eine Ausgabe heißt, jede weitere Datei unter
 * src/pages/briefing, und Symlinks (Astro würde ihnen folgen, diese Prüfung nicht).
 */
export function pageProblems(contract, pagesDir) {
  if (contract.state === 'open') return [];
  const final = formatIssue(contract.finalLegacyIssue);
  const { files, links } = walk(pagesDir);
  const suspicious = files.filter(
    (rel) =>
      MARKDOWN_PAGE.test(rel) ||
      rel.split(path.sep).some((part) => /^kw-?\d/i.test(part)) ||
      (rel.split(path.sep)[0] === 'briefing' && !BRIEFING_PAGES.includes(rel)),
  );
  return [
    ...suspicious.map((rel) => `${rel}: refused: an issue may not be published as a page — the weekly archive is frozen at ${final}`),
    ...links.map((rel) => `${rel}: refused: symlinks are not allowed under src/pages — the weekly archive is frozen at ${final}`),
  ];
}

/** Alle Verstöße des Repos gegen den aktuellen Zustand, mit Pfaden relativ zum Repo-Root. */
export function freezeProblems(root = ROOT, contract = readFreezeContract()) {
  if (contract.state === 'open') return [];
  return [
    ...archiveProblems(contract, path.join(root, BRIEFING_DIR)).map((p) => `${BRIEFING_DIR}/${p}`),
    ...pageProblems(contract, path.join(root, 'src/pages')).map((p) => `src/pages/${p}`),
    // Statische Dateien unter public/briefing würden unverändert als /briefing/… ausgeliefert.
    ...(fs.existsSync(path.join(root, 'public/briefing'))
      ? [`public/briefing: refused: static files may not be published under /briefing/ — the weekly archive is frozen at ${formatIssue(contract.finalLegacyIssue)}`]
      : []),
  ];
}

/** Wirft mit allen Verstößen, wenn das Repo nicht dem aktuellen Zustand entspricht. */
export function assertWeeklyFreeze(root = ROOT, contract = readFreezeContract()) {
  const problems = freezeProblems(root, contract);
  if (problems.length) {
    throw new WeeklyArchiveFrozenError(
      `Weekly archive freeze violated — nothing was published.\n${problems.map((p) => `  · ${p}`).join('\n')}`,
    );
  }
}

/** Genau ein ganzzahliges Frontmatter-Feld; alles andere (fehlt, doppelt, kein Integer) → undefined. */
function integerField(frontmatter, name) {
  const lines = frontmatter.split(/\r?\n/).filter((line) => new RegExp(`^${name}\\s*:`).test(line));
  if (lines.length !== 1) return undefined;
  const value = /^[a-z]+\s*:\s*(\d+)\s*(?:#.*)?$/.exec(lines[0]);
  return value ? Number(value[1]) : undefined;
}

/**
 * Baut den Zustand „frozen" aus dem tatsächlichen Briefing-Ordner. `finalLabel` ("YYYY-KWNN") muss
 * die zuletzt veröffentlichte Ausgabe sein: Sie existiert, und es gibt keine spätere. Jede Datei im
 * Ordner muss eine eindeutige, veröffentlichte Ausgabe sein (Dateiname = Frontmatter, kein Entwurf).
 */
export function buildFrozenContract(root, finalLabel) {
  const finalLegacyIssue = parseIssue(finalLabel);
  const final = formatIssue(finalLegacyIssue);
  const dir = path.join(root, BRIEFING_DIR);
  const { files, links } = walk(dir);
  const refuse = (message) => {
    throw new WeeklyArchiveFrozenError(`cannot freeze at ${final}: ${message}`);
  };
  if (links.length) refuse(`symlink in the briefing directory (${links[0]})`);
  if (!files.length) refuse('the briefing directory holds no issue');
  const archive = {};
  for (const rel of files) {
    const issue = issueOfFile(rel);
    if (!issue) refuse(`${rel} is not a kw-NN-YYYY.md issue file`);
    const bytes = fs.readFileSync(path.join(dir, rel));
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(bytes.toString('utf-8'));
    if (!frontmatter) refuse(`${rel} has no frontmatter`);
    if (integerField(frontmatter[1], 'kw') !== issue.week || integerField(frontmatter[1], 'year') !== issue.year) {
      refuse(`${rel}: frontmatter kw/year does not match the file name`);
    }
    const draft = /^draft\s*:\s*([^\s#]*)/m.exec(frontmatter[1]);
    if (draft && draft[1] !== 'false') refuse(`${rel} is a draft, not a published issue`);
    if (isAfter(issue, finalLegacyIssue)) {
      refuse(`${formatIssue(issue)} is already published — the final issue must be the latest published one`);
    }
    archive[rel] = sha256(bytes);
  }
  if (!Object.hasOwn(archive, fileOf(finalLegacyIssue))) {
    refuse(`${fileOf(finalLegacyIssue)} does not exist — the final issue must be a published one`);
  }
  return parseFreezeContract({ version: FREEZE_VERSION, state: 'frozen', finalLegacyIssue: final, archive });
}

/** Die Zustandsdatei als Text (stabile Reihenfolge, damit Diffs lesbar bleiben). */
export function contractText(contract) {
  const value =
    contract.state === 'open'
      ? { version: FREEZE_VERSION, state: 'open' }
      : {
          version: FREEZE_VERSION,
          state: 'frozen',
          finalLegacyIssue: formatIssue(contract.finalLegacyIssue),
          archive: Object.fromEntries(Object.keys(contract.archive).sort().map((file) => [file, contract.archive[file]])),
        };
  return `${JSON.stringify(value, null, 2)}\n`;
}

/** Schreibt „frozen" in die Zustandsdatei — nur aus „open" heraus, und nur, wenn danach alles stimmt. */
export function freezeRepository(root, finalLabel, file = CONTRACT_FILE) {
  const current = readFreezeContract(file);
  if (current.state === 'frozen') {
    throw new WeeklyArchiveFrozenError(`the weekly archive is already frozen at ${formatIssue(current.finalLegacyIssue)}`);
  }
  const frozen = buildFrozenContract(root, finalLabel);
  const remaining = freezeProblems(root, frozen);
  if (remaining.length) {
    throw new WeeklyArchiveFrozenError(`cannot freeze at ${formatIssue(frozen.finalLegacyIssue)}:\n${remaining.map((p) => `  · ${p}`).join('\n')}`);
  }
  fs.writeFileSync(file, contractText(frozen));
  return frozen;
}

export const ARTIFACT_SCHEMA = 'legacy-weekly-freeze-artifact-v1';

/** Kanonisches JSON (Schlüssel rekursiv sortiert, ohne Leerraum) — Grundlage jedes Hashes darin. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function git(root, args) {
  try {
    return execFileSync('git', ['-C', root, ...args], { encoding: 'utf-8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
  } catch {
    return null;
  }
}

/** Genau ein Frontmatter-Datum YYYY-MM-DD; sonst null. */
function dateField(frontmatter) {
  const lines = frontmatter.split(/\r?\n/).filter((line) => /^date\s*:/.test(line));
  const value = lines.length === 1 ? /^date\s*:\s*"?(\d{4}-\d{2}-\d{2})"?\s*(?:#.*)?$/.exec(lines[0]) : null;
  return value ? value[1] : null;
}

/**
 * Nachweisdokument des Archivs — nur lesend. Es enthält genug, damit ein Dritter ohne Zugriff auf
 * dieses Repo prüfen kann, welche Ausgabe die letzte ist und welche Bytes sie hat:
 *   - state / final / finalLegacyIssue: „open" ist ausdrücklich nicht final (final: false).
 *   - issues[]: jede veröffentlichte Ausgabe mit Datei, SHA-256, Frontmatter-Datum und dem Commit,
 *     der die Datei zuerst hinzugefügt hat (die Veröffentlichung auf main).
 *   - archiveSha256: Hash über alle `Datei<TAB>SHA-256`-Zeilen; feed: der Stand von /briefing/feed.xml.
 *   - repository.revision / dirty: der Commit, aus dem das Dokument erzeugt wurde.
 * `artifactSha256` deckt alles außer sich selbst und `generatedAt` ab.
 * Ein Archiv, das dem Zustand widerspricht (frozen, aber verändert), erzeugt kein Dokument.
 */
export function buildFreezeArtifact(root = ROOT, { contract = readFreezeContract(), now = new Date() } = {}) {
  const problems = freezeProblems(root, contract);
  if (problems.length) {
    throw new WeeklyArchiveFrozenError(
      `no artifact: the archive does not match its state.\n${problems.map((p) => `  · ${p}`).join('\n')}`,
    );
  }
  const dir = path.join(root, BRIEFING_DIR);
  const { files, links } = walk(dir);
  if (links.length) throw new WeeklyArchiveFrozenError(`no artifact: symlink in the briefing directory (${links[0]})`);
  const issues = [];
  let drafts = 0;
  for (const rel of files) {
    const issue = issueOfFile(rel);
    if (!issue) throw new WeeklyArchiveFrozenError(`no artifact: ${rel} is not a kw-NN-YYYY.md issue file`);
    const bytes = fs.readFileSync(path.join(dir, rel));
    const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---/.exec(bytes.toString('utf-8'));
    if (!frontmatter) throw new WeeklyArchiveFrozenError(`no artifact: ${rel} has no frontmatter`);
    const draft = /^draft\s*:\s*([^\s#]*)/m.exec(frontmatter[1]);
    if (draft && draft[1] !== 'false') {
      drafts += 1;
      continue;
    }
    const date = dateField(frontmatter[1]);
    if (!date) throw new WeeklyArchiveFrozenError(`no artifact: ${rel} has no single YYYY-MM-DD date`);
    const first = git(root, ['log', '--diff-filter=A', '--reverse', '--format=%H%x09%cI', '--', `${BRIEFING_DIR}/${rel}`]);
    const [sha, committedAt] = first ? first.split('\n')[0].split('\t') : [null, null];
    issues.push({
      issue: formatIssue(issue),
      file: rel,
      sha256: sha256(bytes),
      date,
      firstCommit: sha ? { sha, committedAt } : null,
    });
  }
  // chronologisch (Jahr, Woche), nicht nach Dateiname: kw-01-2027 kommt nach kw-53-2026
  issues.sort((a, b) => {
    const x = issueOfFile(a.file);
    const y = issueOfFile(b.file);
    return x.year - y.year || x.week - y.week;
  });
  const latest = latestIssue(issues.map((i) => issueOfFile(i.file)));
  const today = now.toISOString().slice(0, 10);
  const feedItems = issues.filter((i) => i.date <= today).sort((a, b) => (a.date === b.date ? (a.issue < b.issue ? 1 : -1) : a.date < b.date ? 1 : -1));
  const status = git(root, ['status', '--porcelain']);
  const contractFile = path.join(root, 'scripts', path.basename(CONTRACT_FILE));
  const body = {
    schema: ARTIFACT_SCHEMA,
    state: contract.state,
    final: contract.state === 'frozen',
    finalLegacyIssue: contract.state === 'frozen' ? formatIssue(contract.finalLegacyIssue) : null,
    latestPublishedIssue: latest ? formatIssue(latest) : null,
    issueCount: issues.length,
    drafts,
    issues,
    archiveSha256: sha256(issues.map((i) => `${i.file}\t${i.sha256}\n`).join('')),
    feed: {
      path: '/briefing/feed.xml',
      items: feedItems.length,
      latestItem: feedItems[0]?.issue ?? null,
      sha256: sha256(feedItems.map((i) => `${i.issue}\t${i.date}\n`).join('')),
    },
    repository: { revision: git(root, ['rev-parse', 'HEAD']), dirty: status === null ? null : status !== '' },
    contract: { file: 'scripts/legacy-weekly-freeze.json', sha256: sha256(fs.readFileSync(contractFile)) },
  };
  return { ...body, generatedAt: now.toISOString(), artifactSha256: sha256(canonicalJson(body)) };
}

function main(argv) {
  const [command] = argv;
  const option = (name) => {
    const at = argv.indexOf(`--${name}`);
    return at >= 0 ? argv[at + 1] : undefined;
  };
  if (command === 'status') {
    const contract = readFreezeContract();
    const issues = walk(path.join(ROOT, BRIEFING_DIR)).files.map(issueOfFile).filter(Boolean);
    const latest = latestIssue(issues);
    const problems = freezeProblems(ROOT, contract);
    problems.forEach((p) => console.error(`✗ ${p}`));
    // Ließe sich das Archiv jetzt bei der jüngsten Ausgabe einfrieren? Nur Auskunft, kein Fehler.
    let freezable = null;
    if (contract.state === 'open' && latest) {
      try {
        buildFrozenContract(ROOT, formatIssue(latest));
        freezable = true;
      } catch (error) {
        freezable = false;
        console.error(`note: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    console.log(
      JSON.stringify({
        state: contract.state,
        finalLegacyIssue: contract.state === 'frozen' ? formatIssue(contract.finalLegacyIssue) : null,
        latestPublishedIssue: latest ? formatIssue(latest) : null,
        issues: issues.length,
        freezable,
        ok: problems.length === 0,
      }),
    );
    return problems.length ? 1 : 0;
  }
  if (command === 'artifact') {
    const artifact = buildFreezeArtifact(ROOT);
    const text = `${JSON.stringify(artifact, null, 2)}\n`;
    const out = option('out');
    if (out) fs.writeFileSync(out, text, { flag: 'wx' });
    else process.stdout.write(text);
    return 0;
  }
  if (command === 'freeze') {
    const final = option('final');
    if (!final) throw new Error('explicit --final YYYY-KWNN required');
    const frozen = freezeRepository(ROOT, final);
    console.log(
      JSON.stringify({ state: 'frozen', finalLegacyIssue: formatIssue(frozen.finalLegacyIssue), issues: Object.keys(frozen.archive).length }),
    );
    return 0;
  }
  throw new Error('usage: legacy-weekly-freeze.mjs status | artifact [--out <file>] | freeze --final YYYY-KWNN');
}

// Als Kommando gestartet (nicht importiert)? Über realpath verglichen, damit Symlinks im Pfad nicht stören.
if (process.argv[1] && fs.existsSync(process.argv[1]) && fs.realpathSync(process.argv[1]) === fs.realpathSync(fileURLToPath(import.meta.url))) {
  try {
    process.exit(main(process.argv.slice(2)));
  } catch (error) {
    console.error(`✗ ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
}
