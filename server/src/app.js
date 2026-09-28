import express from 'express';
import swaggerUi from 'swagger-ui-express';
import { openapi } from './openapi.js';

const STATUSES = new Set(['new', 'in progress', 'in testing', 'done']);
const COLUMNS = 'id, title, description, status, created_at, updated_at';

function fail(res, status, message) {
  return res.status(status).json({ error: { message } });
}

function positiveInteger(value, fallback, max = Number.MAX_SAFE_INTEGER) {
  if (value === undefined) return fallback;
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number <= max ? number : null;
}

function validId(value) {
  return /^[1-9]\d*$/.test(value) && BigInt(value) <= 9223372036854775807n;
}

function validateTask(body, isCreate) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return 'Body task tidak valid.';
  const { title, description = isCreate ? '' : undefined, status = isCreate ? 'new' : undefined } = body;
  if (typeof title !== 'string' || !title.trim()) return 'Judul wajib diisi.';
  if (title.trim().length > 120) return 'Judul maksimal 120 karakter.';
  if (typeof description !== 'string' || description.length > 1000) return 'Deskripsi maksimal 1.000 karakter.';
  if (!STATUSES.has(status)) return 'Status tidak valid.';
  return { title: title.trim(), description, status };
}

function escapeLike(value) {
  return value.replace(/[\\%_]/g, '\\$&');
}

export function createApp(pool) {
  const app = express();
  app.use(express.json());
  app.get('/docs/openapi.json', (_req, res) => res.json(openapi));
  app.use('/docs', swaggerUi.serve, swaggerUi.setup(openapi, { customSiteTitle: 'Ruang Tugas API' }));

  app.get('/api/tasks', async (req, res, next) => {
    try {
      const status = req.query.status ?? '';
      const search = req.query.search ?? '';
      const page = positiveInteger(req.query.page, 1, Math.floor(Number.MAX_SAFE_INTEGER / 100));
      const limit = positiveInteger(req.query.limit, 10, 100);
      if (typeof status !== 'string' || (status && !STATUSES.has(status))) return fail(res, 400, 'Filter status tidak valid.');
      if (typeof search !== 'string') return fail(res, 400, 'Kata pencarian tidak valid.');
      if (page === null || limit === null) return fail(res, 400, 'Halaman atau jumlah task tidak valid.');

      const conditions = [];
      const values = [];
      if (status) {
        values.push(status);
        conditions.push(`status = $${values.length}`);
      }
      if (search.trim()) {
        values.push(`%${escapeLike(search.trim())}%`);
        conditions.push(`(title ILIKE $${values.length} ESCAPE '\\' OR description ILIKE $${values.length} ESCAPE '\\')`);
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const count = await pool.query(`SELECT count(*)::int AS total FROM tasks ${where}`, values);
      const total = count.rows[0].total;
      const offset = (page - 1) * limit;
      values.push(limit, offset);
      const tasks = await pool.query(
        `SELECT ${COLUMNS} FROM tasks ${where} ORDER BY created_at DESC, id DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
        values
      );
      res.json({ data: tasks.rows, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } });
    } catch (error) {
      next(error);
    }
  });

  app.post('/api/tasks', async (req, res, next) => {
    try {
      const task = validateTask(req.body, true);
      if (typeof task === 'string') return fail(res, 400, task);
      const result = await pool.query(
        `INSERT INTO tasks (title, description, status) VALUES ($1, $2, $3) RETURNING ${COLUMNS}`,
        [task.title, task.description, task.status]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.put('/api/tasks/:id', async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return fail(res, 400, 'ID task tidak valid.');
      const task = validateTask(req.body, false);
      if (typeof task === 'string') return fail(res, 400, task);
      const result = await pool.query(
        `UPDATE tasks SET title = $1, description = $2, status = $3, updated_at = now() WHERE id = $4 RETURNING ${COLUMNS}`,
        [task.title, task.description, task.status, req.params.id]
      );
      if (!result.rows.length) return fail(res, 404, 'Task tidak ditemukan.');
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.delete('/api/tasks/:id', async (req, res, next) => {
    try {
      if (!validId(req.params.id)) return fail(res, 400, 'ID task tidak valid.');
      const result = await pool.query('DELETE FROM tasks WHERE id = $1 RETURNING id', [req.params.id]);
      if (!result.rows.length) return fail(res, 404, 'Task tidak ditemukan.');
      res.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  app.use('/api', (_req, res) => fail(res, 404, 'Endpoint API tidak ditemukan.'));

  app.use((error, _req, res, _next) => {
    if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
      return fail(res, 400, 'JSON tidak valid.');
    }
    if (error.type === 'entity.too.large') return fail(res, 400, 'Body task terlalu besar.');
    console.error(error);
    return fail(res, 500, 'Server sedang bermasalah. Coba lagi.');
  });

  return app;
}
