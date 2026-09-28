import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { after, before, test } from 'node:test';
import pg from 'pg';
import { createApp } from '../src/app.js';

const url = process.env.TEST_DATABASE_URL;
if (!url) throw new Error('Atur TEST_DATABASE_URL ke database PostgreSQL khusus pengujian.');

const schema = `test_${randomUUID().replaceAll('-', '')}`;
const admin = new pg.Pool({ connectionString: url });
const pool = new pg.Pool({ connectionString: url, options: `-c search_path=${schema}` });
let server;
let base;

async function api(path, method = 'GET', body) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}

before(async () => {
  await admin.query(`CREATE SCHEMA ${schema}`);
  const sql = await readFile(new URL('../sql/001_create_tasks.sql', import.meta.url), 'utf8');
  await pool.query(sql);
  server = createApp(pool).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
  await admin.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await admin.end();
});

test('API CRUD, validasi, filter, pencarian, dan paginasi', async () => {
  let result = await api('/api/tasks');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.pagination, { page: 1, limit: 10, total: 0, totalPages: 0 });

  result = await api('/api/tasks', 'POST', { title: '   ' });
  assert.equal(result.status, 400);
  assert.ok(result.body.error.message);
  assert.equal((await api('/api/tasks', 'POST', { title: 'X', status: 'blocked' })).status, 400);
  assert.equal((await api('/api/tasks', 'POST', { title: 'X'.repeat(121) })).status, 400);
  assert.equal((await api('/api/tasks', 'POST', { title: 'X', description: 'a'.repeat(1001) })).status, 400);

  const ids = [];
  for (const status of ['new', 'in progress', 'in testing', 'done']) {
    result = await api('/api/tasks', 'POST', { title: `Task ${status}`, description: 'Catatan penting', status });
    assert.equal(result.status, 201);
    assert.equal(typeof result.body.id, 'string');
    assert.equal(result.body.status, status);
    ids.push(result.body.id);
  }

  result = await api(`/api/tasks/${ids[0]}`, 'PUT', { title: '  Review akhir  ', description: 'Selesai', status: 'done' });
  assert.equal(result.status, 200);
  assert.equal(result.body.title, 'Review akhir');
  assert.equal(result.body.status, 'done');
  assert.equal((await api(`/api/tasks/${ids[0]}`, 'PUT', { title: 'X' })).status, 400);

  result = await api('/api/tasks?status=done&search=REVIEW');
  assert.equal(result.body.pagination.total, 1);
  assert.equal(result.body.data[0].id, ids[0]);
  result = await api('/api/tasks?search=CATATAN');
  assert.equal(result.body.pagination.total, 3);

  await api('/api/tasks', 'POST', { title: '100% siap' });
  result = await api('/api/tasks?search=%25');
  assert.equal(result.body.pagination.total, 1);
  for (let index = 0; index < 9; index++) await api('/api/tasks', 'POST', { title: `Tambahan ${index}` });
  result = await api('/api/tasks?page=2&limit=10');
  assert.equal(result.body.pagination.total, 14);
  assert.equal(result.body.pagination.totalPages, 2);
  assert.equal(result.body.data.length, 4);

  assert.equal((await api('/api/tasks?status=unknown')).status, 400);
  assert.equal((await api('/api/tasks?page=0')).status, 400);
  assert.equal((await api('/api/tasks?limit=101')).status, 400);
  assert.equal((await api('/api/tasks/999999999', 'PUT', { title: 'X', description: '', status: 'new' })).status, 404);
  assert.equal((await api('/api/tasks/999999999', 'DELETE')).status, 404);
  assert.equal((await api(`/api/tasks/${ids[1]}`, 'DELETE')).status, 204);
  assert.equal((await api('/api/tasks')).body.pagination.total, 13);
});

test('dokumentasi Swagger tersedia di /docs', async () => {
  const page = await fetch(`${base}/docs/`);
  assert.equal(page.status, 200);
  assert.match(await page.text(), /swagger-ui/);

  const specification = await fetch(`${base}/docs/openapi.json`);
  assert.equal(specification.status, 200);
  const body = await specification.json();
  assert.equal(body.openapi, '3.0.3');
  assert.deepEqual(Object.keys(body.paths).sort(), ['/api/tasks', '/api/tasks/{id}']);
});
