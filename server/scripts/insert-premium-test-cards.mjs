/**
 * Prueba controlada: insertar 25 fichas para una cuenta Premium.
 * service_role salta RLS; el trigger de límite Free sigue activo.
 *
 * Uso (desde server/): node scripts/insert-premium-test-cards.mjs
 */
import 'dotenv/config';

const TEST_EMAIL = 'verascreativo@gmail.com';
const CARD_COUNT = 25;

function supabaseConfig() {
  const url = String(process.env.SUPABASE_URL || '').trim().replace(/\/$/, '');
  const key = String(process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
  return { url, key };
}

function adminHeaders() {
  const { key } = supabaseConfig();
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
  };
}

async function adminFetch(path, options = {}) {
  const { url, key } = supabaseConfig();
  if (!url || !key) {
    throw new Error('Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY en server/.env');
  }
  const res = await fetch(`${url}${path}`, {
    ...options,
    headers: { ...adminHeaders(), ...(options.headers || {}) },
    signal: AbortSignal.timeout(20000),
  });
  const text = await res.text();
  let json = null;
  if (text) {
    try {
      json = JSON.parse(text);
    } catch (_) {
      json = { raw: text };
    }
  }
  if (!res.ok) {
    const detail = json && (json.message || json.hint || json.details || json.code);
    throw new Error(`Supabase ${res.status} ${path}${detail ? `: ${detail}` : ''}`);
  }
  return json;
}

async function findProfileByEmail(email) {
  const q = encodeURIComponent(email);
  const rows = await adminFetch(
    `/rest/v1/profiles?email=eq.${q}&select=id,email,nombre,tipo_plan`
  );
  return Array.isArray(rows) && rows[0] ? rows[0] : null;
}

async function countCards(userId) {
  const { url, key } = supabaseConfig();
  const res = await fetch(
    `${url}/rest/v1/cards?user_id=eq.${encodeURIComponent(userId)}&select=id`,
    {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Prefer: 'count=exact',
        Range: '0-0',
      },
      signal: AbortSignal.timeout(15000),
    }
  );
  if (!res.ok) {
    throw new Error(`No se pudo contar fichas (${res.status})`);
  }
  const range = res.headers.get('content-range') || '';
  const total = range.split('/')[1];
  return Number(total);
}

function buildTestCards(userId) {
  const rows = [];
  for (let i = 1; i <= CARD_COUNT; i += 1) {
    rows.push({
      user_id: userId,
      title: `Ficha de prueba ${i}`,
      description: `Ficha de prueba Premium ${i} (inserción controlada).`,
      url: `https://ejemplo.com/prueba-${i}`,
      category: 'uncategorized',
      favorite: false,
      readLater: false,
      notes: 'prueba-premium-25',
      image: '',
    });
  }
  return rows;
}

async function main() {
  const profile = await findProfileByEmail(TEST_EMAIL);
  if (!profile) {
    throw new Error(`No hay perfil con email ${TEST_EMAIL}`);
  }

  const plan = String(profile.tipo_plan || '').toLowerCase();
  console.log('Usuario:', profile.id);
  console.log('Email:', profile.email);
  console.log('tipo_plan:', profile.tipo_plan);

  if (plan !== 'premium') {
    throw new Error(
      `Abortado: tipo_plan=${profile.tipo_plan || '(vacío)'}. Esta prueba solo inserta si es premium.`
    );
  }

  const before = await countCards(profile.id);
  console.log('Fichas antes:', before);

  const inserted = await adminFetch('/rest/v1/cards', {
    method: 'POST',
    body: JSON.stringify(buildTestCards(profile.id)),
  });

  const after = await countCards(profile.id);
  console.log('Insertadas en este lote:', Array.isArray(inserted) ? inserted.length : 0);
  console.log('Fichas después:', after);

  if (after < 21) {
    throw new Error(
      `La cuenta sigue por debajo de 21 fichas (${after}). No se ha demostrado el bypass del límite Free.`
    );
  }

  console.log('OK: la cuenta Premium tiene más de 20 fichas.');
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
