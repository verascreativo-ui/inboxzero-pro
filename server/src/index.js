import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { extractAdvancedMetadata } from './extract.js';
import { getProviderStatus } from './providers/index.js';
import { analyzePageImages } from './parse/page-images.js';
import { requireUser } from './require-user.js';
import { rateLimitExtract } from './rate-limit.js';

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const HOST = String(process.env.HOST || '127.0.0.1').trim() || '127.0.0.1';
const JSON_LIMIT = String(process.env.EXTRACT_JSON_LIMIT || '32kb').trim() || '32kb';
const REQUEST_TIMEOUT_MS = (() => {
  const n = Number(process.env.EXTRACT_REQUEST_TIMEOUT_MS);
  return Number.isFinite(n) && n > 0 ? n : 40000;
})();

function corsAllowlist() {
  const raw = String(process.env.CORS_ORIGIN || '').trim();
  if (!raw || raw === '*') {
    if (raw === '*') {
      console.warn(
        '[InboxZero Extract] CORS_ORIGIN=* no está permitido; usando localhost:5500'
      );
    }
    return ['http://localhost:5500', 'http://127.0.0.1:5500'];
  }
  const list = raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => s !== '*');
  return list.length ? list : ['http://localhost:5500', 'http://127.0.0.1:5500'];
}

const allowedOrigins = corsAllowlist();

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept'],
    methods: ['GET', 'POST', 'OPTIONS'],
    maxAge: 600,
  })
);
app.use(express.json({ limit: JSON_LIMIT }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'inboxzero-extract-api', providers: getProviderStatus() });
});

function sendSafeError(res, err) {
  const code = err && err.code ? String(err.code) : '';
  const name = err && err.name ? String(err.name) : '';
  if (code === 'TIMEOUT' || name === 'AbortError' || name === 'TimeoutError') {
    return res.status(500).json({ status: 'fail', message: 'Tiempo de espera agotado' });
  }
  console.error('[InboxZero Extract]', code || name || 'error');
  return res.status(500).json({ status: 'fail', message: 'Error interno' });
}

async function withRequestTimeout(work) {
  let timer;
  try {
    return await Promise.race([
      work(),
      new Promise((_, reject) => {
        timer = setTimeout(() => {
          const err = new Error('Tiempo de espera agotado');
          err.code = 'TIMEOUT';
          reject(err);
        }, REQUEST_TIMEOUT_MS);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * GET /api/extract?url=
 * POST /api/extract { "url": "https://..." }
 *
 * Respuesta:
 * {
 *   "status": "success",
 *   "data": { "title", "description", "image", "url", "platform", "provider" }
 * }
 */
async function handleExtract(req, res) {
  try {
    const url = String(req.query.url || req.body?.url || '').trim();
    if (!url) {
      return res.status(400).json({ status: 'fail', message: 'Parámetro url requerido' });
    }

    const result = await withRequestTimeout(() => extractAdvancedMetadata(url));
    const httpStatus = result.status === 'success' ? 200 : result.code === 'NO_PROVIDER' ? 503 : 422;
    return res.status(httpStatus).json(result);
  } catch (err) {
    return sendSafeError(res, err);
  }
}

/**
 * GET /api/page-images?url=
 * Fase 2 Paso 1 (aislado): candidatos de imagen + puntuación.
 * No altera /api/extract ni el frontend.
 */
async function handlePageImages(req, res) {
  try {
    const url = String(req.query.url || '').trim();
    if (!url) {
      return res.status(400).json({ status: 'fail', message: 'Parámetro url requerido' });
    }

    const result = await withRequestTimeout(() => analyzePageImages(url));
    const httpStatus =
      result.status === 'success' ? 200 : result.code === 'INVALID_URL' ? 400 : 422;
    return res.status(httpStatus).json(result);
  } catch (err) {
    return sendSafeError(res, err);
  }
}

const extractGuards = [rateLimitExtract, requireUser];

app.get('/api/extract', ...extractGuards, handleExtract);
app.post('/api/extract', ...extractGuards, handleExtract);
app.get('/api/page-images', ...extractGuards, handlePageImages);

app.listen(PORT, HOST, () => {
  const status = getProviderStatus();
  console.log(`[InboxZero Extract] http://${HOST}:${PORT}`);
  console.log(`[InboxZero Extract] cors:`, allowedOrigins.join(','));
  console.log(`[InboxZero Extract] providers:`, status);
  if (!status.scrapingbee && !status.zenrows && !status.puppeteer) {
    console.warn(
      '[InboxZero Extract] Aviso: configura SCRAPINGBEE_API_KEY o ZENROWS_API_KEY en server/.env'
    );
  }
});
