import React, { useMemo, useState } from 'react';
import { Edit3, Plus, Search, Trash2, X } from 'lucide-react';
import { MenuImage } from '../components/MenuImage';
import { useWarung } from '../context/WarungContext';
import { formatRupiah } from '../lib/format';
import { MENU_IMAGE_PRESETS } from '../lib/menuImages';
import type { Product, ProductModifier } from '../types/warung';

export const MenuAdminPage: React.FC = () => {
  const { snapshot, apiFetch, refreshSnapshot, pushToast } = useWarung();
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('ALL');

  // Product modal
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);
  const [form, setForm] = useState({
    name: '',
    sku: '',
    category_id: '',
    description: '',
    image_url: '',
    cost_price: '0',
    sell_price: '10000',
    unit: 'porsi',
    stock: '20',
    min_stock: '5',
    is_active: true,
  });

  // Modifier modal
  const [modModalOpen, setModModalOpen] = useState(false);
  const [modForm, setModForm] = useState<{ id?: string; name: string; price: string; modifier_group: string }>({
    name: '',
    price: '0',
    modifier_group: 'tambahan',
  });

  const categories = snapshot?.categories ?? [];
  const modifiers = snapshot?.modifiers ?? [];

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (snapshot?.products ?? []).filter((p) => {
      const matchCat = catFilter === 'ALL' || p.category_id === catFilter;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [snapshot?.products, catFilter, search]);

  const openNewProduct = () => {
    setEditing(null);
    setForm({
      name: '',
      sku: `MNU-${String((snapshot?.products.length ?? 0) + 1).padStart(3, '0')}`,
      category_id: categories[0]?.id ?? '',
      description: '',
      image_url: '',
      cost_price: '6000',
      sell_price: '12000',
      unit: 'porsi',
      stock: '25',
      min_stock: '5',
      is_active: true,
    });
    setModalOpen(true);
  };

  const openEditProduct = (p: Product) => {
    setEditing(p);
    setForm({
      name: p.name,
      sku: p.sku,
      category_id: p.category_id,
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      cost_price: String(p.cost_price),
      sell_price: String(p.sell_price),
      unit: p.unit,
      stock: String(p.stock),
      min_stock: String(p.min_stock),
      is_active: p.is_active,
    });
    setModalOpen(true);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        name: form.name,
        sku: form.sku,
        category_id: form.category_id,
        description: form.description,
        image_url: form.image_url || undefined,
        cost_price: Number(form.cost_price) || 0,
        sell_price: Number(form.sell_price) || 0,
        unit: form.unit || 'porsi',
        stock: Number(form.stock) || 0,
        min_stock: Number(form.min_stock) || 0,
        is_active: form.is_active,
      };
      if (editing) {
        await apiFetch(`/api/products/${editing.id}`, { method: 'PATCH', body: JSON.stringify(payload) });
        pushToast({ type: 'success', title: 'Menu diperbarui.' });
      } else {
        await apiFetch('/api/products', { method: 'POST', body: JSON.stringify(payload) });
        pushToast({ type: 'success', title: 'Menu baru ditambahkan.' });
      }
      setModalOpen(false);
      await refreshSnapshot();
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal menyimpan menu',
        message: err instanceof Error ? err.message : 'Periksa data menu.',
      });
    }
  };

  const handleDeleteProduct = async (p: Product) => {
    try {
      await apiFetch(`/api/products/${p.id}`, { method: 'DELETE' });
      pushToast({ type: 'info', title: `Menu "${p.name}" dihapus / dinonaktifkan.` });
      await refreshSnapshot();
    } catch (err) {
      pushToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal menghapus menu.' });
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setForm((f) => ({ ...f, image_url: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const openModifierModal = (mod?: ProductModifier) => {
    setModForm(
      mod
        ? { id: mod.id, name: mod.name, price: String(mod.price), modifier_group: mod.modifier_group }
        : { name: '', price: '3000', modifier_group: 'tambahan' },
    );
    setModModalOpen(true);
  };

  const handleSaveModifier = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await apiFetch('/api/modifiers', {
        method: 'POST',
        body: JSON.stringify({
          id: modForm.id,
          name: modForm.name,
          price: Number(modForm.price) || 0,
          modifier_group: modForm.modifier_group,
        }),
      });
      pushToast({ type: 'success', title: 'Tambahan / modifier disimpan.' });
      setModModalOpen(false);
      await refreshSnapshot();
    } catch (err) {
      pushToast({ type: 'error', title: err instanceof Error ? err.message : 'Gagal menyimpan tambahan.' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama menu atau SKU..."
              className="w-full rounded-lg border border-slate-200 bg-white pl-9 pr-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
            />
          </div>
          <select
            value={catFilter}
            onChange={(e) => setCatFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700"
          >
            <option value="ALL">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={openNewProduct}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-2.5 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Menu</span>
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Menu</th>
                <th className="py-3 px-4 font-semibold">Kategori</th>
                <th className="py-3 px-4 font-semibold text-right">Harga Modal</th>
                <th className="py-3 px-4 font-semibold text-right">Harga Jual</th>
                <th className="py-3 px-4 font-semibold text-right">Stok</th>
                <th className="py-3 px-4 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const cat = categories.find((c) => c.id === p.category_id)?.name ?? '-';
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                          <MenuImage src={p.image_url} alt={p.name} />
                        </div>
                        <div>
                          <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                          <p className="font-mono text-[11px] text-slate-500">{p.sku} · {p.unit}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-700">{cat}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-500">
                      {formatRupiah(p.cost_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                      {formatRupiah(p.sell_price)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className={p.stock <= p.min_stock ? 'text-amber-700 font-bold' : 'text-slate-700'}>
                        {p.stock}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-[11px] font-semibold ${
                          p.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {p.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap space-x-1">
                      <button
                        type="button"
                        onClick={() => openEditProduct(p)}
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-100 cursor-pointer"
                        title="Edit Menu"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteProduct(p)}
                        className="p-1.5 rounded-lg border border-slate-200 text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Hapus / Nonaktifkan"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modifiers Section */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">Tambahan / Modifier Menu</h2>
            <p className="text-xs text-slate-500">Atur harga tambahan seperti Telur, Keju, Sambal, atau Level Pedas.</p>
          </div>
          <button
            type="button"
            onClick={() => openModifierModal()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Modifier</span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          {modifiers.map((mod) => (
            <button
              key={mod.id}
              type="button"
              onClick={() => openModifierModal(mod)}
              className="text-left rounded-xl border border-slate-200 px-3.5 py-2.5 flex items-center justify-between hover:border-orange-300 cursor-pointer"
            >
              <div>
                <p className="text-xs font-bold text-slate-900">{mod.name}</p>
                <p className="text-[11px] text-slate-500 capitalize">{mod.modifier_group}</p>
              </div>
              <span className="font-mono text-xs font-bold text-orange-600 tabular-nums">
                {mod.price > 0 ? `+${formatRupiah(mod.price)}` : 'Gratis'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Product Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveProduct}
            className="w-full max-w-lg bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden max-h-[92vh] flex flex-col"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">
                {editing ? `Edit Menu: ${editing.name}` : 'Tambah Menu Baru'}
              </h3>
              <button type="button" onClick={() => setModalOpen(false)} className="p-1.5 text-slate-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Nama Menu</label>
                  <input
                    required
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">SKU</label>
                  <input
                    required
                    value={form.sku}
                    onChange={(e) => setForm((f) => ({ ...f, sku: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Kategori</label>
                  <select
                    value={form.category_id}
                    onChange={(e) => setForm((f) => ({ ...f, category_id: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Satuan</label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                    placeholder="porsi / gelas / paket"
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Modal</label>
                  <input
                    type="number"
                    min={0}
                    value={form.cost_price}
                    onChange={(e) => setForm((f) => ({ ...f, cost_price: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Harga Jual</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.sell_price}
                    onChange={(e) => setForm((f) => ({ ...f, sell_price: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stok Awal</label>
                  <input
                    type="number"
                    min={0}
                    disabled={Boolean(editing)}
                    value={form.stock}
                    onChange={(e) => setForm((f) => ({ ...f, stock: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono disabled:bg-slate-100"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Stok Min</label>
                  <input
                    type="number"
                    min={0}
                    value={form.min_stock}
                    onChange={(e) => setForm((f) => ({ ...f, min_stock: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Foto Menu (Upload atau Pilih Preset)</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {MENU_IMAGE_PRESETS.map((preset) => (
                    <button
                      key={preset.key}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, image_url: preset.key }))}
                      className={`px-2.5 py-1 rounded border text-[11px] cursor-pointer ${
                        form.image_url === preset.key
                          ? 'border-orange-500 bg-orange-50 text-orange-800 font-semibold'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
                <input type="file" accept="image/*" onChange={handleImageUpload} className="text-xs text-slate-600" />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Deskripsi</label>
                <textarea
                  rows={2}
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((f) => ({ ...f, is_active: e.target.checked }))}
                />
                <span className="font-semibold text-slate-800">Menu aktif dan tampil untuk dipesan</span>
              </label>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-orange-600 py-2.5 text-xs font-bold text-white hover:bg-orange-700"
              >
                Simpan Menu
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modifier Modal */}
      {modModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleSaveModifier}
            className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display text-sm font-bold text-slate-900">
                {modForm.id ? 'Edit Tambahan' : 'Tambah Modifier Baru'}
              </h3>
              <button type="button" onClick={() => setModModalOpen(false)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Nama Tambahan</label>
                <input
                  required
                  value={modForm.name}
                  onChange={(e) => setModForm((f) => ({ ...f, name: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Harga Tambahan (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={modForm.price}
                  onChange={(e) => setModForm((f) => ({ ...f, price: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Grup</label>
                <select
                  value={modForm.modifier_group}
                  onChange={(e) => setModForm((f) => ({ ...f, modifier_group: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                >
                  <option value="topping">Topping</option>
                  <option value="tambahan">Tambahan</option>
                  <option value="porsi">Porsi</option>
                  <option value="minuman">Minuman</option>
                  <option value="level">Level Pedas</option>
                </select>
              </div>
            </div>
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setModModalOpen(false)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="flex-1 rounded-xl bg-slate-900 py-2 text-xs font-bold text-white"
              >
                Simpan
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
