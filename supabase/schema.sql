-- ============================================================================
-- ANTRIAN WARUNG — SUPABASE POSTGRESQL SCHEMA, RLS, FUNCTIONS & SEED DATA
-- ============================================================================
-- Dapat dijalankan langsung dari database Supabase kosong melalui SQL Editor.
-- Urutan: Extensions -> Tables -> Indexes -> Triggers -> Functions -> RLS -> Realtime -> Storage -> Seed Data
-- ============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. ENUM / CHECK TYPES (menggunakan TEXT + CHECK agar fleksibel & mudah dimigrasi)

-- 3. TABLES

-- 3.1 Profiles (terhubung dengan auth.users Supabase)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'pelanggan' CHECK (role IN ('admin', 'kasir', 'dapur', 'pelanggan')),
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.2 Categories
CREATE TABLE IF NOT EXISTS public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.3 Products
CREATE TABLE IF NOT EXISTS public.products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.categories(id) ON DELETE RESTRICT,
  sku TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  cost_price INTEGER NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  sell_price INTEGER NOT NULL CHECK (sell_price >= 0),
  unit TEXT NOT NULL DEFAULT 'porsi',
  stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
  min_stock INTEGER NOT NULL DEFAULT 5 CHECK (min_stock >= 0),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.4 Product Modifiers (Tambahan)
CREATE TABLE IF NOT EXISTS public.product_modifiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  price INTEGER NOT NULL DEFAULT 0 CHECK (price >= 0),
  modifier_group TEXT NOT NULL DEFAULT 'tambahan',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.5 Settings (Konfigurasi Warung)
CREATE TABLE IF NOT EXISTS public.settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  warung_name TEXT NOT NULL DEFAULT 'Warung Nusantara',
  warung_address TEXT NOT NULL DEFAULT 'Jl. Merdeka No. 45, Bandung',
  warung_phone TEXT NOT NULL DEFAULT '0812-3456-7890',
  queue_prefix TEXT NOT NULL DEFAULT 'A',
  queue_padding INTEGER NOT NULL DEFAULT 3 CHECK (queue_padding BETWEEN 2 AND 5),
  auto_deduct_stock_on TEXT NOT NULL DEFAULT 'SELESAI' CHECK (auto_deduct_stock_on IN ('KONFIRMASI', 'SELESAI')),
  estimated_minutes_per_order INTEGER NOT NULL DEFAULT 5 CHECK (estimated_minutes_per_order >= 1),
  receipt_footer TEXT NOT NULL DEFAULT 'Terima kasih telah berkunjung! Selamat menikmati hidangan.',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.6 Daily Queue Counter (Atomik per tanggal untuk mencegah race condition & duplikasi)
CREATE TABLE IF NOT EXISTS public.daily_queue (
  queue_date DATE PRIMARY KEY DEFAULT CURRENT_DATE,
  prefix TEXT NOT NULL DEFAULT 'A',
  last_number INTEGER NOT NULL DEFAULT 0 CHECK (last_number >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.7 Orders
CREATE TABLE IF NOT EXISTS public.orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number TEXT NOT NULL UNIQUE,
  queue_code TEXT NOT NULL,
  queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  customer_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL DEFAULT 'Pelanggan',
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DIPANGGIL', 'DIPROSES', 'SIAP', 'SELESAI', 'DIBATALKAN')),
  payment_status TEXT NOT NULL DEFAULT 'BELUM BAYAR' CHECK (payment_status IN ('BELUM BAYAR', 'SUDAH BAYAR', 'DIBATALKAN')),
  subtotal INTEGER NOT NULL DEFAULT 0 CHECK (subtotal >= 0),
  discount INTEGER NOT NULL DEFAULT 0 CHECK (discount >= 0),
  total INTEGER NOT NULL DEFAULT 0 CHECK (total >= 0),
  notes TEXT,
  client_request_id TEXT UNIQUE,
  stock_deducted BOOLEAN NOT NULL DEFAULT false,
  called_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_queue_code UNIQUE (queue_date, queue_code)
);

-- 3.8 Order Items (menyimpan snapshot harga agar histori akurat jika harga menu berubah)
CREATE TABLE IF NOT EXISTS public.order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name TEXT NOT NULL,
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
  cost_price INTEGER NOT NULL DEFAULT 0 CHECK (cost_price >= 0),
  modifiers_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  modifiers_total INTEGER NOT NULL DEFAULT 0 CHECK (modifiers_total >= 0),
  line_total INTEGER NOT NULL CHECK (line_total >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.9 Queue Numbers (histori panggilan & status antrean realtime)
CREATE TABLE IF NOT EXISTS public.queue_numbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL UNIQUE REFERENCES public.orders(id) ON DELETE CASCADE,
  queue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  queue_number INTEGER NOT NULL,
  queue_code TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'MENUNGGU' CHECK (status IN ('MENUNGGU', 'DIPANGGIL', 'DIPROSES', 'SIAP', 'SELESAI', 'DIBATALKAN')),
  call_count INTEGER NOT NULL DEFAULT 0,
  last_called_at TIMESTAMPTZ,
  called_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_queue_date_number UNIQUE (queue_date, queue_number)
);

-- 3.10 Payments
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  cashier_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  method TEXT NOT NULL CHECK (method IN ('TUNAI', 'QRIS', 'TRANSFER', 'E-WALLET')),
  status TEXT NOT NULL DEFAULT 'SUDAH BAYAR' CHECK (status IN ('BELUM BAYAR', 'SUDAH BAYAR', 'DIBATALKAN')),
  amount_due INTEGER NOT NULL CHECK (amount_due >= 0),
  amount_paid INTEGER NOT NULL CHECK (amount_paid >= 0),
  change_amount INTEGER NOT NULL DEFAULT 0 CHECK (change_amount >= 0),
  reference_no TEXT,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.11 Inventory Transactions
CREATE TABLE IF NOT EXISTS public.inventory_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
  type TEXT NOT NULL CHECK (type IN ('MASUK', 'KELUAR', 'PENYESUAIAN')),
  quantity_change INTEGER NOT NULL,
  stock_before INTEGER NOT NULL CHECK (stock_before >= 0),
  stock_after INTEGER NOT NULL CHECK (stock_after >= 0),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3.12 Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  user_email TEXT,
  user_role TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_products_category ON public.products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_active ON public.products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_queue_date ON public.orders(queue_date, status);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_customer ON public.orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON public.order_items(product_id);
CREATE INDEX IF NOT EXISTS idx_queue_numbers_date_status ON public.queue_numbers(queue_date, status, queue_number);
CREATE INDEX IF NOT EXISTS idx_payments_order ON public.payments(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_product ON public.inventory_transactions(product_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- 5. UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE
  t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'profiles', 'categories', 'products', 'product_modifiers',
    'settings', 'daily_queue', 'orders', 'order_items',
    'queue_numbers', 'payments', 'inventory_transactions', 'audit_logs'
  ]
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS trg_%I_updated_at ON public.%I', t, t);
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;

-- 6. ATOMIC QUEUE NUMBER GENERATOR (Anti Race-Condition)
CREATE OR REPLACE FUNCTION public.generate_daily_queue_number()
RETURNS TABLE(queue_date DATE, queue_number INTEGER, queue_code TEXT) AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_prefix TEXT := 'A';
  v_padding INTEGER := 3;
  v_next INTEGER;
BEGIN
  SELECT queue_prefix, queue_padding INTO v_prefix, v_padding
  FROM public.settings
  ORDER BY created_at ASC
  LIMIT 1;

  v_prefix := COALESCE(v_prefix, 'A');
  v_padding := COALESCE(v_padding, 3);

  INSERT INTO public.daily_queue (queue_date, prefix, last_number)
  VALUES (v_today, v_prefix, 1)
  ON CONFLICT (queue_date)
  DO UPDATE SET
    last_number = public.daily_queue.last_number + 1,
    prefix = EXCLUDED.prefix,
    updated_at = now()
  RETURNING public.daily_queue.last_number INTO v_next;

  RETURN QUERY SELECT
    v_today,
    v_next,
    v_prefix || LPAD(v_next::TEXT, v_padding, '0');
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. HELPER ROLE CHECK FOR RLS
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- 8. ROW LEVEL SECURITY (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.queue_numbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Profiles policies
CREATE POLICY "profiles_select_self_or_staff" ON public.profiles
  FOR SELECT USING (
    auth.uid() = id OR public.current_user_role() IN ('admin', 'kasir')
  );
CREATE POLICY "profiles_admin_all" ON public.profiles
  FOR ALL USING (public.current_user_role() = 'admin');

-- Categories & Products & Modifiers (publik dapat melihat menu aktif, admin kelola penuh)
CREATE POLICY "categories_read_active" ON public.categories
  FOR SELECT USING (is_active = true OR public.current_user_role() IN ('admin', 'kasir', 'dapur'));
CREATE POLICY "categories_admin_write" ON public.categories
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "products_read_active" ON public.products
  FOR SELECT USING (is_active = true OR public.current_user_role() IN ('admin', 'kasir', 'dapur'));
CREATE POLICY "products_admin_write" ON public.products
  FOR ALL USING (public.current_user_role() = 'admin');

CREATE POLICY "modifiers_read_active" ON public.product_modifiers
  FOR SELECT USING (is_active = true OR public.current_user_role() IN ('admin', 'kasir'));
CREATE POLICY "modifiers_admin_write" ON public.product_modifiers
  FOR ALL USING (public.current_user_role() = 'admin');

-- Settings
CREATE POLICY "settings_read" ON public.settings
  FOR SELECT USING (true);
CREATE POLICY "settings_admin_write" ON public.settings
  FOR ALL USING (public.current_user_role() = 'admin');

-- Orders & Order Items
CREATE POLICY "orders_select_policy" ON public.orders
  FOR SELECT USING (
    public.current_user_role() IN ('admin', 'kasir', 'dapur')
    OR customer_id = auth.uid()
  );
CREATE POLICY "orders_insert_policy" ON public.orders
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('admin', 'kasir', 'pelanggan')
    AND (customer_id IS NULL OR customer_id = auth.uid() OR public.current_user_role() IN ('admin', 'kasir'))
  );
CREATE POLICY "orders_update_staff" ON public.orders
  FOR UPDATE USING (
    public.current_user_role() IN ('admin', 'kasir', 'dapur')
  );

CREATE POLICY "order_items_select" ON public.order_items
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.orders o
      WHERE o.id = order_id
      AND (public.current_user_role() IN ('admin', 'kasir', 'dapur') OR o.customer_id = auth.uid())
    )
  );
CREATE POLICY "order_items_insert" ON public.order_items
  FOR INSERT WITH CHECK (
    public.current_user_role() IN ('admin', 'kasir', 'pelanggan')
  );

-- Queue Numbers (display TV & pelanggan dapat melihat nomor antrean hari ini)
CREATE POLICY "queue_numbers_read_today" ON public.queue_numbers
  FOR SELECT USING (queue_date = CURRENT_DATE OR public.current_user_role() IN ('admin', 'kasir', 'dapur'));
CREATE POLICY "queue_numbers_staff_write" ON public.queue_numbers
  FOR ALL USING (public.current_user_role() IN ('admin', 'kasir', 'dapur'));

-- Payments
CREATE POLICY "payments_select" ON public.payments
  FOR SELECT USING (
    public.current_user_role() IN ('admin', 'kasir')
    OR EXISTS (SELECT 1 FROM public.orders o WHERE o.id = order_id AND o.customer_id = auth.uid())
  );
CREATE POLICY "payments_staff_write" ON public.payments
  FOR ALL USING (public.current_user_role() IN ('admin', 'kasir'));

-- Inventory & Audit Logs
CREATE POLICY "inventory_staff_read" ON public.inventory_transactions
  FOR SELECT USING (public.current_user_role() IN ('admin', 'kasir'));
CREATE POLICY "inventory_admin_write" ON public.inventory_transactions
  FOR INSERT WITH CHECK (public.current_user_role() IN ('admin', 'kasir'));

CREATE POLICY "audit_admin_read" ON public.audit_logs
  FOR SELECT USING (public.current_user_role() = 'admin');
CREATE POLICY "audit_insert_auth" ON public.audit_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- 9. SUPABASE REALTIME PUBLICATION
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.queue_numbers;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
  ALTER PUBLICATION supabase_realtime ADD TABLE public.payments;
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- 10. STORAGE BUCKET UNTUK FOTO MENU
INSERT INTO storage.buckets (id, name, public)
VALUES ('menu-images', 'menu-images', true)
ON CONFLICT (id) DO NOTHING;

-- 11. SEED DATA (Setelah seluruh CREATE TABLE selesai)
INSERT INTO public.settings (
  warung_name, warung_address, warung_phone,
  queue_prefix, queue_padding, auto_deduct_stock_on, estimated_minutes_per_order
)
SELECT
  'Warung Nusantara',
  'Jl. Merdeka No. 45, Bandung',
  '0812-3456-7890',
  'A', 3, 'SELESAI', 5
WHERE NOT EXISTS (SELECT 1 FROM public.settings);

INSERT INTO public.categories (name, slug, description, sort_order) VALUES
  ('Makanan', 'makanan', 'Hidangan utama nasi dan mie hangat', 1),
  ('Minuman', 'minuman', 'Aneka jus buah segar dan minuman dingin', 2),
  ('Snack', 'snack', 'Camilan hangat dan pendamping', 3),
  ('Paket', 'paket', 'Paket hemat makanan dan minuman', 4),
  ('Tambahan', 'tambahan', 'Menu pelengkap seperti telur dan sambal', 5)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.product_modifiers (name, price, modifier_group) VALUES
  ('Telur', 4000, 'topping'),
  ('Keju', 4000, 'topping'),
  ('Sambal', 2000, 'tambahan'),
  ('Extra Saus', 2000, 'tambahan'),
  ('Extra Mie', 5000, 'porsi'),
  ('Es', 1000, 'minuman'),
  ('Level Pedas (Sedang)', 0, 'level'),
  ('Level Pedas (Pedas)', 0, 'level'),
  ('Level Pedas (Ekstra Pedas)', 0, 'level')
ON CONFLICT (name) DO NOTHING;

INSERT INTO public.products (category_id, sku, name, description, cost_price, sell_price, unit, stock, min_stock)
SELECT c.id, v.sku, v.name, v.description, v.cost_price, v.sell_price, v.unit, v.stock, v.min_stock
FROM (VALUES
  ('minuman', 'MIN-001', 'Jus Mangga', 'Jus buah mangga harum manis segar tanpa pemanis buatan', 5000, 10000, 'gelas', 45, 8),
  ('minuman', 'MIN-002', 'Jus Alpukat', 'Jus alpukat mentega kental dengan susu cokelat', 5500, 10000, 'gelas', 38, 8),
  ('minuman', 'MIN-003', 'Jus Jambu', 'Jus jambu merah segar kaya vitamin C', 4500, 10000, 'gelas', 32, 8),
  ('minuman', 'MIN-004', 'Jus Stroberi', 'Jus stroberi segar manis asam menyegarkan', 5500, 10000, 'gelas', 24, 6),
  ('minuman', 'MIN-005', 'Jus Sirsak', 'Jus sirsak segar dingin alami', 4500, 10000, 'gelas', 28, 6),
  ('makanan', 'MAK-001', 'Nasi Ayam Katsu', 'Nasi putih hangat dengan ayam katsu renyah, salad kol, dan saus spesial', 13000, 22000, 'porsi', 35, 10),
  ('makanan', 'MAK-002', 'Mie Goreng', 'Mie goreng tek-tek spesial dengan sawi, acar, dan bawang goreng', 8500, 15000, 'porsi', 40, 10),
  ('makanan', 'MAK-003', 'Mie Ayam', 'Mie ayam klasik dengan topping ayam kecap gurih dan pangsit', 9500, 16000, 'porsi', 30, 8),
  ('snack',   'SNK-001', 'Dimsum', 'Dimsum ayam udang kukus isi 4 pcs dengan chili oil', 8500, 15000, 'porsi', 25, 8),
  ('makanan', 'MAK-004', 'Nasi Goreng', 'Nasi goreng kampung bumbu rempah dengan suwiran ayam dan kerupuk', 10000, 18000, 'porsi', 34, 8),
  ('tambahan', 'TMB-001', 'Telur', 'Telur goreng dadar atau ceplok hangat', 2500, 5000, 'butir', 50, 12),
  ('tambahan', 'TMB-002', 'Sambal', 'Sambal bawang atau sambal terasi segar ulek dadakan', 1000, 3000, 'porsi', 60, 15),
  ('paket',   'PKT-001', 'Paket Katsu + Jus Mangga', 'Paket hemat Nasi Ayam Katsu lengkap dengan Jus Mangga segar', 17500, 29000, 'paket', 20, 5)
) AS v(cat_slug, sku, name, description, cost_price, sell_price, unit, stock, min_stock)
JOIN public.categories c ON c.slug = v.cat_slug
ON CONFLICT (sku) DO NOTHING;
