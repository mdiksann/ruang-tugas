import React, { useEffect, useRef, useState } from 'react';

const STATUSES = ['new', 'in progress', 'in testing', 'done'];
const EMPTY_FORM = { title: '', description: '', status: 'new' };
const EMPTY_PAGINATION = { page: 1, limit: 10, total: 0, totalPages: 0 };

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, {
      ...options,
      headers: { ...(options.body ? { 'Content-Type': 'application/json' } : {}), ...options.headers }
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new Error('Tidak dapat terhubung ke server. Periksa koneksi lalu coba lagi.');
  }
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.error?.message || 'Permintaan gagal. Coba lagi.');
  }
  return response.status === 204 ? null : response.json();
}

function validate(form) {
  const errors = {};
  if (!form.title.trim()) errors.title = 'Judul wajib diisi.';
  else if (form.title.trim().length > 120) errors.title = 'Judul maksimal 120 karakter.';
  if (form.description.length > 1000) errors.description = 'Deskripsi maksimal 1.000 karakter.';
  if (!STATUSES.includes(form.status)) errors.status = 'Status tidak valid.';
  return errors;
}

export default function App() {
  const [tasks, setTasks] = useState([]);
  const [pagination, setPagination] = useState(EMPTY_PAGINATION);
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [reload, setReload] = useState(0);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [actionError, setActionError] = useState('');
  const titleInput = useRef(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ page: String(page), limit: '10' });
    if (status) params.set('status', status);
    if (debouncedSearch.trim()) params.set('search', debouncedSearch.trim());
    setLoading(true);
    setListError('');
    request(`/api/tasks?${params}`, { signal: controller.signal })
      .then((result) => {
        if (page > 1 && page > Math.max(1, result.pagination.totalPages)) {
          setPage(Math.max(1, result.pagination.totalPages));
          return;
        }
        setTasks(result.data);
        setPagination(result.pagination);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name === 'AbortError') return;
        setTasks([]);
        setPagination(EMPTY_PAGINATION);
        setListError(error.message);
        setLoading(false);
      });
    return () => controller.abort();
  }, [page, status, debouncedSearch, reload]);

  function updateForm(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
    setFormErrors((current) => ({ ...current, [field]: '' }));
    setFormError('');
  }

  function startEdit(task) {
    setEditingId(task.id);
    setForm({ title: task.title, description: task.description, status: task.status });
    setFormErrors({});
    setFormError('');
    window.scrollTo(0, 0);
    requestAnimationFrame(() => titleInput.current?.focus());
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormErrors({});
    setFormError('');
  }

  async function saveTask(event) {
    event.preventDefault();
    if (saving) return;
    const errors = validate(form);
    setFormErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    setFormError('');
    try {
      await request(editingId ? `/api/tasks/${editingId}` : '/api/tasks', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify({ ...form, title: form.title.trim() })
      });
      cancelEdit();
      if (page === 1) setReload((value) => value + 1);
      else setPage(1);
    } catch (error) {
      setFormError(error.message);
    } finally {
      setSaving(false);
    }
  }

  async function deleteTask(task) {
    if (deletingId || !window.confirm(`Hapus task “${task.title}”?`)) return;
    setDeletingId(task.id);
    setActionError('');
    try {
      await request(`/api/tasks/${task.id}`, { method: 'DELETE' });
      if (editingId === task.id) cancelEdit();
      setReload((value) => value + 1);
    } catch (error) {
      setActionError(error.message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="page-shell">
      <header className="site-header">
        <span className="brand-mark" aria-hidden="true">✓</span>
        <span className="brand-name">Ruang Tugas</span>
        <span className="header-caption">Satu tempat untuk semua yang perlu diselesaikan</span>
      </header>

      <main className="main-content">
        <section className="intro" aria-labelledby="page-title">
          <div>
            <p className="eyebrow">TASK MANAGEMENT</p>
            <h1 id="page-title">Buat hari ini lebih terarah.</h1>
            <p className="intro-copy">Catat pekerjaan, ikuti progresnya, dan temukan yang perlu kamu kerjakan berikutnya.</p>
          </div>
          <div className="total-card" aria-live="polite">
            <span className="total-number">{pagination.total}</span>
            <span className="total-label">task ditemukan</span>
          </div>
        </section>

        <section className="form-panel" aria-labelledby="form-title">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{editingId ? 'PERBARUI TASK' : 'TASK BARU'}</p>
              <h2 id="form-title">{editingId ? 'Ubah detail task' : 'Tambahkan task'}</h2>
            </div>
            {editingId && <button className="text-button" type="button" onClick={cancelEdit} disabled={saving}>Batal ubah</button>}
          </div>
          <form onSubmit={saveTask} noValidate>
            <div className="field">
              <label htmlFor="title">Judul <span aria-hidden="true">*</span></label>
              <input id="title" ref={titleInput} value={form.title} onChange={(event) => updateForm('title', event.target.value)} maxLength={121} aria-invalid={Boolean(formErrors.title)} aria-describedby={formErrors.title ? 'title-error' : undefined} placeholder="Contoh: Siapkan presentasi" />
              {formErrors.title && <p id="title-error" className="field-error">{formErrors.title}</p>}
            </div>
            <div className="field">
              <label htmlFor="description">Deskripsi <span className="optional">opsional</span></label>
              <textarea id="description" rows="3" value={form.description} onChange={(event) => updateForm('description', event.target.value)} maxLength={1001} aria-invalid={Boolean(formErrors.description)} aria-describedby={formErrors.description ? 'description-error' : undefined} placeholder="Tambahkan detail yang perlu diingat" />
              {formErrors.description && <p id="description-error" className="field-error">{formErrors.description}</p>}
            </div>
            <div className="form-footer">
              <div className="field status-field">
                <label htmlFor="task-status">Status</label>
                <select id="task-status" value={form.status} onChange={(event) => updateForm('status', event.target.value)} aria-invalid={Boolean(formErrors.status)} aria-describedby={formErrors.status ? 'status-error' : undefined}>
                  {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
                {formErrors.status && <p id="status-error" className="field-error">{formErrors.status}</p>}
              </div>
              <button className="primary-button" type="submit" disabled={saving}>{saving ? 'Menyimpan…' : editingId ? 'Simpan perubahan' : 'Tambah task'} <span aria-hidden="true">→</span></button>
            </div>
            {formError && <p className="feedback error" role="alert">{formError}</p>}
          </form>
        </section>

        <section className="task-section" aria-labelledby="list-title">
          <div className="list-heading">
            <div>
              <p className="eyebrow">DAFTAR KERJA</p>
              <h2 id="list-title">Task kamu</h2>
            </div>
            <span className="result-count">{pagination.total} hasil</span>
          </div>
          <div className="filters">
            <div className="field search-field">
              <label htmlFor="search">Cari task</label>
              <input id="search" type="search" value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cari judul atau deskripsi…" />
            </div>
            <div className="field filter-field">
              <label htmlFor="filter-status">Filter status</label>
              <select id="filter-status" value={status} onChange={(event) => { setStatus(event.target.value); setPage(1); }}>
                <option value="">Semua status</option>
                {STATUSES.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </div>
          </div>

          {actionError && <p className="feedback error" role="alert">{actionError}</p>}
          {loading ? <div className="state-box" role="status">Memuat task…</div> : listError ? (
            <div className="state-box" role="alert">
              <p>{listError}</p>
              <button className="secondary-button" type="button" onClick={() => setReload((value) => value + 1)}>Coba lagi</button>
            </div>
          ) : tasks.length === 0 ? (
            <div className="state-box empty-state">
              <span className="empty-symbol" aria-hidden="true">□</span>
              <h3>Belum ada task yang cocok</h3>
              <p>{search || status ? 'Coba ubah kata pencarian atau filter status.' : 'Mulai dengan menambahkan task pertamamu.'}</p>
            </div>
          ) : (
            <ul className="task-list">
              {tasks.map((task) => (
                <li className="task-card" key={task.id}>
                  <div className="task-main">
                    <span className={`status-badge status-${task.status.replaceAll(' ', '-')}`}>{task.status}</span>
                    <h3>{task.title}</h3>
                    {task.description && <p>{task.description}</p>}
                  </div>
                  <div className="task-actions">
                    <button className="secondary-button" type="button" onClick={() => startEdit(task)} disabled={saving}>Ubah</button>
                    <button className="danger-button" type="button" onClick={() => deleteTask(task)} disabled={deletingId === task.id}>{deletingId === task.id ? 'Menghapus…' : 'Hapus'}</button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && !listError && pagination.totalPages > 1 && (
            <nav className="pagination" aria-label="Navigasi halaman task">
              <button className="secondary-button" type="button" onClick={() => setPage((value) => value - 1)} disabled={page <= 1}>← Sebelumnya</button>
              <span>Halaman {page} dari {pagination.totalPages}</span>
              <button className="secondary-button" type="button" onClick={() => setPage((value) => value + 1)} disabled={page >= pagination.totalPages}>Berikutnya →</button>
            </nav>
          )}
        </section>
      </main>
      <footer className="site-footer">Ruang Tugas · Selesaikan satu per satu.</footer>
    </div>
  );
}
