import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  CreditCard,
  Megaphone,
  RotateCcw,
  Search,
  SkipForward,
  Volume2,
  XCircle,
} from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import { formatRupiah, formatTimeOnly, getTodayJakarta, QUEUE_STATUS_META } from '../lib/format';
import { isSpeechSupported, playChime, speakQueueNumber } from '../lib/speech';
import type { QueueStatus } from '../types/warung';

interface QueueCallerPageProps {
  onNavigate: (path: string) => void;
}

export const QueueCallerPage: React.FC<QueueCallerPageProps> = ({ onNavigate }) => {
  const { snapshot, callNextQueue, updateOrderStatus, pushToast } = useWarung();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<QueueStatus | 'AKTIF' | 'SEMUA'>('AKTIF');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [voiceEnabled, setVoiceEnabled] = useState(true);

  const todayStr = getTodayJakarta();
  const todayOrders = useMemo(
    () =>
      (snapshot?.orders ?? [])
        .filter((o) => o.queue_date === todayStr)
        .sort((a, b) => a.queue_number - b.queue_number),
    [snapshot?.orders, todayStr],
  );

  // Active currently called order (most recently called DIPANGGIL)
  const currentCalled = useMemo(() => {
    const called = todayOrders.filter((o) => o.status === 'DIPANGGIL');
    if (called.length === 0) return null;
    return [...called].sort((a, b) => (b.called_at ?? '').localeCompare(a.called_at ?? ''))[0];
  }, [todayOrders]);

  // Next in line (prioritize SIAP then MENUNGGU)
  const nextCandidate = useMemo(() => {
    const ready = todayOrders.filter((o) => o.status === 'SIAP');
    if (ready.length > 0) return ready[0];
    const waiting = todayOrders.filter((o) => o.status === 'MENUNGGU');
    return waiting[0] ?? null;
  }, [todayOrders]);

  const filteredOrders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return todayOrders.filter((o) => {
      const matchFilter =
        statusFilter === 'SEMUA'
          ? true
          : statusFilter === 'AKTIF'
          ? !['SELESAI', 'DIBATALKAN'].includes(o.status)
          : o.status === statusFilter;
      const matchSearch =
        !q ||
        o.queue_code.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q) ||
        o.order_number.toLowerCase().includes(q);
      return matchFilter && matchSearch;
    });
  }, [todayOrders, statusFilter, search]);

  const announce = (queueCode: string) => {
    playChime();
    if (voiceEnabled) {
      speakQueueNumber(queueCode, 'silakan menuju kasir.');
    }
  };

  const handleCallNext = async () => {
    setBusyId('NEXT');
    try {
      const order = await callNextQueue();
      announce(order.queue_code);
    } catch (err) {
      pushToast({
        type: 'warning',
        title: 'Antrean kosong',
        message: err instanceof Error ? err.message : 'Belum ada antrean berikutnya.',
      });
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusChange = async (orderId: string, queueCode: string, status: QueueStatus) => {
    setBusyId(orderId);
    try {
      await updateOrderStatus(orderId, status);
      if (status === 'DIPANGGIL') {
        announce(queueCode);
      }
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal memperbarui antrean',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Main Caller Console */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between gap-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold text-slate-500">Nomor Antrean Sekarang</p>
              <p className="font-mono text-5xl sm:text-6xl font-extrabold text-orange-600 tabular-nums mt-2 tracking-tight">
                {currentCalled ? currentCalled.queue_code : '—'}
              </p>
              {currentCalled ? (
                <p className="mt-2 text-sm font-medium text-slate-700">
                  {currentCalled.customer_name} · {formatRupiah(currentCalled.total)} ·{' '}
                  <span className={currentCalled.payment_status === 'SUDAH BAYAR' ? 'text-emerald-700 font-semibold' : 'text-amber-700 font-semibold'}>
                    {currentCalled.payment_status}
                  </span>
                </p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">Belum ada nomor yang sedang dipanggil.</p>
              )}
            </div>

            <button
              type="button"
              onClick={() => setVoiceEnabled((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold cursor-pointer ${
                voiceEnabled && isSpeechSupported()
                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                  : 'border-slate-200 bg-slate-50 text-slate-600'
              }`}
            >
              <Volume2 className="w-4 h-4" />
              <span>{voiceEnabled ? 'Suara Aktif' : 'Suara Nonaktif'}</span>
            </button>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
            <button
              type="button"
              disabled={busyId !== null || !nextCandidate}
              onClick={handleCallNext}
              className="col-span-2 sm:col-span-2 min-h-[46px] flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 cursor-pointer"
            >
              <Megaphone className="w-4 h-4" />
              <span>Panggil Berikutnya</span>
            </button>

            <button
              type="button"
              disabled={!currentCalled || busyId !== null}
              onClick={() => currentCalled && handleStatusChange(currentCalled.id, currentCalled.queue_code, 'DIPANGGIL')}
              className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Panggil Ulang</span>
            </button>

            <button
              type="button"
              disabled={!currentCalled || busyId !== null}
              onClick={() => currentCalled && handleStatusChange(currentCalled.id, currentCalled.queue_code, 'MENUNGGU')}
              className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40 cursor-pointer"
            >
              <SkipForward className="w-4 h-4" />
              <span>Lewati</span>
            </button>

            <button
              type="button"
              disabled={!currentCalled || busyId !== null}
              onClick={() => currentCalled && handleStatusChange(currentCalled.id, currentCalled.queue_code, 'SELESAI')}
              className="min-h-[46px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-40 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Selesai</span>
            </button>
          </div>

          {currentCalled && (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
              <button
                type="button"
                onClick={() => handleStatusChange(currentCalled.id, currentCalled.queue_code, 'DIBATALKAN')}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 cursor-pointer"
              >
                <XCircle className="w-4 h-4" />
                <span>Batalkan Antrean {currentCalled.queue_code}</span>
              </button>
              {currentCalled.payment_status === 'BELUM BAYAR' && (
                <button
                  type="button"
                  onClick={() => onNavigate('/pembayaran')}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
                >
                  <CreditCard className="w-3.5 h-3.5" />
                  <span>Proses Pembayaran</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Next Queue Summary Card */}
        <div className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 flex flex-col justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-slate-500">Antrean Berikutnya</p>
            <p className="font-mono text-4xl font-extrabold text-slate-900 tabular-nums mt-2">
              {nextCandidate ? nextCandidate.queue_code : 'Kosong'}
            </p>
            {nextCandidate ? (
              <div className="mt-2 space-y-1">
                <p className="text-sm font-semibold text-slate-800">{nextCandidate.customer_name}</p>
                <p className="text-xs text-slate-500">
                  {nextCandidate.items.map((i) => `${i.product_name} x${i.quantity}`).join(', ')}
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-500 mt-2">Semua antrean saat ini sudah dipanggil.</p>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
            <span className="text-slate-500">
              Total antrean hari ini: <strong className="text-slate-900 font-mono">{todayOrders.length}</strong>
            </span>
            <button
              type="button"
              onClick={() => onNavigate('/display')}
              className="font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
            >
              Buka Layar Display TV →
            </button>
          </div>
        </div>
      </div>

      {/* Queue List Table */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['AKTIF', 'MENUNGGU', 'DIPANGGIL', 'DIPROSES', 'SIAP', 'SELESAI', 'SEMUA'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  statusFilter === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'AKTIF' ? 'Antrean Aktif' : tab === 'SEMUA' ? 'Semua' : QUEUE_STATUS_META[tab].label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nomor A001 atau nama..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {filteredOrders.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada data antrean pada filter ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nomor</th>
                  <th className="py-3 px-4 font-semibold">Pelanggan</th>
                  <th className="py-3 px-4 font-semibold">Ringkasan Pesanan</th>
                  <th className="py-3 px-4 font-semibold">Status</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Aksi Kasir</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredOrders.map((order) => {
                  const meta = QUEUE_STATUS_META[order.status];
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4 font-mono font-bold text-sm text-slate-900 tabular-nums whitespace-nowrap">
                        {order.queue_code}
                        <span className="block text-[11px] font-normal text-slate-400">
                          {formatTimeOnly(order.created_at)}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {order.customer_name}
                        <span className="block text-[11px] text-slate-500">{order.payment_status}</span>
                      </td>
                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate">
                        {order.items.map((i) => `${i.product_name} x${i.quantity}`).join(', ')}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(order.total)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        {!['SELESAI', 'DIBATALKAN'].includes(order.status) && (
                          <>
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() => handleStatusChange(order.id, order.queue_code, 'DIPANGGIL')}
                              className="px-2.5 py-1.5 rounded-md bg-orange-600 text-white font-semibold hover:bg-orange-700 cursor-pointer"
                            >
                              Panggil
                            </button>
                            <button
                              type="button"
                              disabled={busyId === order.id}
                              onClick={() => handleStatusChange(order.id, order.queue_code, 'SELESAI')}
                              className="px-2.5 py-1.5 rounded-md border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer"
                            >
                              Selesai
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
