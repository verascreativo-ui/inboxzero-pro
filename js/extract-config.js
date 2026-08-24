// ===================================================
// API de extracción avanzada (backend InboxZero)
// ===================================================
// Facebook / Instagram / LinkedIn requieren proxy residencial.
//
// 1) cd server && npm install
// 2) Copia .env.example → .env
// 3) Añade SCRAPINGBEE_API_KEY o ZENROWS_API_KEY (o SCRAPE_API_KEY)
// 4) npm start  →  http://127.0.0.1:8787 (solo loopback)
// 5) En server/.env: SUPABASE_URL y SUPABASE_ANON_KEY (anon, no service_role)
//
// Frontend: GET /api/extract?url=... con Authorization Bearer (sesión Auth).
// Solo se activa por defecto en desarrollo local. En producción el frontend
// no llama a localhost:8787 (fallbacks Microlink / favicon / placeholder).

(function () {
  if (window.INBOXZERO_EXTRACT_API) return;
  try {
    const host = String((window.location && window.location.hostname) || '').toLowerCase();
    const isLocal = !host || host === 'localhost' || host === '127.0.0.1' || host === '[::1]';
    if (isLocal) {
      window.INBOXZERO_EXTRACT_API = 'http://localhost:8787';
    } else {
      window.INBOXZERO_EXTRACT_API = 'https://inboxzero-pro-production.up.railway.app';
    }
  } catch (_) {
    /* sin API: el frontend usa los fallbacks existentes */
  }
})();
