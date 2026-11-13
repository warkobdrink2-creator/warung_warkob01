import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import {
  exportToCsv,
  formatDateTime,
  formatRupiah,
  getTodayJakarta,
  getTodayJakartaFromOffset,
  getYesterdayJakarta,
} from '../lib/format';

type DateRangePreset = 'HARI_INI' | 'KEMARIN' | 'MINGGU_INI' | 'BULAN_INI' | 'CUSTOM';

export const ReportsPage: React.FC = () => {
  const { snapshot, pushToast } = useWarung();
  const todayStr = getTodayJakarta();
  const [preset, setPreset] = useState<DateRangePreset>('MINGGU_INI');
  const [customStart, setCustomStart] = useState(getTodayJakartaFromOffset(-7));
  const [customEnd, setCustomEnd] = useState(todayStr);

  const { startDate, endDate } = useMemo(() => {
    if (preset === 'HARI_INI') return { startDate: todayStr, endDate: todayStr };
    if (preset === 'KEMARIN') {
      const y = getYesterdayJakarta();
      return { startDate: y, endDate: y };
    }
    if (preset === 'MINGGU_INI') {
      return { startDate: getTodayJakartaFromOffset(-6), endDate: todayStr };
    }
    if (preset === 'BULAN_INI') {
      return { startDate: todayStr.slice(0, 7) + '-01', endDate: todayStr };
    }
    return { startDate: customStart || todayStr, endDate: customEnd || todayStr };
  }, [preset, todayStr, customStart, customEnd]);

  const report = useMemo(() => {
    const orders = (snapshot?.orders ?? []).filter(
      (o) => o.queue_date >= startDate && o.queue_date <= endDate,
    );
    const categories = snapshot?.categories ?? [];
    const products = snapshot?.products ?? [];

    const validOrders = orders.filter((o) => o.status !== 'DIBATALKAN');
    const paidOrders = validOrders.filter((o) => o.payment_status === 'SUDAH BAYAR');

    const totalRevenue = paidOrders.reduce((s, o) => s + o.total, 0);
    let totalCost = 0;
    let totalItemsSold = 0;

    const topProductMap = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
    const categorySalesMap = new Map<string, { name: string; qty: number; revenue: number }>();
    const paymentMethodMap = new Map<string, { method: string; count: number; total: number }>();

    for (const o of paidOrders) {
      const method = o.payment?.method ?? 'TUNAI';
      const pm = paymentMethodMap.get(method) ?? { method, count: 0, total: 0 };
      pm.count += 1;
      pm.total += o.total;
      paymentMethodMap.set(method, pm);

      for (const item of o.items) {
        totalItemsSold += item.quantity;
        const itemCost = (item.cost_price || 0) * item.quantity;
        totalCost += itemCost;
        const itemProfit = item.line_total - itemCost;

        const pStat = topProductMap.get(item.product_id) ?? {
          name: item.product_name,
          qty: 0,
          revenue: 0,
          profit: 0,
        };
        pStat.qty += item.quantity;
        pStat.revenue += item.line_total;
        pStat.profit += itemProfit;
        topProductMap.set(item.product_id, pStat);

        const prod = products.find((pr) => pr.id === item.product_id);
        const catName = categories.find((c) => c.id === prod?.category_id)?.name ?? 'Lainnya';
        const cStat = categorySalesMap.get(catName) ?? { name: catName, qty: 0, revenue: 0 };
        cStat.qty += item.quantity;
        cStat.revenue += item.line_total;
        categorySalesMap.set(catName, cStat);
      }
    }

    const grossProfit = totalRevenue - totalCost;
    const queueSummary = {
      total: orders.length,
      selesai: orders.filter((o) => o.status === 'SELESAI').length,
      dibatalkan: orders.filter((o) => o.status === 'DIBATALKAN').length,
      aktif: orders.filter((o) => !['SELESAI', 'DIBATALKAN'].includes(o.status)).length,
    };

    return {
      orders,
      paidOrders,
      totalTransactions: paidOrders.length,
      totalRevenue,
      totalItemsSold,
      grossProfit,
      topMenus: Array.from(topProductMap.values()).sort((a, b) => b.qty - a.qty),
      categorySales: Array.from(categorySalesMap.values()).sort((a, b) => b.revenue - a.revenue),
      paymentMethods: Array.from(paymentMethodMap.values()).sort((a, b) => b.total - a.total),
      queueSummary,
      lowStockCount: products.filter((p) => p.is_active && p.stock <= p.min_stock).length,
    };
  }, [snapshot, startDate, endDate]);

  const handleExportCsv = () => {
    const headers = [
      'Tanggal',
      'No Transaksi',
      'No Antrean',
      'Pelanggan',
      'Status Antrean',
      'Status Bayar',
      'Metode',
      'Subtotal',
      'Diskon',
      'Total',
    ];
    const rows = report.orders.map((o) => [
      formatDateTime(o.created_at),
      o.order_number,
      o.queue_code,
      o.customer_name,
      o.status,
      o.payment_status,
      o.payment?.method ?? '-',
      o.subtotal,
      o.discount,
      o.total,
    ]);
    exportToCsv(`laporan-warung-${startDate}-sd-${endDate}.csv`, headers, rows);
    pushToast({ type: 'success', title: 'Laporan CSV diunduh.' });
  };

  const handlePrintPdf = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Filter & Export Toolbar */}
      <div className="no-print bg-white rounded-2xl border border-slate-200 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: 'HARI_INI', label: 'Hari Ini' },
              { id: 'KEMARIN', label: 'Kemarin' },
              { id: 'MINGGU_INI', label: '7 Hari' },
              { id: 'BULAN_INI', label: 'Bulan Ini' },
              { id: 'CUSTOM', label: 'Custom Tanggal' },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setPreset(item.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                preset === item.id
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}

          {preset === 'CUSTOM' && (
            <div className="flex items-center gap-2 ml-1">
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
              <span className="text-xs text-slate-400">s/d</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-xs"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export CSV</span>
          </button>
          <button
            type="button"
            onClick={handlePrintPdf}
            className="inline-flex items-center gap-1.5 rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            <span>Cetak / PDF</span>
          </button>
        </div>
      </div>

      {/* Period Header for Print */}
      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          Periode Laporan: <strong className="text-slate-900 font-mono">{startDate}</strong> s/d{' '}
          <strong className="text-slate-900 font-mono">{endDate}</strong>
        </span>
        <span>{snapshot?.settings.warung_name}</span>
      </div>

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Pendapatan</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {formatRupiah(report.totalRevenue)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Laba Kotor (Estimasi)</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-emerald-700 tabular-nums mt-1">
            {formatRupiah(report.grossProfit)}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Transaksi Lunas</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {report.totalTransactions}
          </p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs text-slate-500">Total Item Terjual</p>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-1">
            {report.totalItemsSold}
          </p>
        </div>
      </div>

      {/* Detailed Breakdown Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Bestsellers */}
        <div className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5">
          <h2 className="font-display text-sm font-bold text-slate-900 mb-3">Menu Terlaris</h2>
          {report.topMenus.length === 0 ? (
            <p className="text-xs text-slate-500 py-6 text-center">Belum ada penjualan lunas pada periode ini.</p>
          ) : (
            <div className="divide-y divide-slate-100 text-xs">
              {report.topMenus.map((m, idx) => (
                <div key={m.name} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="font-mono font-bold text-slate-400 w-5">{idx + 1}.</span>
                    <span className="font-semibold text-slate-900">{m.name}</span>
                  </div>
                  <div className="text-right font-mono tabular-nums">
                    <span className="font-bold text-slate-900">{m.qty}x</span>
                    <span className="text-slate-500 ml-3">{formatRupiah(m.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Payment Methods + Categories */}
        <div className="lg:col-span-6 space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3">Metode Pembayaran</h2>
            {report.paymentMethods.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada pembayaran pada periode ini.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {report.paymentMethods.map((pm) => (
                  <div key={pm.method} className="py-2.5 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {pm.method} <span className="text-slate-400 font-normal">({pm.count}x)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatRupiah(pm.total)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-5">
            <h2 className="font-display text-sm font-bold text-slate-900 mb-3">Penjualan per Kategori</h2>
            {report.categorySales.length === 0 ? (
              <p className="text-xs text-slate-500">Belum ada data penjualan kategori.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {report.categorySales.map((cat) => (
                  <div key={cat.name} className="py-2.5 flex items-center justify-between">
                    <span className="font-semibold text-slate-800">
                      {cat.name} <span className="text-slate-400 font-normal">({cat.qty} item)</span>
                    </span>
                    <span className="font-mono font-bold text-slate-900 tabular-nums">
                      {formatRupiah(cat.revenue)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Queue & Stock Summary */}
      <div className="bg-white rounded-2xl border border-slate-200 p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div>
          <p className="text-slate-500">Total Antrean Periode</p>
          <p className="font-mono text-lg font-bold text-slate-900 mt-0.5">{report.queueSummary.total}</p>
        </div>
        <div>
          <p className="text-slate-500">Antrean Selesai</p>
          <p className="font-mono text-lg font-bold text-emerald-700 mt-0.5">{report.queueSummary.selesai}</p>
        </div>
        <div>
          <p className="text-slate-500">Dibatalkan</p>
          <p className="font-mono text-lg font-bold text-rose-700 mt-0.5">{report.queueSummary.dibatalkan}</p>
        </div>
        <div>
          <p className="text-slate-500">Menu Stok Menipis</p>
          <p className="font-mono text-lg font-bold text-amber-700 mt-0.5">{report.lowStockCount}</p>
        </div>
      </div>
    </div>
  );
};
