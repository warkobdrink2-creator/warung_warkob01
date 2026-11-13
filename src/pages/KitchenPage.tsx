import React, { useMemo, useState } from 'react';
import { Check, ChefHat, Clock, Flame } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import { formatTimeOnly, getTodayJakarta, QUEUE_STATUS_META } from '../lib/format';
import type { QueueStatus } from '../types/warung';

export const KitchenPage: React.FC = () => {
  const { snapshot, updateOrderStatus, pushToast } = useWarung();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [tab, setTab] = useState<'MASUK' | 'SIAP'>('MASUK');

  const todayStr = getTodayJakarta();
  const kitchenOrders = useMemo(() => {
    const today = (snapshot?.orders ?? []).filter((o) => o.queue_date === todayStr);
    if (tab === 'MASUK') {
      return today
        .filter((o) => o.status === 'MENUNGGU' || o.status === 'DIPROSES')
        .sort((a, b) => a.queue_number - b.queue_number);
    }
    return today
      .filter((o) => o.status === 'SIAP' || o.status === 'DIPANGGIL')
      .sort((a, b) => b.queue_number - a.queue_number);
  }, [snapshot?.orders, todayStr, tab]);

  const waitingCount = useMemo(
    () =>
      (snapshot?.orders ?? []).filter(
        (o) => o.queue_date === todayStr && (o.status === 'MENUNGGU' || o.status === 'DIPROSES'),
      ).length,
    [snapshot?.orders, todayStr],
  );

  const handleTransition = async (orderId: string, nextStatus: QueueStatus) => {
    setBusyId(orderId);
    try {
      await updateOrderStatus(orderId, nextStatus);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal mengubah status dapur',
        message: err instanceof Error ? err.message : 'Silakan coba lagi.',
      });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('MASUK')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === 'MASUK'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            Pesanan Masuk ({waitingCount})
          </button>
          <button
            type="button"
            onClick={() => setTab('SIAP')}
            className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
              tab === 'SIAP'
                ? 'bg-slate-900 text-white'
                : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
            }`}
          >
            Sudah Siap / Dipanggil
          </button>
        </div>
        <p className="text-xs text-slate-500">
          Pembaruan status langsung terkirim ke kasir & layar monitor antrean.
        </p>
      </div>

      {kitchenOrders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-2">
          <ChefHat className="w-10 h-10 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">
            {tab === 'MASUK' ? 'Tidak ada pesanan yang perlu dimasak saat ini' : 'Belum ada pesanan selesai masak'}
          </p>
          <p className="text-xs text-slate-500">Pesanan baru dari kasir atau pelanggan akan muncul otomatis di sini.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {kitchenOrders.map((order) => {
            const meta = QUEUE_STATUS_META[order.status];
            return (
              <div
                key={order.id}
                className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2 pb-3 border-b border-slate-100">
                    <div>
                      <span className="font-mono text-2xl font-extrabold text-slate-900 tabular-nums">
                        {order.queue_code}
                      </span>
                      <p className="text-xs font-semibold text-slate-700 mt-0.5">{order.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[11px] font-semibold border ${meta.bg} ${meta.text} ${meta.border}`}>
                        {meta.label}
                      </span>
                      <p className="text-[11px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                        <Clock className="w-3 h-3" />
                        <span>{formatTimeOnly(order.created_at)}</span>
                      </p>
                    </div>
                  </div>

                  <ul className="space-y-2.5">
                    {order.items.map((item) => (
                      <li key={item.id} className="text-sm">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="font-bold text-slate-900">
                            <span className="font-mono text-orange-600 mr-1.5">{item.quantity}x</span>
                            {item.product_name}
                          </span>
                        </div>
                        {item.modifiers.length > 0 && (
                          <p className="text-xs text-slate-600 pl-6">
                            + {item.modifiers.map((m) => m.name).join(', ')}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs text-amber-700 font-medium pl-6 mt-0.5">
                            Catatan: {item.notes}
                          </p>
                        )}
                      </li>
                    ))}
                  </ul>

                  {order.notes && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
                      Catatan Pesanan: {order.notes}
                    </div>
                  )}
                </div>

                {tab === 'MASUK' && (
                  <div className="grid grid-cols-2 gap-2 pt-3 border-t border-slate-100">
                    <button
                      type="button"
                      disabled={busyId === order.id || order.status === 'DIPROSES'}
                      onClick={() => handleTransition(order.id, 'DIPROSES')}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-100 disabled:opacity-45 cursor-pointer"
                    >
                      <Flame className="w-4 h-4" />
                      <span>{order.status === 'DIPROSES' ? 'Sedang Dimasak' : 'Mulai Proses'}</span>
                    </button>

                    <button
                      type="button"
                      disabled={busyId === order.id}
                      onClick={() => handleTransition(order.id, 'SIAP')}
                      className="min-h-[44px] flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-45 cursor-pointer"
                    >
                      <Check className="w-4 h-4" />
                      <span>Tandai Siap</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
