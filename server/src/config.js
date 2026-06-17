import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const ROOT = join(__dirname, '..');
export const DATA_DIR = join(ROOT, 'data');
export const UPLOAD_DIR = join(DATA_DIR, 'uploads');
export const DB_PATH = join(DATA_DIR, 'app.db');

export const PORT = Number(process.env.PORT) || 3001;

// Tokenlarni imzolash uchun maxfiy kalit. Ishlab chiqarishda env orqali bering.
export const SECRET = process.env.SECRET || 'dev-secret-change-me-in-production';

export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25 MB
export const TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 kun
