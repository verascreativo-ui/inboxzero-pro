import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { extractAdvancedMetadata } from './extract.js';
import { getProviderStatus } from './providers/index.js';

const app = express();
const PORT = Number(process.env.PORT) || 8787;
const corsOrigin = process.env.CORS_ORIGIN || '*';

app.use(
  cors({
    origin: corsOrigin === '*' ? true : corsOrigin.split(',').map((s) => s.trim()),
  })
);
app.use(express.json({ limit: '1mb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'inboxzero-extract-api', providers: getProviderStatus() });
});

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
  const url = String(req.query.url || req.body?.url || '').trim();
  if (!url) {
    return res.status(400).json({ status: 'fail', message: 'Parámetro url requerido' });
  }

  const result = await extractAdvancedMetadata(url);
  const httpStatus = result.status === 'success' ? 200 : result.code === 'NO_PROVIDER' ? 503 : 422;
  return res.status(httpStatus).json(result);
}

app.get('/api/extract', handleExtract);
app.post('/api/extract', handleExtract);

app.listen(PORT, () => {
  const status = getProviderStatus();
  console.log(`[InboxZero Extract] http://localhost:${PORT}`);
  console.log(`[InboxZero Extract] providers:`, status);
  if (!status.scrapingbee && !status.zenrows && !status.puppeteer) {
    console.warn(
      '[InboxZero Extract] Aviso: configura SCRAPINGBEE_API_KEY o ZENROWS_API_KEY en server/.env'
    );
  }
});
