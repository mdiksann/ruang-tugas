import pg from 'pg';

const samples = [
  ['Rancang halaman dashboard', 'Tentukan susunan informasi utama dan aksi cepat.', 'new'],
  ['Susun daftar kebutuhan', 'Catat kebutuhan pengguna untuk iterasi berikutnya.', 'new'],
  ['Riset alur onboarding', 'Bandingkan alur pertama kali menggunakan aplikasi.', 'new'],
  ['Siapkan data contoh', 'Kumpulkan contoh task untuk pengujian antarmuka.', 'new'],
  ['Tulis dokumentasi API', 'Jelaskan endpoint dan contoh respons.', 'new'],
  ['Periksa akses mobile', 'Pastikan semua aksi mudah dijangkau di ponsel.', 'new'],
  ['Implementasi formulir task', 'Hubungkan formulir tambah dan ubah ke API.', 'in progress'],
  ['Bangun endpoint daftar', 'Tambahkan filter status dan paginasi.', 'in progress'],
  ['Perbaiki tampilan mobile', 'Rapikan jarak antar elemen pada layar kecil.', 'in progress'],
  ['Tulis laporan progres', 'Rangkum pekerjaan yang sedang berjalan.', 'in progress'],
  ['Integrasi pencarian', 'Cari task berdasarkan judul dan deskripsi.', 'in progress'],
  ['Optimalkan query task', 'Periksa urutan hasil dan jumlah total.', 'in progress'],
  ['Uji validasi judul', 'Coba judul kosong, spasi, dan lebih dari 120 karakter.', 'in testing'],
  ['Uji filter status', 'Bandingkan hasil tiap status dengan data database.', 'in testing'],
  ['Uji laporan mingguan', 'Cari kata laporan bersama filter status.', 'in testing'],
  ['Periksa akses keyboard', 'Gunakan Tab dan Enter untuk seluruh aksi utama.', 'in testing'],
  ['Uji paginasi daftar', 'Pastikan halaman kedua dan jumlah total sesuai.', 'in testing'],
  ['Uji respons error', 'Periksa pesan saat API tidak tersedia.', 'in testing'],
  ['Buat skema database', 'Tambahkan tabel dan constraint task.', 'done'],
  ['Atur Docker Compose', 'Jalankan database, backend, dan frontend.', 'done'],
  ['Selesaikan laporan akhir', 'Siapkan ringkasan hasil pengujian.', 'done'],
  ['Review desain halaman', 'Periksa hierarki informasi dan kontras.', 'done'],
  ['Tambah health check', 'Tunggu PostgreSQL siap sebelum backend berjalan.', 'done'],
  ['Dokumentasikan setup lokal', 'Tulis langkah menjalankan dan menghentikan aplikasi.', 'done']
];

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL wajib diatur.');
  process.exit(1);
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
let added = 0;
let renamed = 0;

try {
  for (const [title, description, status] of samples) {
    const legacy = await pool.query(
      `UPDATE tasks SET title = $1::text, updated_at = now() WHERE title = $2::text`,
      [title, `[Demo] ${title}`]
    );
    renamed += legacy.rowCount;
    const result = await pool.query(
      `INSERT INTO tasks (title, description, status)
       SELECT $1::text, $2::text, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM tasks WHERE title = $1::text)`,
      [title, description, status]
    );
    added += result.rowCount;
  }
  console.log(`Seeder selesai: ${added} task ditambahkan, ${renamed} judul diperbarui, ${samples.length - added} contoh tersedia.`);
} finally {
  await pool.end();
}
