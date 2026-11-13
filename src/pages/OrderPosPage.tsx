import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Minus,
  Plus,
  Search,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react';
import { MenuImage } from '../components/MenuImage';
import { ReceiptModal } from '../components/ReceiptModal';
import { useWarung } from '../context/WarungContext';
import { formatRupiah, getTodayJakarta, QUEUE_STATUS_META } from '../lib/format';
import type { CartItemInput, Order, OrderItemModifier, Product } from '../types/warung';

interface OrderPosPageProps {
  mode: 'customer' | 'cashier';
  onNavigate: (path: string) => void;
}

export const OrderPosPage: React.FC<OrderPosPageProps> = ({ mode, onNavigate }) => {
  const { snapshot, user, createOrder, pushToast } = useWarung();
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [cart, setCart] = useState<CartItemInput[]>([]);
  const [customerName, setCustomerName] = useState(user?.role === 'pelanggan' ? user.full_name : '');
  const [orderNotes, setOrderNotes] = useState('');
  const [discountInput, setDiscountInput] = useState('0');
  const [submitting, setSubmitting] = useState(false);

  // Modifier modal state
  const [configProduct, setConfigProduct] = useState<Product | null>(null);
  const [selectedMods, setSelectedMods] = useState<OrderItemModifier[]>([]);
  const [itemQty, setItemQty] = useState(1);
  const [itemNotes, setItemNotes] = useState('');

  // Mobile cart sheet & created order receipt
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [lastCreatedOrder, setLastCreatedOrder] = useState<Order | null>(null);
  const [receiptOrder, setReceiptOrder] = useState<Order | null>(null);

  const categories = useMemo(
    () => (snapshot?.categories ?? []).filter((c) => c.is_active),
    [snapshot?.categories],
  );
  const modifiers = useMemo(
    () => (snapshot?.modifiers ?? []).filter((m) => m.is_active),
    [snapshot?.modifiers],
  );
  const products = useMemo(() => {
    const list = (snapshot?.products ?? []).filter((p) => p.is_active);
    return list.filter((p) => {
      const matchCat = selectedCategory === 'ALL' || p.category_id === selectedCategory;
      const q = searchQuery.trim().toLowerCase();
      const matchSearch =
        !q || p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q);
      return matchCat && matchSearch;
    });
  }, [snapshot?.products, selectedCategory, searchQuery]);

  const todayStr = getTodayJakarta();
  const todayOrders = useMemo(
    () => (snapshot?.orders ?? []).filter((o) => o.queue_date === todayStr),
    [snapshot?.orders, todayStr],
  );
  const activeCallingOrder = todayOrders.find((o) => o.status === 'DIPANGGIL');
  const waitingCount = todayOrders.filter((o) => o.status === 'MENUNGGU' || o.status === 'DIPROSES').length;
  const estMinutesPerOrder = snapshot?.settings.estimated_minutes_per_order ?? 4;

  const openProductModal = (product: Product) => {
    if (product.stock <= 0) {
      pushToast({ type: 'error', title: 'Menu ini sedang habis.' });
      return;
    }
    setConfigProduct(product);
    setSelectedMods([]);
    setItemQty(1);
    setItemNotes('');
  };

  const toggleModifier = (mod: OrderItemModifier) => {
    setSelectedMods((prev) =>
      prev.some((m) => m.id === mod.id) ? prev.filter((m) => m.id !== mod.id) : [...prev, mod],
    );
  };

  const confirmAddToCart = () => {
    if (!configProduct) return;
    if (itemQty > configProduct.stock) {
      pushToast({
        type: 'warning',
        title: 'Stok tidak mencukupi',
        message: `Tersedia hanya ${configProduct.stock} ${configProduct.unit}.`,
      });
      return;
    }
    setCart((prev) => [
      ...prev,
      {
        tempId: `${configProduct.id}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        product: configProduct,
        quantity: itemQty,
        modifiers: selectedMods,
        notes: itemNotes.trim() || undefined,
      },
    ]);
    setConfigProduct(null);
  };

  const updateCartQty = (tempId: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.tempId !== tempId) return item;
          const nextQty = item.quantity + delta;
          if (nextQty <= 0) return null;
          if (nextQty > item.product.stock) {
            pushToast({
              type: 'warning',
              title: 'Batas stok tercapai',
              message: `Maksimal ${item.product.stock} ${item.product.unit}.`,
            });
            return item;
          }
          return { ...item, quantity: nextQty };
        })
        .filter((x): x is CartItemInput => x !== null),
    );
  };

  const removeCartItem = (tempId: string) => {
    setCart((prev) => prev.filter((i) => i.tempId !== tempId));
  };

  const subtotal = cart.reduce((sum, item) => {
    const modSum = item.modifiers.reduce((ms, m) => ms + m.price, 0);
    return sum + (item.product.sell_price + modSum) * item.quantity;
  }, 0);

  const discountVal = mode === 'cashier' ? Math.min(subtotal, Math.max(0, Number(discountInput) || 0)) : 0;
  const total = Math.max(0, subtotal - discountVal);
  const totalQty = cart.reduce((s, i) => s + i.quantity, 0);

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setSubmitting(true);
    try {
      const res = await createOrder({
        customer_name: customerName.trim() || 'Pelanggan',
        notes: orderNotes.trim() || undefined,
        discount: discountVal,
        items: cart.map((c) => ({
          product_id: c.product.id,
          quantity: c.quantity,
          modifier_ids: c.modifiers.map((m) => m.id),
          notes: c.notes,
        })),
      });
      setCart([]);
      setOrderNotes('');
      setDiscountInput('0');
      setMobileCartOpen(false);
      if (res.order) {
        setLastCreatedOrder(res.order);
      }
    } catch (err) {
      pushToast({
        type: 'error',
        title: 'Gagal membuat pesanan',
        message: err instanceof Error ? err.message : 'Periksa kembali pesanan Anda.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Track latest order live from snapshot
  const trackedOrder = lastCreatedOrder
    ? snapshot?.orders.find((o) => o.id === lastCreatedOrder.id) ?? lastCreatedOrder
    : null;

  const CartPanelContent = (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-slate-200 flex items-center justify-between">
        <div>
          <h2 className="font-display text-base font-bold text-slate-900">Keranjang Pesanan</h2>
          <p className="text-xs text-slate-500">{totalQty} item dipilih</p>
        </div>
        {cart.length > 0 && (
          <button
            type="button"
            onClick={() => setCart([])}
            className="text-xs font-medium text-rose-600 hover:text-rose-700 cursor-pointer"
          >
            Kosongkan
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {cart.length === 0 ? (
          <div className="py-12 text-center space-y-2">
            <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
            <p className="text-sm font-medium text-slate-600">Keranjang masih kosong</p>
            <p className="text-xs text-slate-400">Ketuk menu di sebelah kiri untuk menambahkan pesanan.</p>
          </div>
        ) : (
          cart.map((item) => {
            const modSum = item.modifiers.reduce((s, m) => s + m.price, 0);
            const unitWithMod = item.product.sell_price + modSum;
            return (
              <div key={item.tempId} className="pb-3 border-b border-slate-100 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.product.name}</p>
                    <p className="text-xs text-slate-500 font-mono tabular-nums">
                      {formatRupiah(unitWithMod)} / {item.product.unit}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900 font-mono tabular-nums shrink-0">
                    {formatRupiah(unitWithMod * item.quantity)}
                  </p>
                </div>

                {item.modifiers.length > 0 && (
                  <p className="text-xs text-slate-500">
                    Tambahan: {item.modifiers.map((m) => m.name).join(', ')}
                  </p>
                )}
                {item.notes && <p className="text-xs text-slate-500 italic">Catatan: {item.notes}</p>}

                <div className="flex items-center justify-between pt-1">
                  <div className="inline-flex items-center rounded-lg border border-slate-200 bg-slate-50">
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.tempId, -1)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-700 hover:bg-slate-200/60 rounded-l-lg cursor-pointer"
                      aria-label="Kurangi jumlah"
                    >
                      <Minus className="w-3.5 h-3.5" />
                    </button>
                    <span className="px-3 text-xs font-bold font-mono tabular-nums">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => updateCartQty(item.tempId, 1)}
                      className="min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-700 hover:bg-slate-200/60 rounded-r-lg cursor-pointer"
                      aria-label="Tambah jumlah"
                    >
                      <Plus className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeCartItem(item.tempId)}
                    className="p-2 text-slate-400 hover:text-rose-600 cursor-pointer"
                    aria-label="Hapus item"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="p-4 border-t border-slate-200 bg-slate-50 space-y-3">
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pelanggan / Meja</label>
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            placeholder="Contoh: Budi / Meja 4"
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Pesanan (Opsional)</label>
          <input
            type="text"
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
            placeholder="Bungkus / makan di tempat..."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
          />
        </div>

        {mode === 'cashier' && (
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Diskon (Rp)</label>
            <input
              type="number"
              min={0}
              value={discountInput}
              onChange={(e) => setDiscountInput(e.target.value)}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:border-orange-500 focus:outline-none"
            />
          </div>
        )}

        <div className="space-y-1 pt-2 border-t border-slate-200 text-xs">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span className="font-mono tabular-nums">{formatRupiah(subtotal)}</span>
          </div>
          {discountVal > 0 && (
            <div className="flex justify-between text-emerald-700">
              <span>Diskon</span>
              <span className="font-mono tabular-nums">-{formatRupiah(discountVal)}</span>
            </div>
          )}
          <div className="flex justify-between text-base font-bold text-slate-900 pt-1">
            <span>Total</span>
            <span className="font-mono tabular-nums">{formatRupiah(total)}</span>
          </div>
        </div>

        <button
          type="button"
          disabled={cart.length === 0 || submitting}
          onClick={handleCheckout}
          className="w-full min-h-[46px] rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-50 transition-colors cursor-pointer"
        >
          {submitting ? 'Membuat Antrean...' : 'Konfirmasi & Ambil Nomor Antrean'}
        </button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Live Queue Banner for Customer / Cashier Quick Awareness */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Sedang Dipanggil</p>
            <p className="font-mono text-2xl font-bold text-orange-600 tabular-nums mt-0.5">
              {activeCallingOrder ? activeCallingOrder.queue_code : '—'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('/display')}
            className="text-xs font-semibold text-slate-700 hover:text-orange-600 underline underline-offset-4 cursor-pointer"
          >
            Buka Layar TV
          </button>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500">Antrean Aktif</p>
            <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
              {waitingCount} pesanan
            </p>
          </div>
          <Clock className="w-5 h-5 text-slate-400" />
        </div>

        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <p className="text-xs font-medium text-slate-500">Estimasi Tunggu Baru</p>
          <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-0.5">
            ~{Math.max(estMinutesPerOrder, waitingCount * estMinutesPerOrder)} menit
          </p>
        </div>
      </div>

      {/* Live Tracked Order Card after Checkout */}
      {trackedOrder && (
        <div className="bg-white rounded-xl border border-emerald-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span className="font-semibold text-slate-900">Pesanan Anda Terdaftar</span>
                <span aria-hidden="true">·</span>
                <span>{trackedOrder.order_number}</span>
                <span aria-hidden="true">·</span>
                <span className="font-semibold text-orange-700">
                  Status: {QUEUE_STATUS_META[trackedOrder.status].label}
                </span>
              </div>
              <p className="mt-1 text-sm text-slate-700">
                Nomor Antrean Anda:{' '}
                <strong className="font-mono text-xl text-slate-900 ml-1">{trackedOrder.queue_code}</strong>{' '}
                <span className="text-slate-500 ml-2">({formatRupiah(trackedOrder.total)})</span>
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setReceiptOrder(trackedOrder)}
              className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Lihat Struk
            </button>
            {mode === 'cashier' && trackedOrder.payment_status === 'BELUM BAYAR' && (
              <button
                type="button"
                onClick={() => onNavigate('/pembayaran')}
                className="rounded-lg bg-slate-900 px-3.5 py-2 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
              >
                Proses Bayar
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Split Workspace: Menu Grid (left) + Sticky Cart Panel (right on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-8 space-y-4">
          {/* Search + Category Filter Tabs */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nasi, jus mangga, dimsum..."
                className="w-full rounded-xl border border-slate-200 bg-white pl-10 pr-4 py-2.5 text-sm text-slate-900 focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
            <button
              type="button"
              onClick={() => setSelectedCategory('ALL')}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                selectedCategory === 'ALL'
                  ? 'bg-slate-900 text-white'
                  : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
              }`}
            >
              Semua Menu
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  selectedCategory === cat.id
                    ? 'bg-slate-900 text-white'
                    : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>

          {/* Menu Product Cards */}
          {products.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-10 text-center">
              <p className="text-sm font-semibold text-slate-700">Menu tidak ditemukan</p>
              <p className="text-xs text-slate-500 mt-1">Ubah kata kunci pencarian atau pilih kategori lain.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3.5">
              {products.map((product) => {
                const isOut = product.stock <= 0;
                const isLow = product.stock > 0 && product.stock <= product.min_stock;
                const catName = categories.find((c) => c.id === product.category_id)?.name ?? 'Menu';

                return (
                  <button
                    key={product.id}
                    type="button"
                    disabled={isOut}
                    onClick={() => openProductModal(product)}
                    className={`group text-left bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col transition-all ${
                      isOut
                        ? 'opacity-60 cursor-not-allowed'
                        : 'hover:border-orange-300 hover:shadow-sm cursor-pointer active:scale-[0.99]'
                    }`}
                  >
                    <div className="aspect-[4/3] w-full bg-slate-100 relative overflow-hidden">
                      <MenuImage src={product.image_url} alt={product.name} />
                      {isOut && (
                        <div className="absolute inset-0 bg-slate-900/65 flex items-center justify-center">
                          <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white text-[11px] font-bold tracking-wide">
                            MENU HABIS
                          </span>
                        </div>
                      )}
                    </div>
                    <div className="p-3 flex-1 flex flex-col justify-between gap-2">
                      <div>
                        <p className="text-[11px] text-slate-500 truncate">
                          {catName} <span aria-hidden="true">·</span> Stok {product.stock}
                        </p>
                        <h3 className="text-sm font-bold text-slate-900 mt-0.5 line-clamp-2 leading-snug">
                          {product.name}
                        </h3>
                      </div>
                      <div className="flex items-center justify-between gap-2 pt-1">
                        <span className="font-mono text-sm font-bold text-orange-600 tabular-nums">
                          {formatRupiah(product.sell_price)}
                        </span>
                        {isLow && (
                          <span className="text-[10px] font-semibold text-amber-700">Hampir habis</span>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Desktop Cart Sidebar */}
        <div className="hidden lg:block lg:col-span-4 sticky top-24 bg-white rounded-xl border border-slate-200 overflow-hidden max-h-[calc(100vh-8rem)]">
          {CartPanelContent}
        </div>
      </div>

      {/* Mobile Floating Cart Trigger (compact above bottom nav) */}
      {cart.length > 0 && (
        <div className="lg:hidden fixed bottom-20 left-4 right-4 z-20">
          <button
            type="button"
            onClick={() => setMobileCartOpen(true)}
            className="w-full min-h-[48px] rounded-xl bg-orange-600 px-4 py-3 text-white shadow-lg flex items-center justify-between font-semibold text-sm cursor-pointer"
          >
            <span>Keranjang ({totalQty} item)</span>
            <span className="font-mono tabular-nums">{formatRupiah(total)}</span>
          </button>
        </div>
      )}

      {/* Mobile Cart Sheet */}
      {mobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex flex-col justify-end bg-slate-900/50 backdrop-blur-xs">
          <div className="bg-white rounded-t-3xl max-h-[88vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 pt-3 pb-1">
              <div className="w-10 h-1.5 bg-slate-300 rounded-full mx-auto" />
              <button
                type="button"
                onClick={() => setMobileCartOpen(false)}
                className="p-2 text-slate-500"
                aria-label="Tutup keranjang"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{CartPanelContent}</div>
          </div>
        </div>
      )}

      {/* Modifier & Quantity Modal */}
      {configProduct && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-slate-900/50 p-0 sm:p-4 backdrop-blur-xs">
          <div className="w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-2xl border border-slate-200 overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div>
                <h3 className="font-display text-base font-bold text-slate-900">{configProduct.name}</h3>
                <p className="text-xs font-mono text-orange-600 font-semibold tabular-nums">
                  {formatRupiah(configProduct.sell_price)} · Stok {configProduct.stock} {configProduct.unit}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setConfigProduct(null)}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-5">
              {configProduct.description && (
                <p className="text-xs text-slate-600 leading-relaxed">{configProduct.description}</p>
              )}

              <div>
                <p className="text-xs font-bold text-slate-800 mb-2.5">Tambahan / Level Pedas (Opsional)</p>
                <div className="grid grid-cols-1 gap-2">
                  {modifiers.map((mod) => {
                    const checked = selectedMods.some((m) => m.id === mod.id);
                    return (
                      <button
                        key={mod.id}
                        type="button"
                        onClick={() => toggleModifier({ id: mod.id, name: mod.name, price: mod.price })}
                        className={`flex items-center justify-between px-3.5 py-2.5 rounded-lg border text-xs font-medium transition-colors cursor-pointer ${
                          checked
                            ? 'border-orange-500 bg-orange-50 text-orange-900 font-semibold'
                            : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <span>{mod.name}</span>
                        <span className="font-mono tabular-nums">
                          {mod.price > 0 ? `+${formatRupiah(mod.price)}` : 'Gratis'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1.5">Catatan Item</label>
                <input
                  type="text"
                  value={itemNotes}
                  onChange={(e) => setItemNotes(e.target.value)}
                  placeholder="Contoh: tanpa bawang goreng, es sedikit..."
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-orange-500 focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-bold text-slate-800">Jumlah Pesanan</span>
                <div className="inline-flex items-center rounded-lg border border-slate-300 bg-slate-50">
                  <button
                    type="button"
                    onClick={() => setItemQty((q) => Math.max(1, q - 1))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 text-sm font-bold font-mono tabular-nums">{itemQty}</span>
                  <button
                    type="button"
                    onClick={() => setItemQty((q) => Math.min(configProduct.stock, q + 1))}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-700 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-200 bg-slate-50">
              <button
                type="button"
                onClick={confirmAddToCart}
                className="w-full min-h-[46px] rounded-xl bg-orange-600 px-4 py-3 text-sm font-bold text-white hover:bg-orange-700 cursor-pointer"
              >
                Tambah ke Keranjang ·{' '}
                {formatRupiah(
                  (configProduct.sell_price + selectedMods.reduce((s, m) => s + m.price, 0)) * itemQty,
                )}
              </button>
            </div>
          </div>
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
