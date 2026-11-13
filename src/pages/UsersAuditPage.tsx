import React, { useEffect, useState } from 'react';
import { Plus, Shield, X } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import { formatDateTime } from '../lib/format';
import type { AuditLog, UserProfile, UserRole } from '../types/warung';

export const UsersAuditPage: React.FC = () => {
  const { apiFetch, pushToast } = useWarung();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  const [form, setForm] = useState({
    email: '',
    full_name: '',
    role: 'kasir' as UserRole,
    phone: '',
    password: '',
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [uRes, lRes] = await Promise.all([
        apiFetch<{ users: UserProfile[] }>('/api/users'),
        apiFetch<{ logs: AuditLog[] }>('/api/audit-logs'),
      ]);
      setUsers(uRes.users);
      setLogs(lRes.logs);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal memuat data pengguna',
        message: err instanceof Error ? err.message : 'Coba muat ulang.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/users', { method: 'POST', body: JSON.stringify(form) });
      pushToast({ type: 'success', title: 'Pengguna baru ditambahkan.' });
      setModalOpen(false);
      setForm({ email: '', full_name: '', role: 'kasir', phone: '', password: '' });
      await loadData();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal menambah pengguna',
        message: err instanceof Error ? err.message : 'Periksa data input.',
      });
    }
  };

  const handleToggleActive = async (u: UserProfile) => {
    try {
      await apiFetch(`/api/users/${u.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: !u.is_active }),
      });
      pushToast({ type: 'info', title: `Status ${u.full_name} diperbarui.` });
      await loadData();
    } catch (err) {
      pushToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal mengubah status.' });
    }
  };

  return (
    <div className="space-y-6">
      {/* Users Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-orange-600" />
            <h2 className="font-display text-sm font-bold text-slate-900">Daftar Pengguna & Peran</h2>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-orange-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Pengguna</span>
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Nama</th>
                <th className="py-3 px-4 font-semibold">Email</th>
                <th className="py-3 px-4 font-semibold">Peran</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading && users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-6 text-center text-slate-400">
                    Memuat data pengguna...
                  </td>
                </tr>
              ) : (
                users.map((u) => (
                  <tr key={u.id}>
                    <td className="py-3 px-4 font-semibold text-slate-900">{u.full_name}</td>
                    <td className="py-3 px-4 font-mono text-slate-600">{u.email}</td>
                    <td className="py-3 px-4 capitalize font-semibold text-slate-800">{u.role}</td>
                    <td className="py-3 px-4">
                      <span className={u.is_active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                        {u.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleToggleActive(u)}
                        className="px-2.5 py-1 rounded border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {u.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Logs */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-sm font-bold text-slate-900">Audit Log Aktivitas Penting</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu</th>
                <th className="py-3 px-4 font-semibold">Pengguna</th>
                <th className="py-3 px-4 font-semibold">Aktivitas</th>
                <th className="py-3 px-4 font-semibold">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {logs.slice(0, 50).map((log) => (
                <tr key={log.id}>
                  <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(log.created_at)}</td>
                  <td className="py-2.5 px-4 font-medium text-slate-900">
                    {log.user_email} <span className="text-slate-400">({log.user_role})</span>
                  </td>
                  <td className="py-2.5 px-4 font-mono font-semibold text-orange-700">{log.action}</td>
                  <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500 max-w-md truncate">
                    {JSON.stringify(log.metadata)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleCreateUser}
            className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">Tambah Akun Staf / Pengguna</h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  required
                  value={form.full_name}
                  onChange={(e) => setForm((f) => ({ ...f, full_name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Email</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Peran (Role)</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value as UserRole }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="kasir">Kasir</option>
                  <option value="dapur">Dapur</option>
                  <option value="admin">Admin</option>
                  <option value="pelanggan">Pelanggan</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Password (min 6 karakter)</label>
                <input
                  type="password"
                  required
                  minLength={6}
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-orange-600 py-2 text-xs font-bold text-white">
                Buat Akun
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
