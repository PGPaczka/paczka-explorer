import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// ─── Config ────────────────────────────────────────────────────────────────────
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

const FILES_ROOT = path.resolve(PROJECT_ROOT, process.env.FILES_ROOT || 'Paczki INFA - Uporządkowane');
const INDEX_FILE = path.resolve(PROJECT_ROOT, process.env.INDEX_FILE || 'INDEKS.csv');
const INDEX_DIR_FILE = path.resolve(PROJECT_ROOT, process.env.INDEX_DIR_FILE || 'INDEKS_DIR.csv');

// ─── Description / Category mapping ───────────────────────────────────────────
const CATEGORY_DESC: Record<string, string> = {
  'Egzaminy': 'Egzamin',
  'Egzamin': 'Egzamin',
  'Kolokwia': 'Kolokwium',
  'Kolokwium': 'Kolokwium',
  'Wyklady': 'Wykład',
  'Cwiczenia': 'Ćwiczenia',
  'Laboratoria': 'Laboratorium',
  'Inne': 'Inne',
  'Projekty': 'Projekt',
};

// ─── Helpers ───────────────────────────────────────────────────────────────────

function detectSemester(relativePath: string): string {
  const match = relativePath.match(/Semestr (\d+)/);
  if (match) {
    return `Semestr ${match[1]}`;
  }
  return 'Ogólne';
}

function detectSubject(relativePath: string): string {
  const parts = relativePath.split(path.sep);
  for (let i = 0; i < parts.length; i++) {
    if (/^Semestr \d+$/.test(parts[i]) && i + 1 < parts.length) {
      return parts[i + 1];
    }
  }
  return 'Ogólne';
}

function detectDescription(relativePath: string): string {
  const parts = relativePath.split(path.sep);
  // Walk from deepest folder toward root (skip filename)
  for (let i = parts.length - 2; i >= 0; i--) {
    if (CATEGORY_DESC[parts[i]]) {
      return CATEGORY_DESC[parts[i]];
    }
  }
  return '';
}

// ─── Phase 1: Regenerate raw index ────────────────────────────────────────────

interface DirEntry {
  relDir: string;
  fileCount: number;
}

function regenerateRaw(): string[] {
  const allFiles: string[] = [];
  const allDirs: DirEntry[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    let fileCount = 0;

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;

      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        allFiles.push(fullPath);
        fileCount++;
      }
    }

    const relDir = path.relative(FILES_ROOT, dir);
    if (relDir && relDir !== '.') {
      allDirs.push({ relDir, fileCount });
    }
  }

  walk(FILES_ROOT);

  allFiles.sort();
  allDirs.sort((a, b) => a.relDir.localeCompare(b.relDir));

  // Write INDEKS_DIR.csv
  const dirLines: string[] = ['ŚCIEŻKA KATALOGU; LICZBA PLIKÓW; GŁĘBOKOŚĆ'];
  for (const { relDir, fileCount } of allDirs) {
    const depth = relDir.split(path.sep).length;
    dirLines.push(`${relDir}; ${fileCount}; ${depth}`);
  }
  fs.writeFileSync(INDEX_DIR_FILE, dirLines.join('\n'), 'utf-8');
  console.log(`Zapisano ${allDirs.length} katalogów do ${INDEX_DIR_FILE}`);

  console.log(`Znaleziono ${allFiles.length} plików`);
  return allFiles;
}

// ─── Phase 2: Generate structured index ───────────────────────────────────────

function generateIndex(allFiles: string[]): void {
  const outputLines: string[] = [];
  outputLines.push('ŚCIEŻKA PLIKU; SEMESTR; PRZEDMIOT; ROZMIAR (B); OPIS ZAWARTOŚCI');
  outputLines.push('='.repeat(140));

  for (const filePath of allFiles) {
    const relativePath = path.relative(FILES_ROOT, filePath);

    const semester = detectSemester(relativePath);
    const subject = detectSubject(relativePath);
    const description = detectDescription(relativePath);

    let fileSize: number | string;
    try {
      const stats = fs.statSync(filePath);
      fileSize = stats.size;
    } catch {
      fileSize = '?';
    }

    outputLines.push(`${relativePath}; ${semester}; ${subject}; ${fileSize}; ${description}`);
  }

  fs.writeFileSync(INDEX_FILE, outputLines.join('\n'), 'utf-8');
  console.log(`Wygenerowano indeks: ${INDEX_FILE}`);
  console.log(`Liczba zindeksowanych plików: ${outputLines.length - 2}`);
}

// ─── Main ──────────────────────────────────────────────────────────────────────

function main(): void {
  console.log(`FILES_ROOT: ${FILES_ROOT}`);
  console.log(`INDEX_FILE: ${INDEX_FILE}`);
  console.log(`INDEX_DIR_FILE: ${INDEX_DIR_FILE}`);
  console.log('');

  // Phase 1
  console.log('--- Faza 1: Skanowanie plików ---');
  const allFiles = regenerateRaw();
  console.log('');

  // Phase 2
  console.log('--- Faza 2: Generowanie indeksu ---');
  generateIndex(allFiles);
}

main();
