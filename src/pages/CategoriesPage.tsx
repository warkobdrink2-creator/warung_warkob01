import React, { useState } from 'react';
import { Edit3, Plus, Trash2, X } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import type { Category } from '../types/warung';

export const CategoriesPage: React.FC = () => {
  const { snapshot, apiFetch, refreshSnapshot, pushToast } = useWarung();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Category | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [sortOrder, setSortOrder] = useState('1');

  const categories = snapshot?.categories ?? [];
  const products = snapshot?.products ?? [];

  const openModal = (cat?: Category) => {
    setEditing(cat ?? null);
    setName(cat?.name ?? '');
    setDescription(cat?.description ?? '');
    setSortOrder(String(cat?.sort_order ?? categories.length + 1));
    setModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await apiFetch(`/api/categories/${editing.id}`, {
          method: 'PATCH',
          body: JSON.stringify({ name, description, sort_order: Number(sortOrder) || 1 }),
        });
        pushToast({ type: 'success', title: 'Kategori diperbarui.' });
      } else {
        await apiFetch('/api/categories', {
          method: 'POST',
          body: JSON.stringify({ name, description, sort_order: Number(sortOrder) || 1 }),
        });
        pushToast({ type: 'success', title: 'Kategori baru ditambahkan.' });
      }
      setModalOpen(false);
      await refreshSnapshot();
    } catch (err) {
      pushToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal menyimpan kategori.' });
    }
  };

  const handleDelete = async (cat: Category) => {
    try {
      await apiFetch(`/api/categories/${cat.id}`, { method: 'DELETE' });
      pushToast({ type: 'info', title: `Kategori "${cat.name}" dihapus.` });
      await refreshSnapshot();
    } catch (err) {
      pushToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal menghapus kategori.' });
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-xs text-slate-600">Atur pengelompokan menu makanan, minuman, snack, dan paket.</p>
        <button
          type="button"
          onClick={() => openModal()}
          className="inline-flex items-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kategori</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {categories.map((cat) => {
          const count = products.filter((p) => p.category_id === cat.id).length;
          return (
            <div key={cat.id} className="bg-white rounded-xl border border-slate-200 p-5 flex flex-col justify-between gap-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="font-display text-base font-bold text-slate-900">{cat.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Urutan {cat.sort_order} · {count} menu terdaftar
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openModal(cat)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                {cat.description && <p className="text-xs text-slate-600 mt-3">{cat.description}</p>}
              </div>
            </div>
          );
        })}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form onSubmit={handleSave} className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                {editing ? 'Edit Kategori' : 'Tambah Kategori'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Kategori</label>
                <input
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Urutan Tampil</label>
                <input
                  type="number"
                  min={1}
                  value={sortOrder}
                  onChange={(e) => setSortOrder(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
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
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
