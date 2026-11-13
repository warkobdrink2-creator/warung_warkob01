import React from 'react';
import { Download, Printer, Share2, X } from 'lucide-react';
import { formatDateTime, formatRupiah } from '../lib/format';
import type { Order, WarungSettings } from '../types/warung';
import { useWarung } from '../context/WarungContext';

interface ReceiptModalProps {
  order: Order;
  settings: WarungSettings;
  onClose: () => void;
}

export const ReceiptModal: React.FC<ReceiptModalProps> = ({ order, settings, onClose }) => {
  const { pushToast } = useWarung();

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = () => {
    pushToast({
      type: 'info',
      title: 'Siapkan PDF Struk',
      message: 'Pilih "Simpan sebagai PDF" pada dialog cetak browser Anda.',
    });
    setTimeout(() => window.print(), 200);
  };

  const handleShare = async () => {
    const lines = [
      `*${settings.warung_name}*`,
      `Antrean: ${order.queue_code} | No: ${order.order_number}`,
      `Tanggal: ${formatDateTime(order.created_at)}`,
      `Pelanggan: ${order.customer_name}`,
      '---',
      ...order.items.map(
        (item) =>
          `${item.product_name} x${item.quantity} = ${formatRupiah(item.line_total)}${
            item.modifiers.length > 0 ? ` (${item.modifiers.map((m) => m.name).join(', ')})` : ''
          }`,
      ),
      '---',
      `Subtotal: ${formatRupiah(order.subtotal)}`,
      order.discount > 0 ? `Diskon: -${formatRupiah(order.discount)}` : '',
      `*Total: ${formatRupiah(order.total)}*`,
      order.payment
        ? `Bayar (${order.payment.method}): ${formatRupiah(order.payment.amount_paid)} | Kembalian: ${formatRupiah(order.payment.change_amount)}`
        : 'Status: Belum Bayar',
    ]
      .filter(Boolean)
      .join('\n');

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Struk ${order.queue_code} - ${settings.warung_name}`,
          text: lines,
        });
        return;
      } catch {
        // Fallback to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(lines);
      pushToast({
        type: 'success',
        title: 'Struk disalin ke clipboard',
        message: 'Siap ditempel ke WhatsApp atau chat pelanggan.',
      });
    } catch {
      pushToast({ type: 'error', title: 'Gagal menyalin struk.' });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="no-print flex items-center justify-between px-5 py-3.5 border-b border-slate-200 bg-slate-50">
          <h3 className="text-sm font-bold text-slate-900">Struk Digital Transaksi</h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-200/70"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-6 font-mono text-xs text-slate-800 space-y-4">
          <div className="text-center space-y-1 border-b border-dashed border-slate-300 pb-4">
            <p className="text-base font-bold text-slate-900 font-display">{settings.warung_name}</p>
            <p className="text-[11px] text-slate-500">{settings.warung_address}</p>
            <p className="text-[11px] text-slate-500">Telp: {settings.warung_phone}</p>
          </div>

          <div className="grid grid-cols-2 gap-y-1 text-[11px] border-b border-dashed border-slate-300 pb-3">
            <span className="text-slate-500">No. Antrean</span>
            <span className="text-right font-bold text-sm text-slate-900">{order.queue_code}</span>
            <span className="text-slate-500">No. Transaksi</span>
            <span className="text-right">{order.order_number}</span>
            <span className="text-slate-500">Waktu</span>
            <span className="text-right">{formatDateTime(order.created_at)}</span>
            <span className="text-slate-500">Pelanggan</span>
            <span className="text-right">{order.customer_name}</span>
            <span className="text-slate-500">Kasir</span>
            <span className="text-right">{order.cashier_name || order.payment?.cashier_name || 'Self-Order'}</span>
          </div>

          <div className="space-y-2.5 border-b border-dashed border-slate-300 pb-3">
            {order.items.map((item) => (
              <div key={item.id} className="space-y-0.5">
                <div className="flex justify-between gap-2 font-semibold text-slate-900">
                  <span>
                    {item.product_name} x{item.quantity}
                  </span>
                  <span className="tabular-nums">{formatRupiah(item.line_total)}</span>
                </div>
                {item.modifiers.length > 0 && (
                  <p className="text-[11px] text-slate-500 pl-2">
                    + {item.modifiers.map((m) => `${m.name}${m.price > 0 ? ` (${formatRupiah(m.price)})` : ''}`).join(', ')}
                  </p>
                )}
                {item.notes && <p className="text-[11px] text-slate-500 pl-2 italic">Catatan: {item.notes}</p>}
              </div>
            ))}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Subtotal</span>
              <span className="tabular-nums">{formatRupiah(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Diskon</span>
                <span className="tabular-nums">-{formatRupiah(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold text-slate-900 pt-1 border-t border-slate-200">
              <span>Total</span>
              <span className="tabular-nums">{formatRupiah(order.total)}</span>
            </div>

            {order.payment ? (
              <>
                <div className="flex justify-between pt-2">
                  <span className="text-slate-500">Metode ({order.payment.method})</span>
                  <span className="tabular-nums">{formatRupiah(order.payment.amount_paid)}</span>
                </div>
                <div className="flex justify-between font-semibold text-slate-900">
                  <span>Kembalian</span>
                  <span className="tabular-nums">{formatRupiah(order.payment.change_amount)}</span>
                </div>
              </>
            ) : (
              <div className="pt-2 text-center font-semibold text-amber-700">STATUS: BELUM BAYAR</div>
            )}
          </div>

          <p className="text-center text-[11px] text-slate-500 pt-3 border-t border-dashed border-slate-300">
            {settings.receipt_footer}
          </p>
        </div>

        <div className="no-print grid grid-cols-3 gap-2 p-4 border-t border-slate-200 bg-slate-50">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak</span>
          </button>
          <button
            type="button"
            onClick={handleDownloadPdf}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>PDF</span>
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-100 cursor-pointer"
          >
            <Share2 className="w-4 h-4" />
            <span>Bagikan</span>
          </button>
        </div>
      </div>
    </div>
  );
};
