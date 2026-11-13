import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AuditLog,
  Category,
  InventoryTransaction,
  InventoryTxType,
  Order,
  OrderItem,
  Payment,
  PaymentMethod,
  Product,
  ProductModifier,
  QueueStatus,
  UserProfile,
  UserRole,
  WarungSettings,
  WarungStateSnapshot,
} from '../types/warung.ts';

interface StoredUser extends UserProfile {
  password_hash: string;
}

interface DailyQueueCounter {
  queue_date: string;
  last_number: number;
}

interface WarungDatabase {
  users: StoredUser[];
  categories: Category[];
  products: Product[];
  modifiers: ProductModifier[];
  orders: Order[];
  payments: Payment[];
  inventoryTransactions: InventoryTransaction[];
  dailyQueues: Record<string, DailyQueueCounter>;
  settings: WarungSettings;
  auditLogs: AuditLog[];
}

const DATA_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DATA_DIR, 'warung-db.json');

export function getJakartaDateString(date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const parts = storedHash.split(':');
  if (parts.length !== 2) return false;
  const [salt, keyHex] = parts;
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
}

function makeSeedDatabase(): WarungDatabase {
  const now = new Date();
  const today = getJakartaDateString(now);
  const yesterdayDate = new Date(now.getTime() - 86400000);
  const yesterday = getJakartaDateString(yesterdayDate);
  const twoDaysAgo = getJakartaDateString(new Date(now.getTime() - 2 * 86400000));

  const adminId = 'usr-admin-001';
  const kasirId = 'usr-kasir-001';
  const dapurId = 'usr-dapur-001';
  const pelangganId = 'usr-pelanggan-001';

  const users: StoredUser[] = [
    {
      id: adminId,
      email: 'admin@warung.id',
      full_name: 'Budi Santoso (Admin)',
      role: 'admin',
      phone: '081210001001',
      is_active: true,
      password_hash: hashPassword('admin123'),
      created_at: twoDaysAgo + 'T08:00:00.000Z',
    },
    {
      id: kasirId,
      email: 'kasir@warung.id',
      full_name: 'Siti Rahma (Kasir)',
      role: 'kasir',
      phone: '081210001002',
      is_active: true,
      password_hash: hashPassword('kasir123'),
      created_at: twoDaysAgo + 'T08:00:00.000Z',
    },
    {
      id: dapurId,
      email: 'dapur@warung.id',
      full_name: 'Agus Pratama (Dapur)',
      role: 'dapur',
      phone: '081210001003',
      is_active: true,
      password_hash: hashPassword('dapur123'),
      created_at: twoDaysAgo + 'T08:00:00.000Z',
    },
    {
      id: pelangganId,
      email: 'pelanggan@warung.id',
      full_name: 'Dewi Lestari (Pelanggan)',
      role: 'pelanggan',
      phone: '081210001004',
      is_active: true,
      password_hash: hashPassword('pelanggan123'),
      created_at: twoDaysAgo + 'T08:00:00.000Z',
    },
  ];

  const categories: Category[] = [
    { id: 'cat-makanan', name: 'Makanan', slug: 'makanan', description: 'Hidangan utama nasi dan mie hangat', sort_order: 1, is_active: true, created_at: twoDaysAgo + 'T08:00:00.000Z' },
    { id: 'cat-minuman', name: 'Minuman', slug: 'minuman', description: 'Aneka jus buah segar dan minuman dingin', sort_order: 2, is_active: true, created_at: twoDaysAgo + 'T08:00:00.000Z' },
    { id: 'cat-snack', name: 'Snack', slug: 'snack', description: 'Camilan hangat dan pendamping', sort_order: 3, is_active: true, created_at: twoDaysAgo + 'T08:00:00.000Z' },
    { id: 'cat-paket', name: 'Paket', slug: 'paket', description: 'Paket hemat makanan dan minuman', sort_order: 4, is_active: true, created_at: twoDaysAgo + 'T08:00:00.000Z' },
    { id: 'cat-tambahan', name: 'Tambahan', slug: 'tambahan', description: 'Pelengkap seperti telur dan sambal', sort_order: 5, is_active: true, created_at: twoDaysAgo + 'T08:00:00.000Z' },
  ];

  const products: Product[] = [
    {
      id: 'prd-katsu',
      category_id: 'cat-makanan',
      sku: 'MAK-001',
      name: 'Nasi Ayam Katsu',
      description: 'Nasi putih hangat dengan ayam katsu renyah, salad kol segar, dan saus spesial.',
      image_url: 'preset:katsu',
      cost_price: 13000,
      sell_price: 22000,
      unit: 'porsi',
      stock: 34,
      min_stock: 10,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-miegoreng',
      category_id: 'cat-makanan',
      sku: 'MAK-002',
      name: 'Mie Goreng',
      description: 'Mie goreng tek-tek spesial dengan sawi hijau, acar segar, dan bawang goreng renyah.',
      image_url: 'preset:mie-goreng',
      cost_price: 8500,
      sell_price: 15000,
      unit: 'porsi',
      stock: 38,
      min_stock: 10,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-mieayam',
      category_id: 'cat-makanan',
      sku: 'MAK-003',
      name: 'Mie Ayam',
      description: 'Mie ayam klasik dengan topping ayam kecap gurih, sawi, dan pangsit goreng.',
      cost_price: 9500,
      sell_price: 16000,
      unit: 'porsi',
      stock: 28,
      min_stock: 8,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-nasigoreng',
      category_id: 'cat-makanan',
      sku: 'MAK-004',
      name: 'Nasi Goreng',
      description: 'Nasi goreng kampung bumbu rempah dengan suwiran ayam, acar, dan kerupuk.',
      cost_price: 10000,
      sell_price: 18000,
      unit: 'porsi',
      stock: 30,
      min_stock: 8,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-jusmangga',
      category_id: 'cat-minuman',
      sku: 'MIN-001',
      name: 'Jus Mangga',
      description: 'Jus buah mangga harum manis segar dengan potongan mangga dingin.',
      image_url: 'preset:jus-mangga',
      cost_price: 5000,
      sell_price: 10000,
      unit: 'gelas',
      stock: 42,
      min_stock: 8,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-jusalpukat',
      category_id: 'cat-minuman',
      sku: 'MIN-002',
      name: 'Jus Alpukat',
      description: 'Jus alpukat mentega kental dengan siraman susu cokelat kental manis.',
      image_url: 'preset:jus-alpukat',
      cost_price: 5500,
      sell_price: 10000,
      unit: 'gelas',
      stock: 36,
      min_stock: 8,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-jusjambu',
      category_id: 'cat-minuman',
      sku: 'MIN-003',
      name: 'Jus Jambu',
      description: 'Jus jambu merah segar kaya vitamin C, manis alami.',
      cost_price: 4500,
      sell_price: 10000,
      unit: 'gelas',
      stock: 26,
      min_stock: 8,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-jusstroberi',
      category_id: 'cat-minuman',
      sku: 'MIN-004',
      name: 'Jus Stroberi',
      description: 'Jus buah stroberi segar dingin dengan cita rasa manis asam menyegarkan.',
      cost_price: 5500,
      sell_price: 10000,
      unit: 'gelas',
      stock: 5,
      min_stock: 6,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-jussirsak',
      category_id: 'cat-minuman',
      sku: 'MIN-005',
      name: 'Jus Sirsak',
      description: 'Jus sirsak segar dingin pilihan, lembut dan menyegarkan.',
      cost_price: 4500,
      sell_price: 10000,
      unit: 'gelas',
      stock: 24,
      min_stock: 6,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-dimsum',
      category_id: 'cat-snack',
      sku: 'SNK-001',
      name: 'Dimsum',
      description: 'Dimsum siomay ayam udang kukus hangat isi 4 pcs dengan chili oil.',
      image_url: 'preset:dimsum',
      cost_price: 8500,
      sell_price: 15000,
      unit: 'porsi',
      stock: 22,
      min_stock: 8,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-paket-katsu',
      category_id: 'cat-paket',
      sku: 'PKT-001',
      name: 'Paket Katsu + Jus Mangga',
      description: 'Paket hemat Nasi Ayam Katsu renyah lengkap dengan 1 gelas Jus Mangga segar.',
      image_url: 'preset:katsu',
      cost_price: 17500,
      sell_price: 29000,
      unit: 'paket',
      stock: 18,
      min_stock: 5,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-telur',
      category_id: 'cat-tambahan',
      sku: 'TMB-001',
      name: 'Telur',
      description: 'Telur dadar atau ceplok hangat sebagai pelengkap.',
      cost_price: 2500,
      sell_price: 5000,
      unit: 'butir',
      stock: 48,
      min_stock: 12,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
    {
      id: 'prd-sambal',
      category_id: 'cat-tambahan',
      sku: 'TMB-002',
      name: 'Sambal',
      description: 'Sambal bawang atau sambal terasi segar ulek dadakan.',
      cost_price: 1000,
      sell_price: 3000,
      unit: 'porsi',
      stock: 55,
      min_stock: 15,
      is_active: true,
      created_at: twoDaysAgo + 'T08:00:00.000Z',
      updated_at: now.toISOString(),
    },
  ];

  const modifiers: ProductModifier[] = [
    { id: 'mod-telur', name: 'Telur', price: 4000, modifier_group: 'topping', is_active: true },
    { id: 'mod-keju', name: 'Keju', price: 4000, modifier_group: 'topping', is_active: true },
    { id: 'mod-sambal', name: 'Sambal', price: 2000, modifier_group: 'tambahan', is_active: true },
    { id: 'mod-saus', name: 'Extra Saus', price: 2000, modifier_group: 'tambahan', is_active: true },
    { id: 'mod-mie', name: 'Extra Mie', price: 5000, modifier_group: 'porsi', is_active: true },
    { id: 'mod-es', name: 'Es', price: 1000, modifier_group: 'minuman', is_active: true },
    { id: 'mod-pedas-1', name: 'Level Pedas: Sedang', price: 0, modifier_group: 'level', is_active: true },
    { id: 'mod-pedas-2', name: 'Level Pedas: Pedas', price: 0, modifier_group: 'level', is_active: true },
    { id: 'mod-pedas-3', name: 'Level Pedas: Ekstra Pedas', price: 0, modifier_group: 'level', is_active: true },
  ];

  const settings: WarungSettings = {
    id: 'settings-main',
    warung_name: 'Warung Nusantara',
    warung_address: 'Jl. Merdeka No. 45, Bandung',
    warung_phone: '0812-3456-7890',
    queue_prefix: 'A',
    queue_padding: 3,
    auto_deduct_stock_on: 'SELESAI',
    estimated_minutes_per_order: 4,
    receipt_footer: 'Terima kasih telah berkunjung! Selamat menikmati hidangan.',
    updated_at: now.toISOString(),
  };

  // Helper to build seeded orders
  const buildSeedOrder = (
    idx: number,
    dateStr: string,
    minutesAgo: number,
    customerName: string,
    status: QueueStatus,
    paidMethod: PaymentMethod | null,
    lineConfigs: { product: Product; qty: number; mods?: ProductModifier[]; notes?: string }[],
  ): { order: Order; payment: Payment | null } => {
    const createdAt = new Date(now.getTime() - minutesAgo * 60000).toISOString();
    const orderId = `ord-seed-${dateStr}-${idx}`;
    const queueCode = `A${String(idx).padStart(3, '0')}`;
    const items: OrderItem[] = lineConfigs.map((cfg, itemIdx) => {
      const mods = (cfg.mods ?? []).map((m) => ({ id: m.id, name: m.name, price: m.price }));
      const modsTotal = mods.reduce((sum, m) => sum + m.price, 0);
      const lineTotal = (cfg.product.sell_price + modsTotal) * cfg.qty;
      return {
        id: `${orderId}-item-${itemIdx + 1}`,
        order_id: orderId,
        product_id: cfg.product.id,
        product_name: cfg.product.name,
        quantity: cfg.qty,
        unit_price: cfg.product.sell_price,
        cost_price: cfg.product.cost_price,
        modifiers: mods,
        modifiers_total: modsTotal,
        line_total: lineTotal,
        notes: cfg.notes,
      };
    });
    const subtotal = items.reduce((s, i) => s + i.line_total, 0);
    const payment: Payment | null = paidMethod
      ? {
          id: `pay-seed-${dateStr}-${idx}`,
          order_id: orderId,
          cashier_id: kasirId,
          cashier_name: 'Siti Rahma (Kasir)',
          method: paidMethod,
          status: 'SUDAH BAYAR',
          amount_due: subtotal,
          amount_paid: paidMethod === 'TUNAI' ? Math.ceil(subtotal / 10000) * 10000 : subtotal,
          change_amount: paidMethod === 'TUNAI' ? Math.ceil(subtotal / 10000) * 10000 - subtotal : 0,
          reference_no: paidMethod !== 'TUNAI' ? `REF-${dateStr.replace(/-/g, '')}-${idx}` : undefined,
          paid_at: createdAt,
        }
      : null;

    const order: Order = {
      id: orderId,
      order_number: `TRX-${dateStr.replace(/-/g, '')}-${String(idx).padStart(3, '0')}`,
      queue_number: idx,
      queue_code: queueCode,
      queue_date: dateStr,
      customer_name: customerName,
      cashier_id: paidMethod ? kasirId : null,
      cashier_name: paidMethod ? 'Siti Rahma (Kasir)' : null,
      status,
      payment_status: paidMethod ? 'SUDAH BAYAR' : 'BELUM BAYAR',
      subtotal,
      discount: 0,
      total: subtotal,
      stock_deducted: status === 'SELESAI',
      call_count: status === 'DIPANGGIL' || status === 'SELESAI' ? 1 : 0,
      called_at: status === 'DIPANGGIL' || status === 'SELESAI' ? createdAt : null,
      completed_at: status === 'SELESAI' ? createdAt : null,
      created_at: createdAt,
      updated_at: createdAt,
      items,
      payment,
    };
    return { order, payment };
  };

  const pKatsu = products[0];
  const pMieGoreng = products[1];
  const pMieAyam = products[2];
  const pNasiGoreng = products[3];
  const pJusMangga = products[4];
  const pJusAlpukat = products[5];
  const pDimsum = products[9];
  const mTelur = modifiers[0];
  const mSambal = modifiers[2];

  const seedEntries = [
    // Yesterday completed orders for realistic report comparison
    buildSeedOrder(1, yesterday, 1440 + 180, 'Rudi Hartono', 'SELESAI', 'TUNAI', [
      { product: pKatsu, qty: 2 },
      { product: pJusMangga, qty: 2 },
    ]),
    buildSeedOrder(2, yesterday, 1440 + 140, 'Nadia Putri', 'SELESAI', 'QRIS', [
      { product: pMieGoreng, qty: 2, mods: [mTelur] },
      { product: pDimsum, qty: 1 },
      { product: pJusAlpukat, qty: 1 },
    ]),
    buildSeedOrder(3, yesterday, 1440 + 95, 'Fajar Nugroho', 'SELESAI', 'TRANSFER', [
      { product: pNasiGoreng, qty: 1 },
      { product: pKatsu, qty: 1 },
      { product: pJusMangga, qty: 1 },
    ]),
    // Today orders
    buildSeedOrder(1, today, 95, 'Andi Wijaya', 'SELESAI', 'TUNAI', [
      { product: pKatsu, qty: 1 },
      { product: pJusMangga, qty: 1 },
    ]),
    buildSeedOrder(2, today, 70, 'Rina Kusuma', 'SELESAI', 'QRIS', [
      { product: pMieGoreng, qty: 2, mods: [mTelur] },
      { product: pDimsum, qty: 1 },
    ]),
    buildSeedOrder(3, today, 45, 'Hendra Gunawan', 'SELESAI', 'E-WALLET', [
      { product: pKatsu, qty: 2, mods: [mSambal] },
      { product: pJusAlpukat, qty: 2 },
    ]),
    buildSeedOrder(4, today, 24, 'Maya Sari', 'DIPANGGIL', null, [
      { product: pDimsum, qty: 2 },
      { product: pJusMangga, qty: 1 },
    ]),
    buildSeedOrder(5, today, 16, 'Bagas Pratama', 'SIAP', null, [
      { product: pMieAyam, qty: 1, mods: [mTelur] },
      { product: pJusAlpukat, qty: 1 },
    ]),
    buildSeedOrder(6, today, 9, 'Citra Dewi', 'DIPROSES', null, [
      { product: pKatsu, qty: 1 },
      { product: pMieGoreng, qty: 1 },
      { product: pJusMangga, qty: 1 },
    ]),
    buildSeedOrder(7, today, 4, 'Dimas Saputra', 'MENUNGGU', null, [
      { product: pNasiGoreng, qty: 1, notes: 'Tidak pakai acar' },
      { product: pDimsum, qty: 1 },
    ]),
  ];

  const orders = seedEntries.map((e) => e.order);
  const payments = seedEntries.map((e) => e.payment).filter((p): p is Payment => p !== null);

  const inventoryTransactions: InventoryTransaction[] = [
    {
      id: 'inv-seed-1',
      product_id: pKatsu.id,
      product_name: pKatsu.name,
      user_id: adminId,
      user_name: 'Budi Santoso (Admin)',
      type: 'MASUK',
      quantity_change: 40,
      stock_before: 0,
      stock_after: 40,
      notes: 'Stok awal harian dapur',
      created_at: today + 'T07:00:00.000Z',
    },
    {
      id: 'inv-seed-2',
      product_id: pKatsu.id,
      product_name: pKatsu.name,
      user_id: kasirId,
      user_name: 'Siti Rahma (Kasir)',
      order_id: orders[3].id,
      type: 'KELUAR',
      quantity_change: -6,
      stock_before: 40,
      stock_after: 34,
      notes: 'Pengurangan otomatis pesanan selesai hari ini',
      created_at: today + 'T09:15:00.000Z',
    },
  ];

  const auditLogs: AuditLog[] = [
    {
      id: 'aud-seed-1',
      user_id: adminId,
      user_email: 'admin@warung.id',
      user_role: 'admin',
      action: 'INISIALISASI_SISTEM',
      entity: 'settings',
      entity_id: settings.id,
      metadata: { keterangan: 'Data awal warung dan menu siap digunakan' },
      created_at: today + 'T06:55:00.000Z',
    },
  ];

  return {
    users,
    categories,
    products,
    modifiers,
    orders,
    payments,
    inventoryTransactions,
    dailyQueues: {
      [yesterday]: { queue_date: yesterday, last_number: 3 },
      [today]: { queue_date: today, last_number: 7 },
    },
    settings,
    auditLogs,
  };
}

class WarungStore {
  private db: WarungDatabase;

  constructor() {
    this.db = this.loadOrInit();
  }

  private loadOrInit(): WarungDatabase {
    try {
      if (fs.existsSync(DB_FILE)) {
        const raw = fs.readFileSync(DB_FILE, 'utf-8');
        return JSON.parse(raw) as WarungDatabase;
      }
    } catch (err) {
      console.error('[WarungStore] Gagal membaca database lokal, membuat ulang seed:', err);
    }
    const seed = makeSeedDatabase();
    this.persist(seed);
    return seed;
  }

  private persist(data: WarungDatabase = this.db): void {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    const tmp = `${DB_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmp, DB_FILE);
  }

  private addAudit(
    actor: Pick<UserProfile, 'id' | 'email' | 'role'> | null,
    action: string,
    entity: string,
    entityId?: string,
    metadata: Record<string, unknown> = {},
  ): void {
    this.db.auditLogs.unshift({
      id: `aud-${crypto.randomUUID()}`,
      user_id: actor?.id ?? null,
      user_email: actor?.email ?? 'pelanggan@guest',
      user_role: actor?.role ?? 'pelanggan',
      action,
      entity,
      entity_id: entityId,
      metadata,
      created_at: new Date().toISOString(),
    });
    if (this.db.auditLogs.length > 500) {
      this.db.auditLogs = this.db.auditLogs.slice(0, 500);
    }
  }

  public getPublicSnapshot(): WarungStateSnapshot {
    return {
      categories: [...this.db.categories].sort((a, b) => a.sort_order - b.sort_order),
      products: [...this.db.products],
      modifiers: [...this.db.modifiers],
      orders: [...this.db.orders].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      payments: [...this.db.payments],
      inventoryTransactions: [...this.db.inventoryTransactions].sort((a, b) =>
        b.created_at.localeCompare(a.created_at),
      ),
      settings: { ...this.db.settings },
    };
  }

  public authenticate(email: string, password: string): UserProfile | null {
    const normalized = email.trim().toLowerCase();
    const user = this.db.users.find((u) => u.email.toLowerCase() === normalized && u.is_active);
    if (!user) return null;
    if (!verifyPassword(password, user.password_hash)) return null;
    const { password_hash: _, ...profile } = user;
    this.addAudit(profile, 'LOGIN', 'auth', profile.id, { email: profile.email });
    this.persist();
    return profile;
  }

  public getUserById(id: string): UserProfile | null {
    const user = this.db.users.find((u) => u.id === id && u.is_active);
    if (!user) return null;
    const { password_hash: _, ...profile } = user;
    return profile;
  }

  public listUsers(): UserProfile[] {
    return this.db.users.map(({ password_hash: _, ...profile }) => profile);
  }

  public createUser(
    actor: UserProfile,
    input: { email: string; full_name: string; role: UserRole; password: string; phone?: string },
  ): UserProfile {
    const email = input.email.trim().toLowerCase();
    if (!email || !input.full_name.trim() || !input.password || input.password.length < 6) {
      throw new Error('Data pengguna tidak valid. Password minimal 6 karakter.');
    }
    if (this.db.users.some((u) => u.email.toLowerCase() === email)) {
      throw new Error('Email sudah terdaftar.');
    }
    const newUser: StoredUser = {
      id: `usr-${crypto.randomUUID()}`,
      email,
      full_name: input.full_name.trim(),
      role: input.role,
      phone: input.phone?.trim(),
      is_active: true,
      password_hash: hashPassword(input.password),
      created_at: new Date().toISOString(),
    };
    this.db.users.push(newUser);
    const { password_hash: _, ...profile } = newUser;
    this.addAudit(actor, 'TAMBAH_PENGGUNA', 'profiles', newUser.id, { email, role: input.role });
    this.persist();
    return profile;
  }

  public updateUser(
    actor: UserProfile,
    id: string,
    updates: { full_name?: string; role?: UserRole; is_active?: boolean; phone?: string; password?: string },
  ): UserProfile {
    const user = this.db.users.find((u) => u.id === id);
    if (!user) throw new Error('Pengguna tidak ditemukan.');
    if (updates.full_name !== undefined) user.full_name = updates.full_name.trim();
    if (updates.role !== undefined) user.role = updates.role;
    if (updates.is_active !== undefined) user.is_active = updates.is_active;
    if (updates.phone !== undefined) user.phone = updates.phone.trim();
    if (updates.password && updates.password.length >= 6) {
      user.password_hash = hashPassword(updates.password);
    }
    const { password_hash: _, ...profile } = user;
    this.addAudit(actor, 'UBAH_PENGGUNA', 'profiles', id, { role: user.role, is_active: user.is_active });
    this.persist();
    return profile;
  }

  public listAuditLogs(): AuditLog[] {
    return [...this.db.auditLogs];
  }

  public logLogout(actor: UserProfile): void {
    this.addAudit(actor, 'LOGOUT', 'auth', actor.id, { email: actor.email });
    this.persist();
  }

  // CATEGORIES
  public createCategory(actor: UserProfile, input: { name: string; description?: string; sort_order?: number }): Category {
    const name = input.name.trim();
    if (!name) throw new Error('Nama kategori wajib diisi.');
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    if (this.db.categories.some((c) => c.slug === slug)) {
      throw new Error('Kategori sudah ada.');
    }
    const cat: Category = {
      id: `cat-${crypto.randomUUID()}`,
      name,
      slug,
      description: input.description?.trim() ?? '',
      sort_order: input.sort_order ?? this.db.categories.length + 1,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    this.db.categories.push(cat);
    this.addAudit(actor, 'TAMBAH_KATEGORI', 'categories', cat.id, { name });
    this.persist();
    return cat;
  }

  public updateCategory(actor: UserProfile, id: string, updates: Partial<Category>): Category {
    const cat = this.db.categories.find((c) => c.id === id);
    if (!cat) throw new Error('Kategori tidak ditemukan.');
    if (updates.name !== undefined && updates.name.trim()) {
      cat.name = updates.name.trim();
      cat.slug = cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    if (updates.description !== undefined) cat.description = updates.description;
    if (updates.sort_order !== undefined) cat.sort_order = Number(updates.sort_order);
    if (updates.is_active !== undefined) cat.is_active = Boolean(updates.is_active);
    this.addAudit(actor, 'UBAH_KATEGORI', 'categories', id, { name: cat.name });
    this.persist();
    return cat;
  }

  public deleteCategory(actor: UserProfile, id: string): void {
    if (this.db.products.some((p) => p.category_id === id)) {
      throw new Error('Kategori masih digunakan oleh menu. Nonaktifkan atau pindahkan menu terlebih dahulu.');
    }
    this.db.categories = this.db.categories.filter((c) => c.id !== id);
    this.addAudit(actor, 'HAPUS_KATEGORI', 'categories', id);
    this.persist();
  }

  // PRODUCTS
  public createProduct(
    actor: UserProfile,
    input: Omit<Product, 'id' | 'created_at' | 'updated_at'>,
  ): Product {
    if (!input.name.trim() || !input.sku.trim()) {
      throw new Error('Nama menu dan SKU wajib diisi.');
    }
    if (this.db.products.some((p) => p.sku.toLowerCase() === input.sku.trim().toLowerCase())) {
      throw new Error('SKU sudah digunakan oleh menu lain.');
    }
    const product: Product = {
      ...input,
      id: `prd-${crypto.randomUUID()}`,
      name: input.name.trim(),
      sku: input.sku.trim().toUpperCase(),
      cost_price: Math.max(0, Number(input.cost_price) || 0),
      sell_price: Math.max(0, Number(input.sell_price) || 0),
      stock: Math.max(0, Number(input.stock) || 0),
      min_stock: Math.max(0, Number(input.min_stock) || 0),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.db.products.push(product);
    if (product.stock > 0) {
      this.db.inventoryTransactions.unshift({
        id: `inv-${crypto.randomUUID()}`,
        product_id: product.id,
        product_name: product.name,
        user_id: actor.id,
        user_name: actor.full_name,
        type: 'MASUK',
        quantity_change: product.stock,
        stock_before: 0,
        stock_after: product.stock,
        notes: 'Stok awal menu baru',
        created_at: new Date().toISOString(),
      });
    }
    this.addAudit(actor, 'TAMBAH_MENU', 'products', product.id, { name: product.name, sell_price: product.sell_price });
    this.persist();
    return product;
  }

  public updateProduct(actor: UserProfile, id: string, updates: Partial<Product>): Product {
    const product = this.db.products.find((p) => p.id === id);
    if (!product) throw new Error('Menu tidak ditemukan.');
    if (updates.name !== undefined) product.name = updates.name.trim();
    if (updates.sku !== undefined) product.sku = updates.sku.trim().toUpperCase();
    if (updates.category_id !== undefined) product.category_id = updates.category_id;
    if (updates.description !== undefined) product.description = updates.description;
    if (updates.image_url !== undefined) product.image_url = updates.image_url;
    if (updates.cost_price !== undefined) product.cost_price = Math.max(0, Number(updates.cost_price));
    if (updates.sell_price !== undefined) product.sell_price = Math.max(0, Number(updates.sell_price));
    if (updates.unit !== undefined) product.unit = updates.unit;
    if (updates.min_stock !== undefined) product.min_stock = Math.max(0, Number(updates.min_stock));
    if (updates.is_active !== undefined) product.is_active = Boolean(updates.is_active);
    product.updated_at = new Date().toISOString();
    this.addAudit(actor, 'UBAH_MENU', 'products', id, { name: product.name, sell_price: product.sell_price });
    this.persist();
    return product;
  }

  public deleteProduct(actor: UserProfile, id: string): void {
    const product = this.db.products.find((p) => p.id === id);
    if (!product) throw new Error('Menu tidak ditemukan.');
    const usedInOrder = this.db.orders.some((o) => o.items.some((i) => i.product_id === id));
    if (usedInOrder) {
      product.is_active = false;
      product.updated_at = new Date().toISOString();
      this.addAudit(actor, 'NONAKTIF_MENU', 'products', id, { name: product.name });
    } else {
      this.db.products = this.db.products.filter((p) => p.id !== id);
      this.addAudit(actor, 'HAPUS_MENU', 'products', id, { name: product.name });
    }
    this.persist();
  }

  // MODIFIERS
  public upsertModifier(
    actor: UserProfile,
    input: { id?: string; name: string; price: number; modifier_group: string; is_active?: boolean },
  ): ProductModifier {
    if (!input.name.trim()) throw new Error('Nama tambahan wajib diisi.');
    if (input.id) {
      const existing = this.db.modifiers.find((m) => m.id === input.id);
      if (!existing) throw new Error('Tambahan tidak ditemukan.');
      existing.name = input.name.trim();
      existing.price = Math.max(0, Number(input.price) || 0);
      existing.modifier_group = input.modifier_group || 'tambahan';
      if (input.is_active !== undefined) existing.is_active = input.is_active;
      this.addAudit(actor, 'UBAH_MODIFIER', 'product_modifiers', existing.id, { name: existing.name, price: existing.price });
      this.persist();
      return existing;
    }
    const mod: ProductModifier = {
      id: `mod-${crypto.randomUUID()}`,
      name: input.name.trim(),
      price: Math.max(0, Number(input.price) || 0),
      modifier_group: input.modifier_group || 'tambahan',
      is_active: input.is_active ?? true,
    };
    this.db.modifiers.push(mod);
    this.addAudit(actor, 'TAMBAH_MODIFIER', 'product_modifiers', mod.id, { name: mod.name });
    this.persist();
    return mod;
  }

  // STOCK ADJUSTMENT
  public adjustStock(
    actor: UserProfile,
    input: { product_id: string; type: InventoryTxType; quantity: number; notes?: string },
  ): Product {
    const product = this.db.products.find((p) => p.id === input.product_id);
    if (!product) throw new Error('Menu tidak ditemukan.');
    const qty = Math.trunc(Number(input.quantity));
    if (Number.isNaN(qty)) throw new Error('Jumlah stok tidak valid.');

    const before = product.stock;
    let after = before;
    let delta = 0;

    if (input.type === 'MASUK') {
      if (qty <= 0) throw new Error('Jumlah stok masuk harus lebih dari 0.');
      after = before + qty;
      delta = qty;
    } else if (input.type === 'KELUAR') {
      if (qty <= 0) throw new Error('Jumlah stok keluar harus lebih dari 0.');
      if (before - qty < 0) throw new Error('Stok tidak boleh menjadi negatif.');
      after = before - qty;
      delta = -qty;
    } else {
      if (qty < 0) throw new Error('Stok hasil penyesuaian tidak boleh negatif.');
      after = qty;
      delta = qty - before;
    }

    product.stock = after;
    product.updated_at = new Date().toISOString();
    this.db.inventoryTransactions.unshift({
      id: `inv-${crypto.randomUUID()}`,
      product_id: product.id,
      product_name: product.name,
      user_id: actor.id,
      user_name: actor.full_name,
      type: input.type,
      quantity_change: delta,
      stock_before: before,
      stock_after: after,
      notes: input.notes?.trim() || `Penyesuaian ${input.type}`,
      created_at: new Date().toISOString(),
    });
    this.addAudit(actor, 'UBAH_STOK', 'products', product.id, {
      product_name: product.name,
      type: input.type,
      before,
      after,
    });
    this.persist();
    return product;
  }

  private deductOrderStock(order: Order, actor: Pick<UserProfile, 'id' | 'full_name'> | null): void {
    if (order.stock_deducted) return;
    // Validate first so stock never goes negative
    for (const item of order.items) {
      const product = this.db.products.find((p) => p.id === item.product_id);
      if (product && product.stock < item.quantity) {
        throw new Error(`Stok menu "${product.name}" tidak mencukupi (sisa ${product.stock}).`);
      }
    }
    for (const item of order.items) {
      const product = this.db.products.find((p) => p.id === item.product_id);
      if (!product) continue;
      const before = product.stock;
      const after = before - item.quantity;
      product.stock = after;
      product.updated_at = new Date().toISOString();
      this.db.inventoryTransactions.unshift({
        id: `inv-${crypto.randomUUID()}`,
        product_id: product.id,
        product_name: product.name,
        user_id: actor?.id ?? null,
        user_name: actor?.full_name ?? 'Sistem Otomatis',
        order_id: order.id,
        type: 'KELUAR',
        quantity_change: -item.quantity,
        stock_before: before,
        stock_after: after,
        notes: `Pesanan ${order.queue_code} (${order.order_number})`,
        created_at: new Date().toISOString(),
      });
    }
    order.stock_deducted = true;
  }

  private restoreOrderStock(order: Order, actor: Pick<UserProfile, 'id' | 'full_name'> | null): void {
    if (!order.stock_deducted) return;
    for (const item of order.items) {
      const product = this.db.products.find((p) => p.id === item.product_id);
      if (!product) continue;
      const before = product.stock;
      const after = before + item.quantity;
      product.stock = after;
      product.updated_at = new Date().toISOString();
      this.db.inventoryTransactions.unshift({
        id: `inv-${crypto.randomUUID()}`,
        product_id: product.id,
        product_name: product.name,
        user_id: actor?.id ?? null,
        user_name: actor?.full_name ?? 'Sistem Otomatis',
        order_id: order.id,
        type: 'MASUK',
        quantity_change: item.quantity,
        stock_before: before,
        stock_after: after,
        notes: `Pengembalian stok pembatalan ${order.queue_code}`,
        created_at: new Date().toISOString(),
      });
    }
    order.stock_deducted = false;
  }

  // ATOMIC ORDER + QUEUE NUMBER CREATION
  public createOrder(
    actor: UserProfile | null,
    input: {
      customer_name: string;
      notes?: string;
      discount?: number;
      client_request_id?: string;
      items: { product_id: string; quantity: number; modifier_ids?: string[]; notes?: string }[];
    },
  ): { order: Order; deduplicated: boolean } {
    if (input.client_request_id) {
      const existing = this.db.orders.find((o) => o.client_request_id === input.client_request_id);
      if (existing) {
        return { order: existing, deduplicated: true };
      }
    }

    if (!Array.isArray(input.items) || input.items.length === 0) {
      throw new Error('Pesanan harus berisi minimal 1 menu.');
    }

    // Aggregate quantities per product to verify available stock
    const qtyByProduct = new Map<string, number>();
    for (const line of input.items) {
      const qty = Math.trunc(Number(line.quantity));
      if (!qty || qty <= 0) throw new Error('Jumlah item harus lebih dari 0.');
      qtyByProduct.set(line.product_id, (qtyByProduct.get(line.product_id) ?? 0) + qty);
    }

    for (const [productId, totalQty] of qtyByProduct.entries()) {
      const product = this.db.products.find((p) => p.id === productId);
      if (!product || !product.is_active) {
        throw new Error('Salah satu menu yang dipilih tidak tersedia atau sudah nonaktif.');
      }
      if (product.stock <= 0) {
        throw new Error(`Menu "${product.name}" sedang habis.`);
      }
      if (product.stock < totalQty) {
        throw new Error(`Stok "${product.name}" hanya tersisa ${product.stock} ${product.unit}.`);
      }
    }

    // Generate atomic daily queue number
    const today = getJakartaDateString();
    const currentCounter = this.db.dailyQueues[today]?.last_number ?? 0;
    const nextNumber = currentCounter + 1;
    this.db.dailyQueues[today] = { queue_date: today, last_number: nextNumber };

    const prefix = this.db.settings.queue_prefix || 'A';
    const padding = this.db.settings.queue_padding || 3;
    const queueCode = `${prefix}${String(nextNumber).padStart(padding, '0')}`;
    const orderId = `ord-${crypto.randomUUID()}`;
    const nowIso = new Date().toISOString();

    const orderItems: OrderItem[] = input.items.map((line, idx) => {
      const product = this.db.products.find((p) => p.id === line.product_id)!;
      const qty = Math.trunc(Number(line.quantity));
      const selectedMods = (line.modifier_ids ?? [])
        .map((mid) => this.db.modifiers.find((m) => m.id === mid && m.is_active))
        .filter((m): m is ProductModifier => Boolean(m))
        .map((m) => ({ id: m.id, name: m.name, price: m.price }));

      const modsTotal = selectedMods.reduce((s, m) => s + m.price, 0);
      const lineTotal = (product.sell_price + modsTotal) * qty;

      return {
        id: `${orderId}-item-${idx + 1}`,
        order_id: orderId,
        product_id: product.id,
        product_name: product.name,
        quantity: qty,
        unit_price: product.sell_price,
        cost_price: product.cost_price,
        modifiers: selectedMods,
        modifiers_total: modsTotal,
        line_total: lineTotal,
        notes: line.notes?.trim() || undefined,
      };
    });

    const subtotal = orderItems.reduce((sum, i) => sum + i.line_total, 0);
    const discount = Math.min(subtotal, Math.max(0, Math.trunc(Number(input.discount) || 0)));
    const total = subtotal - discount;

    const order: Order = {
      id: orderId,
      order_number: `TRX-${today.replace(/-/g, '')}-${String(nextNumber).padStart(3, '0')}`,
      queue_number: nextNumber,
      queue_code: queueCode,
      queue_date: today,
      customer_id: actor?.role === 'pelanggan' ? actor.id : null,
      customer_name: input.customer_name.trim() || actor?.full_name || 'Pelanggan',
      cashier_id: actor && (actor.role === 'kasir' || actor.role === 'admin') ? actor.id : null,
      cashier_name: actor && (actor.role === 'kasir' || actor.role === 'admin') ? actor.full_name : null,
      status: 'MENUNGGU',
      payment_status: 'BELUM BAYAR',
      subtotal,
      discount,
      total,
      notes: input.notes?.trim() || undefined,
      client_request_id: input.client_request_id,
      stock_deducted: false,
      call_count: 0,
      called_at: null,
      completed_at: null,
      created_at: nowIso,
      updated_at: nowIso,
      items: orderItems,
      payment: null,
    };

    if (this.db.settings.auto_deduct_stock_on === 'KONFIRMASI') {
      this.deductOrderStock(order, actor);
    }

    this.db.orders.unshift(order);
    this.addAudit(actor, 'BUAT_PESANAN', 'orders', order.id, {
      queue_code: order.queue_code,
      total: order.total,
      items_count: order.items.length,
    });
    this.persist();
    return { order, deduplicated: false };
  }

  public updateOrderStatus(actor: UserProfile, orderId: string, nextStatus: QueueStatus): Order {
    const order = this.db.orders.find((o) => o.id === orderId);
    if (!order) throw new Error('Pesanan tidak ditemukan.');

    if (order.status === 'SELESAI' && actor.role !== 'admin') {
      throw new Error('Transaksi yang sudah selesai tidak dapat diubah.');
    }

    // Role permission guard
    if (actor.role === 'dapur' && !['DIPROSES', 'SIAP'].includes(nextStatus)) {
      throw new Error('Dapur hanya dapat mengubah status ke DIPROSES atau SIAP.');
    }

    if (nextStatus === 'DIPANGGIL') {
      // Move any previous DIPANGGIL today to DIPROSES if not completed so TV shows latest active call cleanly
      order.call_count += 1;
      order.called_at = new Date().toISOString();
    }

    if (nextStatus === 'SELESAI') {
      if (this.db.settings.auto_deduct_stock_on === 'SELESAI') {
        this.deductOrderStock(order, actor);
      }
      order.completed_at = new Date().toISOString();
    }

    if (nextStatus === 'DIBATALKAN') {
      this.restoreOrderStock(order, actor);
      if (order.payment_status !== 'SUDAH BAYAR') {
        order.payment_status = 'DIBATALKAN';
      }
    }

    order.status = nextStatus;
    order.updated_at = new Date().toISOString();
    this.addAudit(actor, 'UBAH_STATUS_ANTREAN', 'orders', order.id, {
      queue_code: order.queue_code,
      status: nextStatus,
    });
    this.persist();
    return order;
  }

  public callNextQueue(actor: UserProfile): Order {
    const today = getJakartaDateString();
    const candidates = this.db.orders
      .filter((o) => o.queue_date === today && (o.status === 'SIAP' || o.status === 'MENUNGGU'))
      .sort((a, b) => {
        // Prioritize SIAP orders first, then MENUNGGU, in queue_number order
        if (a.status !== b.status) return a.status === 'SIAP' ? -1 : 1;
        return a.queue_number - b.queue_number;
      });
    if (candidates.length === 0) {
      throw new Error('Tidak ada antrean menunggu atau siap panggil saat ini.');
    }
    return this.updateOrderStatus(actor, candidates[0].id, 'DIPANGGIL');
  }

  public processPayment(
    actor: UserProfile,
    input: {
      order_id: string;
      method: PaymentMethod;
      amount_paid: number;
      discount?: number;
      reference_no?: string;
    },
  ): { order: Order; payment: Payment } {
    const order = this.db.orders.find((o) => o.id === input.order_id);
    if (!order) throw new Error('Pesanan tidak ditemukan.');
    if (order.status === 'DIBATALKAN') {
      throw new Error('Pesanan yang dibatalkan tidak dapat dibayar.');
    }
    if (order.payment_status === 'SUDAH BAYAR') {
      throw new Error('Pesanan ini sudah lunas dibayar.');
    }

    if (input.discount !== undefined) {
      const disc = Math.min(order.subtotal, Math.max(0, Math.trunc(Number(input.discount) || 0)));
      order.discount = disc;
      order.total = order.subtotal - disc;
    }

    const paid = Math.trunc(Number(input.amount_paid) || 0);
    if (input.method === 'TUNAI' && paid < order.total) {
      throw new Error(`Uang tunai kurang dari total tagihan (Rp${order.total.toLocaleString('id-ID')}).`);
    }

    const finalPaid = input.method === 'TUNAI' ? paid : order.total;
    const change = input.method === 'TUNAI' ? finalPaid - order.total : 0;

    const payment: Payment = {
      id: `pay-${crypto.randomUUID()}`,
      order_id: order.id,
      cashier_id: actor.id,
      cashier_name: actor.full_name,
      method: input.method,
      status: 'SUDAH BAYAR',
      amount_due: order.total,
      amount_paid: finalPaid,
      change_amount: change,
      reference_no: input.reference_no?.trim() || (input.method !== 'TUNAI' ? `PAY-${Date.now().toString().slice(-6)}` : undefined),
      paid_at: new Date().toISOString(),
    };

    order.payment_status = 'SUDAH BAYAR';
    order.payment = payment;
    order.cashier_id = actor.id;
    order.cashier_name = actor.full_name;

    // Deduct stock if configured on KONFIRMASI or complete if already SIAP/DIPANGGIL
    if (this.db.settings.auto_deduct_stock_on === 'SELESAI' && order.status === 'DIPANGGIL') {
      this.deductOrderStock(order, actor);
      order.status = 'SELESAI';
      order.completed_at = new Date().toISOString();
    } else if (order.status === 'SIAP' || order.status === 'SELESAI') {
      this.deductOrderStock(order, actor);
      order.status = 'SELESAI';
      order.completed_at = new Date().toISOString();
    }

    order.updated_at = new Date().toISOString();
    this.db.payments.unshift(payment);
    this.addAudit(actor, 'PROSES_PEMBAYARAN', 'payments', payment.id, {
      order_id: order.id,
      queue_code: order.queue_code,
      method: payment.method,
      total: order.total,
    });
    this.persist();
    return { order, payment };
  }

  public updateSettings(actor: UserProfile, updates: Partial<WarungSettings>): WarungSettings {
    if (updates.warung_name !== undefined && updates.warung_name.trim()) {
      this.db.settings.warung_name = updates.warung_name.trim();
    }
    if (updates.warung_address !== undefined) this.db.settings.warung_address = updates.warung_address.trim();
    if (updates.warung_phone !== undefined) this.db.settings.warung_phone = updates.warung_phone.trim();
    if (updates.queue_prefix !== undefined && updates.queue_prefix.trim()) {
      this.db.settings.queue_prefix = updates.queue_prefix.trim().toUpperCase().slice(0, 3);
    }
    if (updates.queue_padding !== undefined) {
      this.db.settings.queue_padding = Math.min(5, Math.max(2, Number(updates.queue_padding)));
    }
    if (updates.auto_deduct_stock_on !== undefined) {
      this.db.settings.auto_deduct_stock_on = updates.auto_deduct_stock_on;
    }
    if (updates.estimated_minutes_per_order !== undefined) {
      this.db.settings.estimated_minutes_per_order = Math.max(1, Number(updates.estimated_minutes_per_order));
    }
    if (updates.receipt_footer !== undefined) {
      this.db.settings.receipt_footer = updates.receipt_footer.trim();
    }
    this.db.settings.updated_at = new Date().toISOString();
    this.addAudit(actor, 'UBAH_PENGATURAN', 'settings', this.db.settings.id, {
      queue_prefix: this.db.settings.queue_prefix,
      auto_deduct_stock_on: this.db.settings.auto_deduct_stock_on,
    });
    this.persist();
    return { ...this.db.settings };
  }
}

export const warungStore = new WarungStore();
