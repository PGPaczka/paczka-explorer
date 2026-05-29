import path from 'path';
import dotenv from 'dotenv';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

export const FILES_ROOT = path.resolve(process.env.FILES_ROOT || path.join(__dirname, '..', '..', '..', 'Paczki INFA - Uporządkowane'));
export const PENDING_DIR = path.resolve(process.env.PENDING_DIR || path.join(__dirname, '..', 'pending'));
export const PENDING_META = path.join(PENDING_DIR, 'pending_meta.json');
export const INDEX_FILE = path.resolve(process.env.INDEX_FILE || path.join(__dirname, '..', '..', '..', 'INDEKS.csv'));
export const INDEX_DIR_FILE = path.resolve(process.env.INDEX_DIR_FILE || path.join(__dirname, '..', '..', '..', 'INDEKS_DIR.csv'));
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
export const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024;
export const PORT = parseInt(process.env.PORT || '8081');
export const GITHUB_PR_URL = process.env.GITHUB_PR_URL || 'https://github.com/dommilosz/Paczka-eti-pg/pulls';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
export const MAX_FILES_PER_UPLOAD = 10;
