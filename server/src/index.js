import pg from 'pg';
import { createApp } from './app.js';

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL wajib diatur.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const port = Number(process.env.PORT || 3000);
createApp(pool).listen(port, '0.0.0.0', () => {
  console.log(`API berjalan di port ${port}`);
});
