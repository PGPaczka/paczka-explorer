import path from 'path';
import dotenv from 'dotenv';

const BACKEND_DIR = path.resolve(__dirname, '..');
const FILESERVER_DIR = path.resolve(BACKEND_DIR, '..');

// Load fileserver-specific .env
dotenv.config({ path: path.join(FILESERVER_DIR, '.env') });

export const FILES_ROOT = path.resolve(BACKEND_DIR, process.env.FILES_ROOT || 'paczka');
export const TEMP_DIR = path.resolve(
  BACKEND_DIR,
  process.env.TEMP_DIR || 'temp'
);
export const INDEX_FILE = path.resolve(BACKEND_DIR, process.env.INDEX_FILE || 'data/INDEKS.csv');
export const INDEX_DIR_FILE = path.resolve(BACKEND_DIR, process.env.INDEX_DIR_FILE || 'data/INDEKS_DIR.csv');
export const METADATA_DB_PATH_IS_EXPLICIT =
  typeof process.env.METADATA_DB_PATH === 'string' && process.env.METADATA_DB_PATH.trim().length > 0;
export const METADATA_DB_PATH = path.resolve(
  BACKEND_DIR,
  process.env.METADATA_DB_PATH || 'data/metadata.sqlite'
);
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
const SERVICE_TOKENS_RAW = process.env.SERVICE_TOKENS || process.env.SERVICE_TOKEN || '';
export const SERVICE_TOKENS = SERVICE_TOKENS_RAW
  .split(',')
  .map((token) => token.trim())
  .filter(Boolean);
export const MAX_UPLOAD_SIZE = parseInt(process.env.MAX_UPLOAD_MB || '10') * 1024 * 1024;
export const PORT = parseInt(process.env.PORT || '8081');
export const GITHUB_PR_URL = process.env.GITHUB_PR_URL || 'https://github.com/dommilosz/Paczka-eti-pg/pulls';
export const GITHUB_TOKEN = process.env.GITHUB_TOKEN || '';
export const GITHUB_REPO = process.env.GITHUB_REPO || '';
export const GITHUB_BASE_BRANCH = process.env.GITHUB_BASE_BRANCH || '';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '*';
export const MAX_FILES_PER_UPLOAD = 10;

// Rate limiting
export const RATE_LIMIT_WINDOW_MS = parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000');
export const RATE_LIMIT_MAX_REQUESTS = parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100');
export const RATE_LIMIT_UPLOAD_MAX = parseInt(process.env.RATE_LIMIT_UPLOAD_MAX || '10');
export const RATE_LIMIT_LOGIN_MAX = parseInt(process.env.RATE_LIMIT_LOGIN_MAX || '5');

// Discord webhook
export const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL || '';
