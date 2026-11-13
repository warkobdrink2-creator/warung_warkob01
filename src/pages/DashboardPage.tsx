import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowUpRight,
  BarChart3,
  Clock,
  Receipt,
  ShoppingBag,
  UtensilsCrossed,
} from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import { formatRupiah, getTodayJakarta, getTodayJakartaFromOffset } from '../lib/format';

interface DashboardPageProps {
  onNavigate: (path: string) => void;
}

export const DashboardPage: React.FC<DashboardPageProps> = ({ onNavigate }) => {
  const { snapshot, loading } = useWarung();

  const todayStr = getTodayJakarta();

  const metrics = useMemo(() => {
    const orders = snapshot?.orders ?? [];
    const products = snapshot?.products ?? [];
    const todayOrders = orders.filter((o) => o.queue_date === todayStr);

    const menunggu = todayOrders.filter((o) => o.status === 'MENUNGGU').length;
    const dipanggil = todayOrders.filter((o) => o.status === 'DIPANGGIL').length;
    const diproses = todayOrders.filter((o) => o.status === 'DIPROSES').length;
    const siap = todayOrders.filter((o) => o.status === 'SIAP').length;
    const selesai = todayOrders.filter((o) => o.status === 'SELESAI').length;

    const paidToday = todayOrders.filter((o) => o.payment_status === 'SUDAH BAYAR');
    const revenueToday = paidToday.reduce((sum, o) => sum + o.total, 0);

    const activeMenus = products.filter((p) => p.is_active).length;
    const lowStockProducts = products.filter((p) => p.is_active && p.stock <= p.min_stock);

    // Daily sales for last 7 days
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const dateStr = getTodayJakartaFromOffset(i - 6);
      const dayPaid = orders.filter((o) => o.queue_date === dateStr && o.payment_status === 'SUDAH BAYAR');
      const total = dayPaid.reduce((s, o) => s + o.total, 0);
      const label = new Intl.DateTimeFormat('id-ID', {
        weekday: 'short',
        day: 'numeric',
      }).format(new Date(dateStr + 'T12:00:00'));
      return { dateStr, label, total, count: dayPaid.length };
    });

    // Top selling products from all paid/non-cancelled orders
    const productSales = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const o of orders) {
      if (o.status === 'DIBATALKAN') continue;
      for (const item of o.items) {
        const cur = productSales.get(item.product_id) ?? {
          name: item.product_name,
          qty: 0,
          revenue: 0,
        };
        cur.qty += item.quantity;
        cur.revenue += item.line_total;
        productSales.set(item.product_id, cur);
      }
    }
    const topMenus = Array.from(productSales.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalQueueToday: todayOrders.length,
      menunggu,
      dipanggil,
      diproses,
      siap,
      selesai,
      paidCountToday: paidToday.length,
      revenueToday,
      activeMenus,
      lowStockProducts,
      last7Days,
      topMenus,
    };
  }, [snapshot, todayStr]);

  if (loading && !snapshot) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 rounded-xl bg-white border border-slate-200 animate-pulse" />
        ))}
      </div>
    );
  }

  const maxDailySales = Math.max(1, ...metrics.last7Days.map((d) => d.total));

  return (
    <div className="space-y-6">
      {/* Primary KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Pendapatan Hari Ini</span>
            <Receipt className="w-4 h-4 text-orange-600" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {formatRupiah(metrics.revenueToday)}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.paidCountToday} transaksi lunas
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Total Antrean Hari Ini</span>
            <Clock className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {metrics.totalQueueToday}
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.menunggu} menunggu · {metrics.diproses} dimasak
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Siap & Selesai</span>
            <ShoppingBag className="w-4 h-4 text-emerald-600" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {metrics.siap + metrics.dipanggil} siap / {metrics.selesai} selesai
          </p>
          <p className="text-xs text-slate-500 mt-1">
            {metrics.siap} siap ambil · {metrics.dipanggil} dipanggil
          </p>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs text-slate-500">
            <span>Menu & Stok</span>
            <UtensilsCrossed className="w-4 h-4 text-slate-400" />
          </div>
          <p className="font-mono text-xl sm:text-2xl font-bold text-slate-900 tabular-nums mt-2">
            {metrics.activeMenus} aktif
          </p>
          <p className={`text-xs mt-1 font-medium ${metrics.lowStockProducts.length > 0 ? 'text-amber-700' : 'text-slate-500'}`}>
            {metrics.lowStockProducts.length} menu stok menipis
          </p>
        </div>
      </div>

      {/* Charts + Bestsellers */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">Grafik Penjualan 7 Hari Terakhir</h2>
              <p className="text-xs text-slate-500 mt-0.5">Omzet transaksi lunas per hari</p>
            </div>
            <BarChart3 className="w-5 h-5 text-slate-400" />
          </div>

          <div className="h-56 flex items-end gap-3 pt-4">
            {metrics.last7Days.map((day) => {
              const heightPct = Math.max(4, Math.round((day.total / maxDailySales) * 100));
              const isToday = day.dateStr === todayStr;
              return (
                <div key={day.dateStr} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
                  <span className="text-[10px] font-mono text-slate-500 tabular-nums truncate max-w-full">
                    {day.total > 0 ? `${Math.round(day.total / 1000)}rb` : '0'}
                  </span>
                  <div className="w-full max-w-[44px] bg-slate-100 rounded-t-lg h-36 flex items-end overflow-hidden">
                    <div
                      style={{ height: `${day.total > 0 ? heightPct : 3}%` }}
                      className={`w-full rounded-t-lg transition-all ${
                        isToday ? 'bg-orange-600' : 'bg-slate-800'
                      }`}
                    />
                  </div>
                  <span className={`text-[11px] truncate ${isToday ? 'font-bold text-orange-600' : 'text-slate-500'}`}>
                    {day.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Selling Menus */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 p-5 sm:p-6 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="font-display text-base font-bold text-slate-900">Menu Paling Laris</h2>
                <p className="text-xs text-slate-500 mt-0.5">Berdasarkan total porsi terjual</p>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/laporan')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
              >
                <span>Detail</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>

            {metrics.topMenus.length === 0 ? (
              <p className="text-xs text-slate-500 py-8 text-center">Belum ada transaksi tercatat.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {metrics.topMenus.map((item, idx) => (
                  <div key={item.name} className="py-3 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-mono text-xs font-bold text-slate-400 w-5 tabular-nums">
                        0{idx + 1}.
                      </span>
                      <span className="text-sm font-semibold text-slate-900 truncate">{item.name}</span>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-xs font-bold text-slate-900 tabular-nums">{item.qty} terjual</p>
                      <p className="font-mono text-[11px] text-slate-500 tabular-nums">{formatRupiah(item.revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Low Stock Alert Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h2 className="font-display text-sm font-bold text-slate-900">Peringatan Stok Menipis & Habis</h2>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/stok')}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
          >
            Kelola Stok →
          </button>
        </div>

        {metrics.lowStockProducts.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500">
            Seluruh stok menu aktif berada di atas batas minimum.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {metrics.lowStockProducts.map((p) => (
              <div key={p.id} className="px-5 py-3 flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.name}</p>
                  <p className="text-xs text-slate-500">
                    SKU {p.sku} · Minimum {p.min_stock} {p.unit}
                  </p>
                </div>
                <div className="text-right">
                  <span
                    className={`inline-block px-2.5 py-1 rounded-md text-xs font-bold ${
                      p.stock === 0 ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {p.stock === 0 ? 'MENU HABIS' : `Sisa ${p.stock} ${p.unit} — Stok hampir habis`}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
