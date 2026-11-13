import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowDownUp, Search, X } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import { formatDateTime } from '../lib/format';
import type { InventoryTxType, Product } from '../types/warung';

export const StockPage: React.FC = () => {
  const { snapshot, adjustStock, pushToast } = useWarung();
  const [search, setSearch] = useState('');
  const [onlyLow, setOnlyLow] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [txType, setTxType] = useState<InventoryTxType>('MASUK');
  const [quantity, setQuantity] = useState('10');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const products = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (snapshot?.products ?? []).filter((p) => {
      const matchLow = !onlyLow || p.stock <= p.min_stock;
      const matchSearch = !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchLow && matchSearch;
    });
  }, [snapshot?.products, search, onlyLow]);

  const lowStockCount = useMemo(
    () => (snapshot?.products ?? []).filter((p) => p.is_active && p.stock <= p.min_stock).length,
    [snapshot?.products],
  );

  const openAdjust = (p: Product, defaultType: InventoryTxType = 'MASUK') => {
    setSelectedProduct(p);
    setTxType(defaultType);
    setQuantity(defaultType === 'PENYESUAIAN' ? String(p.stock) : '10');
    setNotes('');
  };

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setSubmitting(true);
    try {
      await adjustStock({
        product_id: selectedProduct.id,
        type: txType,
        quantity: Number(quantity),
        notes,
      });
      setSelectedProduct(null);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal mengubah stok',
        message: err instanceof Error ? err.message : 'Periksa angka stok.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {lowStockCount > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-amber-900">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <p className="text-xs sm:text-sm font-semibold">
              Terdapat {lowStockCount} menu dengan stok hampir habis atau habis. Segera lakukan pengisian stok.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setOnlyLow((v) => !v)}
            className="px-3 py-1.5 rounded-lg bg-white border border-amber-300 text-xs font-semibold text-amber-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {onlyLow ? 'Tampilkan Semua' : 'Filter Menipis'}
          </button>
        </div>
      )}

      {/* Stock Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="font-display text-sm font-bold text-slate-900">Daftar Stok Menu</h2>
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari menu atau SKU..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Menu</th>
                <th className="py-3 px-4 font-semibold text-right">Stok Saat Ini</th>
                <th className="py-3 px-4 font-semibold text-right">Stok Minimum</th>
                <th className="py-3 px-4 font-semibold">Peringatan</th>
                <th className="py-3 px-4 font-semibold text-right">Kelola</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.map((p) => {
                const isOut = p.stock === 0;
                const isLow = p.stock > 0 && p.stock <= p.min_stock;
                return (
                  <tr key={p.id} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4">
                      <p className="font-bold text-slate-900 text-sm">{p.name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{p.sku}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-sm tabular-nums">
                      {p.stock} {p.unit}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-slate-500 tabular-nums">
                      {p.min_stock} {p.unit}
                    </td>
                    <td className="py-3 px-4">
                      {isOut ? (
                        <span className="inline-block px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold">
                          MENU HABIS
                        </span>
                      ) : isLow ? (
                        <span className="inline-block px-2.5 py-1 rounded bg-amber-50 text-amber-700 font-semibold">
                          Stok hampir habis.
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-medium">Aman</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openAdjust(p, 'MASUK')}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-100 cursor-pointer"
                      >
                        <ArrowDownUp className="w-3.5 h-3.5" />
                        <span>Atur Stok</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inventory History */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200">
          <h2 className="font-display text-sm font-bold text-slate-900">Riwayat Pergerakan Stok</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Waktu</th>
                <th className="py-3 px-4 font-semibold">Menu</th>
                <th className="py-3 px-4 font-semibold">Jenis</th>
                <th className="py-3 px-4 font-semibold text-right">Perubahan</th>
                <th className="py-3 px-4 font-semibold text-right">Akhir</th>
                <th className="py-3 px-4 font-semibold">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(snapshot?.inventoryTransactions ?? []).slice(0, 40).map((tx) => (
                <tr key={tx.id}>
                  <td className="py-2.5 px-4 text-slate-500 whitespace-nowrap">{formatDateTime(tx.created_at)}</td>
                  <td className="py-2.5 px-4 font-semibold text-slate-900">{tx.product_name}</td>
                  <td className="py-2.5 px-4 font-semibold">
                    <span
                      className={
                        tx.type === 'MASUK'
                          ? 'text-emerald-700'
                          : tx.type === 'KELUAR'
                          ? 'text-rose-700'
                          : 'text-slate-700'
                      }
                    >
                      {tx.type}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                    {tx.quantity_change > 0 ? `+${tx.quantity_change}` : tx.quantity_change}
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono tabular-nums">{tx.stock_after}</td>
                  <td className="py-2.5 px-4 text-slate-500">{tx.notes || tx.user_name || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Adjust Stock Modal */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleAdjust}
            className="w-full max-w-sm bg-white rounded-2xl border border-slate-200 shadow-xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display text-sm font-bold text-slate-900">{selectedProduct.name}</h3>
                <p className="text-xs text-slate-500">
                  Stok saat ini: {selectedProduct.stock} {selectedProduct.unit}
                </p>
              </div>
              <button type="button" onClick={() => setSelectedProduct(null)} className="p-1 text-slate-400">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-3 gap-1.5">
                {(['MASUK', 'KELUAR', 'PENYESUAIAN'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      setTxType(t);
                      setQuantity(t === 'PENYESUAIAN' ? String(selectedProduct.stock) : '10');
                    }}
                    className={`py-2 rounded-lg border font-semibold cursor-pointer ${
                      txType === t
                        ? 'border-orange-500 bg-orange-50 text-orange-800'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  {txType === 'PENYESUAIAN' ? 'Stok Akhir Aktual' : 'Jumlah Perubahan'}
                </label>
                <input
                  type="number"
                  min={txType === 'PENYESUAIAN' ? 0 : 1}
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Catatan</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Contoh: Belanja pagi, stok rusak..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setSelectedProduct(null)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 rounded-xl bg-orange-600 py-2 text-xs font-bold text-white hover:bg-orange-700"
              >
                {submitting ? 'Menyimpan...' : 'Simpan Stok'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
