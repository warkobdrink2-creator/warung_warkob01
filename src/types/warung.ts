export type UserRole = 'admin' | 'kasir' | 'dapur' | 'pelanggan';

export type QueueStatus =
  | 'MENUNGGU'
  | 'DIPANGGIL'
  | 'DIPROSES'
  | 'SIAP'
  | 'SELESAI'
  | 'DIBATALKAN';

export type PaymentMethod = 'TUNAI' | 'QRIS' | 'TRANSFER' | 'E-WALLET';
export type PaymentStatus = 'BELUM BAYAR' | 'SUDAH BAYAR' | 'DIBATALKAN';
export type InventoryTxType = 'MASUK' | 'KELUAR' | 'PENYESUAIAN';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  is_active: boolean;
  created_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  description?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  category_id: string;
  sku: string;
  name: string;
  description?: string;
  image_url?: string;
  cost_price: number;
  sell_price: number;
  unit: string;
  stock: number;
  min_stock: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductModifier {
  id: string;
  name: string;
  price: number;
  modifier_group: string;
  is_active: boolean;
}

export interface OrderItemModifier {
  id: string;
  name: string;
  price: number;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  cost_price: number;
  modifiers: OrderItemModifier[];
  modifiers_total: number;
  line_total: number;
  notes?: string;
}

export interface Order {
  id: string;
  order_number: string;
  queue_number: number;
  queue_code: string;
  queue_date: string;
  customer_id?: string | null;
  customer_name: string;
  cashier_id?: string | null;
  cashier_name?: string | null;
  status: QueueStatus;
  payment_status: PaymentStatus;
  subtotal: number;
  discount: number;
  total: number;
  notes?: string;
  client_request_id?: string;
  stock_deducted: boolean;
  call_count: number;
  called_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payment?: Payment | null;
}

export interface Payment {
  id: string;
  order_id: string;
  cashier_id?: string | null;
  cashier_name?: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount_due: number;
  amount_paid: number;
  change_amount: number;
  reference_no?: string;
  paid_at: string;
}

export interface InventoryTransaction {
  id: string;
  product_id: string;
  product_name: string;
  user_id?: string | null;
  user_name?: string;
  order_id?: string | null;
  type: InventoryTxType;
  quantity_change: number;
  stock_before: number;
  stock_after: number;
  notes?: string;
  created_at: string;
}

export interface WarungSettings {
  id: string;
  warung_name: string;
  warung_address: string;
  warung_phone: string;
  queue_prefix: string;
  queue_padding: number;
  auto_deduct_stock_on: 'KONFIRMASI' | 'SELESAI';
  estimated_minutes_per_order: number;
  receipt_footer: string;
  updated_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string | null;
  user_email?: string;
  user_role?: string;
  action: string;
  entity: string;
  entity_id?: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WarungStateSnapshot {
  categories: Category[];
  products: Product[];
  modifiers: ProductModifier[];
  orders: Order[];
  payments: Payment[];
  inventoryTransactions: InventoryTransaction[];
  settings: WarungSettings;
}

export interface CartItemInput {
  tempId: string;
  product: Product;
  quantity: number;
  modifiers: OrderItemModifier[];
  notes?: string;
}

export interface OfflinePendingOrder {
  client_request_id: string;
  customer_name: string;
  notes?: string;
  items: {
    product_id: string;
    quantity: number;
    modifier_ids: string[];
    notes?: string;
  }[];
  created_at: string;
}
