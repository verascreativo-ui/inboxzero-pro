/**
 * Prueba controlada: insertar 19 fichas (1 por debajo del límite Free de 20).
 * Marcadas con notes = 'prueba-checkout-19' para borrarlas después.
 *
 * Uso (desde server/): node scripts/insert-checkout-test-19-cards.mjs
 */
import 'dotenv/config';

const TEST_EMAIL = 'fernando.delavera+prueba1@gmail.com';
const CARD_COUNT = 19;
const TEST_NOTES = 'prueba-checkout-19';

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

async function countCards(userId, notes) {
  const { url, key } = supabaseConfig();
  let path = `/rest/v1/cards?user_id=eq.${encodeURIComponent(userId)}&select=id`;
  if (notes) path += `&notes=eq.${encodeURIComponent(notes)}`;
  const res = await fetch(`${url}${path}`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      Prefer: 'count=exact',
      Range: '0-0',
    },
    signal: AbortSignal.timeout(15000),
  });
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
      description: `Ficha de prueba checkout ${i} (inserción controlada).`,
      url: `https://ejemplo.com/prueba-${i}`,
      category: 'uncategorized',
      favorite: false,
      readLater: false,
      notes: TEST_NOTES,
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

  console.log('Usuario:', profile.id);
  console.log('Email:', profile.email);
  console.log('tipo_plan:', profile.tipo_plan);

  const before = await countCards(profile.id);
  const beforeTagged = await countCards(profile.id, TEST_NOTES);
  console.log('Fichas antes (total):', before);
  console.log(`Fichas antes (notes=${TEST_NOTES}):`, beforeTagged);

  const inserted = await adminFetch('/rest/v1/cards', {
    method: 'POST',
    body: JSON.stringify(buildTestCards(profile.id)),
  });

  const after = await countCards(profile.id);
  const afterTagged = await countCards(profile.id, TEST_NOTES);
  const insertedCount = Array.isArray(inserted) ? inserted.length : 0;
  console.log('Insertadas en este lote:', insertedCount);
  console.log('Fichas después (total):', after);
  console.log(`Fichas después (notes=${TEST_NOTES}):`, afterTagged);

  if (insertedCount !== CARD_COUNT || afterTagged !== beforeTagged + CARD_COUNT) {
    throw new Error(
      `Se esperaban ${CARD_COUNT} fichas con notes=${TEST_NOTES}; lote=${insertedCount}, tagged=${afterTagged}`
    );
  }

  console.log(`OK: ${CARD_COUNT} fichas insertadas con notes=${TEST_NOTES}.`);
}

main().catch((err) => {
  console.error('Error:', err.message || err);
  process.exit(1);
});
