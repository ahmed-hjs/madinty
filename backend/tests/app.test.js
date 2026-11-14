require('./helpers/env');
const test = require('node:test');
const assert = require('node:assert/strict');
const app = require('../src/app');
const db = require('../src/config/db');

let server;
let base;

test.before(async () => {
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await db.pool.end();
});

const call = (path, options) => fetch(base + path, options);
const json = (body) => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('une route inconnue renvoie 404 en JSON', async () => {
  const res = await call('/api/inexistante');
  assert.equal(res.status, 404);
  assert.deepEqual(await res.json(), { error: 'Route introuvable.' });
});

test('/api/health renvoie 503 quand la base est injoignable', async () => {
  const res = await call('/api/health');
  assert.equal(res.status, 503);
  assert.deepEqual(await res.json(), { status: 'error', db: 'down' });
});

test('les en-têtes de sécurité helmet sont présents', async () => {
  const res = await call('/api/inexistante');
  assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(res.headers.get('x-powered-by'), null);
});

test('le CORS autorise l\'origine du frontend', async () => {
  const res = await call('/api/inexistante', { headers: { Origin: 'http://localhost:4200' } });
  assert.equal(res.headers.get('access-control-allow-origin'), 'http://localhost:4200');
});

test('un JSON invalide renvoie 400', async () => {
  const res = await call('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{pas du json' });
  assert.equal(res.status, 400);
  assert.deepEqual(await res.json(), { error: 'JSON invalide.' });
});

for (const path of [
  '/api/auth/me',
  '/api/reports/mine',
  '/api/reports/supported',
  '/api/notifications',
  '/api/organisme/reports',
  '/api/organisme/interventions',
  '/api/equipe/interventions',
  '/api/admin/users',
  '/api/admin/audit-logs',
]) {
  test(`${path} exige une authentification (401)`, async () => {
    const res = await call(path);
    assert.equal(res.status, 401);
  });
}

test('l\'inscription refuse un mot de passe faible (400)', async () => {
  const res = await call('/api/auth/register', json({ full_name: 'Test', email: 'test@example.com', password: 'faible', privacy_accepted: true }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.equal(body.error, 'Données invalides.');
  assert.ok(body.details.some((d) => d.champ === 'password'));
});

test('l\'inscription exige le consentement à la politique de confidentialité (400)', async () => {
  const res = await call('/api/auth/register', json({ full_name: 'Test', email: 'test@example.com', password: 'Motdepasse1', privacy_accepted: false }));
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.details.some((d) => d.champ === 'privacy_accepted'));
});

test('la connexion avec un e-mail invalide renvoie un message générique (401)', async () => {
  const res = await call('/api/auth/login', json({ email: 'invalide', password: 'x' }));
  assert.equal(res.status, 401);
  assert.deepEqual(await res.json(), { error: 'Identifiants invalides.' });
});
