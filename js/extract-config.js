// ===================================================
// API de extracción avanzada (backend InboxZero)
// ===================================================
// Facebook / Instagram / LinkedIn requieren proxy residencial.
//
// 1) cd server && npm install
// 2) Copia .env.example → .env
// 3) Añade SCRAPINGBEE_API_KEY o ZENROWS_API_KEY (o SCRAPE_API_KEY)
// 4) npm start  →  http://localhost:8787
//
// Frontend: GET /api/extract?url=... → title / description / image al modal.
// Solo se activa por defecto en desarrollo local. En producción el frontend
// no llama a localhost:8787 (fallbacks Microlink / favicon / placeholder).

(function () {
  if (window.INBOXZERO_EXTRACT_API) return;
  try {
    const host = String((window.location && window.location.hostname) || '').toLowerCase();
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (isLocal) {
      window.INBOXZERO_EXTRACT_API = 'http://localhost:8787';
    }
  } catch (_) {
    /* sin API: el frontend usa los fallbacks existentes */
  }
})();
