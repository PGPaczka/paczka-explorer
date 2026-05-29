import express from 'express';
import path from 'path';
import fs from 'fs';
import cors from 'cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { PORT, CORS_ORIGIN, PENDING_DIR, FILES_ROOT } from './config';

import authRoutes from './routes/auth';
import browseRoutes from './routes/browse';
import searchRoutes from './routes/searchRoute';
import filesRoutes from './routes/files';
import zipRoutes from './routes/zip';
import zipBrowseRoutes from './routes/zipBrowse';
import adminRoutes from './routes/admin';
import { loadIndex, watchIndex } from './search';
import { rateLimitGeneral } from './rateLimit';

// Ensure pending dir exists
fs.mkdirSync(PENDING_DIR, { recursive: true });

// Pre-load search index into memory for fast queries
loadIndex();
watchIndex();

const app = express();

// ============ MIDDLEWARE ============

const corsOrigins = CORS_ORIGIN.split(',').map(o => o.trim());
app.use(cors({
  origin: corsOrigins.length === 1 && corsOrigins[0] === '*' ? true : corsOrigins,
  credentials: true,
}));
app.use(compression());
app.use(cookieParser());
app.use(express.json());

// Rate limiting on API routes
app.use('/api/', rateLimitGeneral);

// ============ ROUTES ============

app.use(authRoutes);
app.use(browseRoutes);
app.use(searchRoutes);
app.use(filesRoutes);
app.use(zipRoutes);
app.use(zipBrowseRoutes);
app.use(adminRoutes);

// ============ SERVE REACT FRONTEND ============

const FRONTEND_BUILD = path.join(__dirname, '..', '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use('/assets', express.static(path.join(FRONTEND_BUILD, 'assets')));
  app.get('*', (_req, res) => {
    const index = path.join(FRONTEND_BUILD, 'index.html');
    if (fs.existsSync(index)) return res.sendFile(index);
    res.status(404).json({ detail: 'Frontend not built' });
  });
}

// ============ START ============

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Paczka INFA backend running on http://0.0.0.0:${PORT}`);
  console.log(`FILES_ROOT: ${FILES_ROOT}`);
});
