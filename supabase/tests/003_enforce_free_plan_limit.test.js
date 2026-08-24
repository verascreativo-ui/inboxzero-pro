import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(here, '..', 'migrations', '003_serialize_free_plan_card_limit.sql');
const sql001Path = path.join(here, '..', 'migrations', '001_inboxzero_schema.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');
const sql001 = fs.readFileSync(sql001Path, 'utf8');
const body = sql.slice(sql.indexOf('as $$'));

test('003 no edita 001/002: es CREATE OR REPLACE de la función existente', () => {
  assert.match(sql, /create or replace function public\.enforce_free_plan_card_limit\(\)/i);
  assert.doesNotMatch(sql, /drop table/i);
  assert.doesNotMatch(sql, /drop trigger/i);
  assert.doesNotMatch(sql, /drop policy/i);
});

test('el lock advisory va antes del COUNT y solo en plan free', () => {
  const freeIdx = body.indexOf("if plan = 'free' then");
  const lockIdx = body.indexOf('pg_advisory_xact_lock');
  const countIdx = body.search(/select count\(\*\)/i);
  assert.ok(freeIdx > 0);
  assert.ok(lockIdx > freeIdx, 'el lock debe estar dentro del branch free');
  assert.ok(countIdx > lockIdx, 'COUNT(*) debe ir después del lock');
  assert.match(sql, /pg_advisory_xact_lock\(\s*872001\s*,\s*hashtext\(new\.user_id::text\)\s*\)/);
});

test('conserva límite 20, mensaje y error de perfil', () => {
  assert.match(sql, /free_limit constant integer := 20/);
  assert.match(
    sql,
    /Límite del plan gratuito alcanzado \(% fichas\)\. Actualiza a premium para guardar más\./
  );
  assert.match(sql, /Perfil no encontrado para el usuario %/);
  assert.match(sql, /errcode = 'P0001'/);
});

test('premium no toma el advisory lock', () => {
  const freeIdx = body.indexOf("if plan = 'free' then");
  const lockIdx = body.indexOf('pg_advisory_xact_lock');
  const returnIdx = body.lastIndexOf('return new');
  assert.ok(freeIdx > 0 && lockIdx > freeIdx && lockIdx < returnIdx);
  const beforeFree = body.slice(0, freeIdx);
  assert.doesNotMatch(beforeFree, /pg_advisory_xact_lock/);
});

test('001 original documenta la carrera (COUNT sin lock)', () => {
  const fn = sql001.slice(sql001.indexOf('enforce_free_plan_card_limit'));
  const oldBody = fn.slice(0, fn.indexOf('$$;'));
  assert.match(oldBody, /select count\(\*\)/i);
  assert.doesNotMatch(oldBody, /pg_advisory_xact_lock/);
  assert.doesNotMatch(oldBody, /for update/i);
});
