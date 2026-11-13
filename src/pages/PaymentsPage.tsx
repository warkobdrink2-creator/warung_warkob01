import React, { useMemo, useState } from 'react';
import { Banknote, CheckCircle2, CreditCard, QrCode, Receipt, Search, Smartphone, X } from 'lucide-react';
import { ReceiptModal } from '../components/ReceiptModal';
import { useWarung } from '../context/WarungContext';
import {
  formatDateTime,
  formatRupiah,
  PAYMENT_STATUS_META,
  QUEUE_STATUS_META,
} from '../lib/format';
import type { Order, PaymentMethod, PaymentStatus } from '../types/warung';

export const PaymentsPage: React.FC = () => {
  const { snapshot, processPayment, pushToast } = useWarung();
  const [filterStatus, setFilterStatus] = useState<PaymentStatus | 'SEMUA'>('BELUM BAYAR');
  const [search, setSearch] = useState('');
  const [payingOrder, setPayingOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  // Payment modal state
  const [method, setMethod] = useState<PaymentMethod>('TUNAI');
  const [amountPaid, setAmountPaid] = useState<string>('');
  const [discountInput, setDiscountInput] = useState<string>('0');
  const [refNo, setRefNo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const orders = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (snapshot?.orders ?? []).filter((o) => {
      const matchStatus = filterStatus === 'SEMUA' ? true : o.payment_status === filterStatus;
      const matchSearch =
        !q ||
        o.queue_code.toLowerCase().includes(q) ||
        o.order_number.toLowerCase().includes(q) ||
        o.customer_name.toLowerCase().includes(q);
      return matchStatus && matchSearch;
    });
  }, [snapshot?.orders, filterStatus, search]);

  const openPayModal = (order: Order) => {
    setPayingOrder(order);
    setMethod('TUNAI');
    setDiscountInput(String(order.discount || 0));
    setAmountPaid(String(order.total));
    setRefNo('');
  };

  const effectiveDiscount = payingOrder
    ? Math.min(payingOrder.subtotal, Math.max(0, Number(discountInput) || 0))
    : 0;
  const effectiveTotal = payingOrder ? Math.max(0, payingOrder.subtotal - effectiveDiscount) : 0;
  const cashNum = Number(amountPaid) || 0;
  const changeAmount = method === 'TUNAI' ? Math.max(0, cashNum - effectiveTotal) : 0;

  const handleConfirmPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payingOrder) return;
    if (method === 'TUNAI' && cashNum < effectiveTotal) {
      pushToast({
        type: 'error',
        title: 'Uang tunai kurang',
        message: `Minimal pembayaran adalah ${formatRupiah(effectiveTotal)}.`,
      });
      return;
    }

    setSubmitting(true);
    try {
      const updated = await processPayment({
        order_id: payingOrder.id,
        method,
        amount_paid: method === 'TUNAI' ? cashNum : effectiveTotal,
        discount: effectiveDiscount,
        reference_no: refNo.trim() || undefined,
      });
      setPayingOrder(null);
      setReceiptOrder(updated);
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Pembayaran gagal',
        message: err instanceof Error ? err.message : 'Coba lagi.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            {(['BELUM BAYAR', 'SUDAH BAYAR', 'DIBATALKAN', 'SEMUA'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterStatus(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer ${
                  filterStatus === tab
                    ? 'bg-slate-900 text-white'
                    : 'bg-slate-100 text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab === 'SEMUA' ? 'Semua Transaksi' : PAYMENT_STATUS_META[tab].label}
              </button>
            ))}
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari TRX, antrean, pelanggan..."
              className="w-full rounded-lg border border-slate-200 pl-9 pr-3 py-2 text-xs focus:border-orange-500 focus:outline-none"
            />
          </div>
        </div>

        {orders.length === 0 ? (
          <div className="p-10 text-center text-sm text-slate-500">
            Tidak ada transaksi pada kategori ini.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">Antrean / TRX</th>
                  <th className="py-3 px-4 font-semibold">Pelanggan</th>
                  <th className="py-3 px-4 font-semibold">Status Antrean</th>
                  <th className="py-3 px-4 font-semibold">Status Bayar</th>
                  <th className="py-3 px-4 font-semibold text-right">Total</th>
                  <th className="py-3 px-4 font-semibold text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((order) => {
                  const pMeta = PAYMENT_STATUS_META[order.payment_status];
                  const qMeta = QUEUE_STATUS_META[order.status];
                  return (
                    <tr key={order.id} className="hover:bg-slate-50/80">
                      <td className="py-3 px-4">
                        <span className="font-mono font-bold text-sm text-slate-900">{order.queue_code}</span>
                        <span className="block text-[11px] font-mono text-slate-500">{order.order_number}</span>
                        <span className="block text-[11px] text-slate-400">{formatDateTime(order.created_at)}</span>
                      </td>
                      <td className="py-3 px-4 font-medium text-slate-900">
                        {order.customer_name}
                        <span className="block text-[11px] text-slate-500">
                          {order.items.length} item · {order.payment?.method ?? 'Belum dipilih'}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-semibold border ${qMeta.bg} ${qMeta.text} ${qMeta.border}`}>
                          {qMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span className={`inline-block px-2 py-1 rounded-md text-[11px] font-semibold ${pMeta.bg} ${pMeta.text}`}>
                          {pMeta.label}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-slate-900 tabular-nums whitespace-nowrap">
                        {formatRupiah(order.total)}
                      </td>
                      <td className="py-3 px-4 text-right whitespace-nowrap space-x-1.5">
                        {order.payment_status === 'BELUM BAYAR' && order.status !== 'DIBATALKAN' && (
                          <button
                            type="button"
                            onClick={() => openPayModal(order)}
                            className="px-3 py-1.5 rounded-lg bg-orange-600 text-white font-semibold hover:bg-orange-700 cursor-pointer"
                          >
                            Bayar
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setReceiptOrder(order)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white text-slate-700 font-semibold hover:bg-slate-100 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5" />
                          <span>Struk</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Checkout Modal */}
      {payingOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
          <form
            onSubmit={handleConfirmPayment}
            className="w-full max-w-md bg-white rounded-2xl border border-slate-200 shadow-2xl overflow-hidden"
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">
                  Pembayaran Antrean {payingOrder.queue_code}
                </h3>
                <p className="text-xs text-slate-500">
                  {payingOrder.customer_name} · {payingOrder.order_number}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-2">Metode Pembayaran</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(
                    [
                      { id: 'TUNAI', label: 'Tunai', icon: Banknote },
                      { id: 'QRIS', label: 'QRIS', icon: QrCode },
                      { id: 'TRANSFER', label: 'Transfer', icon: CreditCard },
                      { id: 'E-WALLET', label: 'E-Wallet', icon: Smartphone },
                    ] as const
                  ).map((m) => {
                    const Icon = m.icon;
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => {
                          setMethod(m.id);
                          setAmountPaid(String(effectiveTotal));
                        }}
                        className={`flex flex-col items-center justify-center gap-1 py-2.5 px-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                          method === m.id
                            ? 'border-orange-500 bg-orange-50 text-orange-800'
                            : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                        <span>{m.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Subtotal</label>
                  <p className="font-mono text-sm font-bold text-slate-900 py-2">
                    {formatRupiah(payingOrder.subtotal)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Diskon (Rp)</label>
                  <input
                    type="number"
                    min={0}
                    max={payingOrder.subtotal}
                    value={discountInput}
                    onChange={(e) => setDiscountInput(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="rounded-xl bg-slate-900 text-white p-4 flex items-center justify-between">
                <span className="text-xs font-medium text-slate-300">Total Tagihan</span>
                <span className="font-mono text-2xl font-extrabold tabular-nums">
                  {formatRupiah(effectiveTotal)}
                </span>
              </div>

              {method === 'TUNAI' ? (
                <div className="space-y-2.5">
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Uang Pelanggan (Rp)</label>
                    <input
                      type="number"
                      required
                      min={effectiveTotal}
                      value={amountPaid}
                      onChange={(e) => setAmountPaid(e.target.value)}
                      className="w-full rounded-lg border border-slate-300 px-3.5 py-2.5 text-base font-mono font-bold tabular-nums focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {[effectiveTotal, 20000, 50000, 100000].map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmountPaid(String(preset))}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 text-xs font-mono font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
                      >
                        {preset === effectiveTotal ? 'Uang Pas' : formatRupiah(preset)}
                      </button>
                    ))}
                  </div>
                  <div className="rounded-lg bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex items-center justify-between text-sm">
                    <span className="font-semibold text-emerald-800">Kembalian</span>
                    <span className="font-mono font-bold text-emerald-800 tabular-nums">
                      {formatRupiah(changeAmount)}
                    </span>
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nomor Referensi / Catatan {method} (Opsional)
                  </label>
                  <input
                    type="text"
                    value={refNo}
                    onChange={(e) => setRefNo(e.target.value)}
                    placeholder={`Contoh: QRIS-${payingOrder.queue_code}`}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50 flex gap-2">
              <button
                type="button"
                onClick={() => setPayingOrder(null)}
                className="flex-1 rounded-xl border border-slate-300 bg-white py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 py-2.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{submitting ? 'Memproses...' : 'Konfirmasi Lunas'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {receiptOrder && snapshot && (
        <ReceiptModal
          order={receiptOrder}
          settings={snapshot.settings}
          onClose={() => setReceiptOrder(null)}
        />
      )}
    </div>
  );
};
