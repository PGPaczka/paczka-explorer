import path from 'path';
import dotenv from 'dotenv';

// Project root is 3 levels up from dist (dist/config.js -> backend -> fileserver -> root)
const PROJECT_ROOT = path.resolve(__dirname, '..', '..', '..');
dotenv.config({ path: path.join(PROJECT_ROOT, '.env') });

export const FILES_ROOT = path.resolve(PROJECT_ROOT, process.env.FILES_ROOT || 'Paczki INFA - Uporządkowane');
export const PENDING_DIR = path.resolve(PROJECT_ROOT, process.env.PENDING_DIR || 'fileserver/backend/pending');
export const PENDING_META = path.join(PENDING_DIR, 'pending_meta.json');
export const INDEX_FILE = path.resolve(PROJECT_ROOT, process.env.INDEX_FILE || 'INDEKS.csv');
export const INDEX_DIR_FILE = path.resolve(PROJECT_ROOT, process.env.INDEX_DIR_FILE || 'INDEKS_DIR.csv');
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024;
export const PORT = parseInt(process.env.PORT || '8081');
export const GITHUB_PR_URL = process.env.GITHUB_PR_URL || 'https://github.com/dommilosz/Paczka-eti-pg/pulls';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
export const MAX_FILES_PER_UPLOAD = 10;
