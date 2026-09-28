const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ 'application/json': { schema } });
const error = (description) => ({ description, content: json(ref('ApiError')) });
const taskResponse = (description) => ({ description, content: json(ref('Task')) });
const idParameter = {
  name: 'id', in: 'path', required: true,
  description: 'ID task sebagai string bilangan bulat positif.',
  schema: { type: 'string', pattern: '^[1-9][0-9]*$', example: '1' }
};

export const openapi = {
  openapi: '3.0.3',
  info: {
    title: 'Ruang Tugas API',
    version: '1.0.0',
    description: 'API untuk membuat, melihat, mengubah, menghapus, mencari, dan memfilter task.'
  },
  servers: [{ url: '/', description: 'Host aplikasi saat ini' }],
  tags: [{ name: 'Tasks', description: 'Pengelolaan task' }],
  components: {
    schemas: {
      TaskStatus: {
        type: 'string', enum: ['new', 'in progress', 'in testing', 'done'], example: 'new'
      },
      Task: {
        type: 'object',
        required: ['id', 'title', 'description', 'status', 'created_at', 'updated_at'],
        properties: {
          id: { type: 'string', description: 'BIGINT PostgreSQL dikirim sebagai string.', example: '1' },
          title: { type: 'string', maxLength: 120, example: 'Siapkan presentasi' },
          description: { type: 'string', maxLength: 1000, example: 'Untuk hari Jumat' },
          status: ref('TaskStatus'),
          created_at: { type: 'string', format: 'date-time', example: '2026-09-27T08:00:00.000Z' },
          updated_at: { type: 'string', format: 'date-time', example: '2026-09-27T08:00:00.000Z' }
        }
      },
      CreateTask: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', maxLength: 120, description: 'Wajib diisi setelah spasi tepi dihapus.', example: 'Siapkan presentasi' },
          description: { type: 'string', maxLength: 1000, default: '', example: 'Untuk hari Jumat' },
          status: { allOf: [ref('TaskStatus')], default: 'new' }
        }
      },
      ReplaceTask: {
        type: 'object',
        required: ['title', 'description', 'status'],
        properties: {
          title: { type: 'string', maxLength: 120, description: 'Wajib diisi setelah spasi tepi dihapus.' },
          description: { type: 'string', maxLength: 1000 },
          status: ref('TaskStatus')
        }
      },
      Pagination: {
        type: 'object',
        required: ['page', 'limit', 'total', 'totalPages'],
        properties: {
          page: { type: 'integer', minimum: 1, example: 1 },
          limit: { type: 'integer', minimum: 1, maximum: 100, example: 10 },
          total: { type: 'integer', minimum: 0, example: 24 },
          totalPages: { type: 'integer', minimum: 0, example: 3 }
        }
      },
      TaskList: {
        type: 'object',
        required: ['data', 'pagination'],
        properties: {
          data: { type: 'array', items: ref('Task') },
          pagination: ref('Pagination')
        }
      },
      ApiError: {
        type: 'object',
        required: ['error'],
        properties: {
          error: {
            type: 'object', required: ['message'],
            properties: { message: { type: 'string', example: 'Judul wajib diisi.' } }
          }
        }
      }
    }
  },
  paths: {
    '/api/tasks': {
      get: {
        tags: ['Tasks'], summary: 'Daftar task',
        description: 'Urut dari created_at terbaru, lalu id terbesar. Pencarian mencocokkan sebagian judul atau deskripsi tanpa membedakan kapital; karakter % dan _ diperlakukan sebagai teks biasa.',
        parameters: [
          { name: 'status', in: 'query', description: 'Kosong/tidak dikirim berarti semua status.', schema: ref('TaskStatus') },
          { name: 'search', in: 'query', description: 'Kata pencarian pada judul atau deskripsi.', schema: { type: 'string' } },
          { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1, default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100, default: 10 } }
        ],
        responses: {
          200: { description: 'Daftar task dan informasi paginasi. Jika kosong, totalPages bernilai 0.', content: json(ref('TaskList')) },
          400: error('Parameter status, page, limit, atau search tidak valid.'),
          500: error('Kesalahan server.')
        }
      },
      post: {
        tags: ['Tasks'], summary: 'Tambah task',
        requestBody: { required: true, content: json(ref('CreateTask')) },
        responses: {
          201: taskResponse('Task berhasil dibuat.'),
          400: error('Body JSON atau data task tidak valid.'),
          500: error('Kesalahan server.')
        }
      }
    },
    '/api/tasks/{id}': {
      put: {
        tags: ['Tasks'], summary: 'Ubah task',
        description: 'Mengganti judul, deskripsi, dan status sekaligus; updated_at diperbarui.',
        parameters: [idParameter],
        requestBody: { required: true, content: json(ref('ReplaceTask')) },
        responses: {
          200: taskResponse('Task terbaru.'),
          400: error('ID atau body task tidak valid.'),
          404: error('Task tidak ditemukan.'),
          500: error('Kesalahan server.')
        }
      },
      delete: {
        tags: ['Tasks'], summary: 'Hapus task',
        parameters: [idParameter],
        responses: {
          204: { description: 'Task terhapus; respons tanpa body.' },
          400: error('ID tidak valid.'),
          404: error('Task tidak ditemukan.'),
          500: error('Kesalahan server.')
        }
      }
    }
  }
};
