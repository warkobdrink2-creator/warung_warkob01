import React, { useEffect, useState } from 'react';
import { Database, Save } from 'lucide-react';
import { PWAInstallButton } from '../components/PWAInstallButton';
import { useWarung } from '../context/WarungContext';
import { isSupabaseConfigured } from '../lib/supabase';

export const SettingsPage: React.FC = () => {
  const { snapshot, updateSettings, pushToast } = useWarung();
  const [form, setForm] = useState({
    warung_name: '',
    warung_address: '',
    warung_phone: '',
    queue_prefix: 'A',
    queue_padding: '3',
    auto_deduct_stock_on: 'SELESAI' as 'KONFIRMASI' | 'SELESAI',
    estimated_minutes_per_order: '4',
    receipt_footer: '',
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!snapshot?.settings) return;
    const s = snapshot.settings;
    setForm({
      warung_name: s.warung_name,
      warung_address: s.warung_address,
      warung_phone: s.warung_phone,
      queue_prefix: s.queue_prefix,
      queue_padding: String(s.queue_padding),
      auto_deduct_stock_on: s.auto_deduct_stock_on,
      estimated_minutes_per_order: String(s.estimated_minutes_per_order),
      receipt_footer: s.receipt_footer,
    });
  }, [snapshot?.settings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await updateSettings({
        warung_name: form.warung_name,
        warung_address: form.warung_address,
        warung_phone: form.warung_phone,
        queue_prefix: form.queue_prefix,
        queue_padding: Number(form.queue_padding) || 3,
        auto_deduct_stock_on: form.auto_deduct_stock_on,
        estimated_minutes_per_order: Number(form.estimated_minutes_per_order) || 4,
        receipt_footer: form.receipt_footer,
      });
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal menyimpan pengaturan',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl space-y-6">
      <form onSubmit={handleSave} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-5 text-xs">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">Profil & Operasional Warung</h2>
          <p className="text-slate-500 mt-0.5">Pengaturan ini tampil pada struk digital, layar TV, dan format antrean.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nama Warung</label>
            <input
              required
              value={form.warung_name}
              onChange={(e) => setForm((f) => ({ ...f, warung_name: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Nomor Telepon</label>
            <input
              value={form.warung_phone}
              onChange={(e) => setForm((f) => ({ ...f, warung_phone: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Alamat Warung</label>
          <input
            value={form.warung_address}
            onChange={(e) => setForm((f) => ({ ...f, warung_address: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Prefix Nomor Antrean</label>
            <input
              maxLength={3}
              value={form.queue_prefix}
              onChange={(e) => setForm((f) => ({ ...f, queue_prefix: e.target.value.toUpperCase() }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono font-bold"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              Contoh: {form.queue_prefix || 'A'}
              {'0'.repeat(Math.max(1, Number(form.queue_padding) - 1))}1
            </p>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Panjang Digit Antrean</label>
            <select
              value={form.queue_padding}
              onChange={(e) => setForm((f) => ({ ...f, queue_padding: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
            >
              <option value="2">2 Digit (A01)</option>
              <option value="3">3 Digit (A001)</option>
              <option value="4">4 Digit (A0001)</option>
            </select>
          </div>
          <div>
            <label className="block font-semibold text-slate-700 mb-1">Estimasi per Pesanan (Menit)</label>
            <input
              type="number"
              min={1}
              value={form.estimated_minutes_per_order}
              onChange={(e) => setForm((f) => ({ ...f, estimated_minutes_per_order: e.target.value }))}
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Kapan Stok Berkurang Otomatis?</label>
          <select
            value={form.auto_deduct_stock_on}
            onChange={(e) =>
              setForm((f) => ({ ...f, auto_deduct_stock_on: e.target.value as 'KONFIRMASI' | 'SELESAI' }))
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          >
            <option value="SELESAI">Saat Pesanan Selesai / Lunas</option>
            <option value="KONFIRMASI">Langsung Saat Pesanan Dikonfirmasi</option>
          </select>
        </div>

        <div>
          <label className="block font-semibold text-slate-700 mb-1">Catatan Bawah Struk</label>
          <textarea
            rows={2}
            value={form.receipt_footer}
            onChange={(e) => setForm((f) => ({ ...f, receipt_footer: e.target.value }))}
            className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
          />
        </div>

        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-xl bg-orange-600 px-5 py-2.5 text-xs font-bold text-white hover:bg-orange-700 cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Menyimpan...' : 'Simpan Pengaturan'}</span>
          </button>
        </div>
      </form>

      {/* Supabase & PWA Status Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <Database className="w-5 h-5 text-slate-500 mt-0.5 shrink-0" />
          <div className="text-xs space-y-1">
            <p className="font-bold text-slate-900 text-sm">Koneksi Database & Aplikasi PWA</p>
            <p className="text-slate-600">
              Mode Aktif:{' '}
              <strong>
                {isSupabaseConfigured
                  ? 'Supabase PostgreSQL Cloud + Realtime'
                  : 'Server Lokal + WebSocket Realtime (Siap migrasi ke Supabase via supabase/schema.sql)'}
              </strong>
            </p>
          </div>
        </div>
        <PWAInstallButton />
      </div>
    </div>
  );
};
