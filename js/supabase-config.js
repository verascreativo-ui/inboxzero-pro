// ===================================================
// CONFIGURACIÓN OFICIAL DE INBOX ZERO CON SUPABASE
// (Solo credenciales públicas del cliente. ScrapingBee va en server/.env)
// ===================================================

(function initInboxZeroSupabase() {
  'use strict';

  // Project URL (sin /rest/v1/) + anon key pública
  const supabaseUrl = 'https://icnxekdvaxyrrbckbjjq.supabase.co';
  const supabaseAnonKey =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imljbnhla2R2YXh5cnJiY2tiampxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYxMzU3OTIsImV4cCI6MjEwMTcxMTc5Mn0.RJjbaq3V1nhuQRW85Ha2V_sIo5DAeH3dmrPRM3NW8io';

  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    console.error('[Supabase] Error: la librería no se ha cargado correctamente desde index.html');
    window.inboxZeroSupabase = null;
    return;
  }

  try {
    window.inboxZeroSupabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);
  } catch (err) {
    console.error('[Supabase] No se pudo inicializar el cliente:', err);
    window.inboxZeroSupabase = null;
  }
})();
