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

window.INBOXZERO_EXTRACT_API =
  window.INBOXZERO_EXTRACT_API || 'http://localhost:8787';
