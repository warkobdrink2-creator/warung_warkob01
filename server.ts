import crypto from 'node:crypto';
import http from 'node:http';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { warungStore } from './src/server/store.ts';
import type { UserProfile, UserRole } from './src/types/warung.ts';

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'antrian-warung-dev-secret-key';

interface AuthenticatedRequest extends Request {
  user?: UserProfile | null;
}

function signToken(payload: { id: string; role: UserRole; exp: number }): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyToken(token: string): UserProfile | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [data, sig] = parts;
    const expectedSig = crypto.createHmac('sha256', SESSION_SECRET).update(data).digest('base64url');
    if (sig.length !== expectedSig.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return null;
    const decoded = JSON.parse(Buffer.from(data, 'base64url').toString('utf-8')) as {
      id: string;
      role: UserRole;
      exp: number;
    };
    if (Date.now() > decoded.exp) return null;
    // Always fetch authoritative user & role from store (never trust client role!)
    return warungStore.getUserById(decoded.id);
  } catch {
    return null;
  }
}

function attachUser(req: AuthenticatedRequest, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7).trim();
    req.user = verifyToken(token);
  } else {
    req.user = null;
  }
  next();
}

function requireRole(roles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Session Anda telah berakhir. Silakan login kembali.' });
      return;
    }
    if (!roles.includes(req.user.role)) {
      res.status(403).json({ error: 'Anda tidak memiliki izin untuk melakukan tindakan ini.' });
      return;
    }
    next();
  };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(attachUser);

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });

  server.on('upgrade', (req, socket, head) => {
    const pathname = new URL(req.url || '/', 'http://localhost').pathname;
    if (pathname === '/ws') {
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    }
  });

  const broadcastState = (eventType: string, payload?: Record<string, unknown>) => {
    const message = JSON.stringify({
      type: eventType,
      payload: payload ?? {},
      snapshot: warungStore.getPublicSnapshot(),
      timestamp: new Date().toISOString(),
    });
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(message);
      }
    }
  };

  wss.on('connection', (ws) => {
    ws.send(
      JSON.stringify({
        type: 'init',
        snapshot: warungStore.getPublicSnapshot(),
        timestamp: new Date().toISOString(),
      }),
    );
  });

  // HEALTH
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, timestamp: new Date().toISOString() });
  });

  // AUTH
  app.post('/api/auth/login', (req, res) => {
    const { email, password } = req.body ?? {};
    if (!email || !password) {
      res.status(400).json({ error: 'Email dan password wajib diisi.' });
      return;
    }
    const user = warungStore.authenticate(String(email), String(password));
    if (!user) {
      res.status(401).json({ error: 'Email atau password tidak sesuai.' });
      return;
    }
    const token = signToken({
      id: user.id,
      role: user.role,
      exp: Date.now() + 7 * 24 * 60 * 60 * 1000,
    });
    res.json({ user, token });
  });

  app.get('/api/auth/me', (req: AuthenticatedRequest, res) => {
    if (!req.user) {
      res.status(401).json({ error: 'Belum login.' });
      return;
    }
    res.json({ user: req.user });
  });

  app.post('/api/auth/logout', (req: AuthenticatedRequest, res) => {
    if (req.user) {
      warungStore.logLogout(req.user);
    }
    res.json({ ok: true });
  });

  // FULL PUBLIC / STAFF SNAPSHOT
  app.get('/api/snapshot', (_req, res) => {
    res.json(warungStore.getPublicSnapshot());
  });

  // ORDERS & QUEUE
  app.post('/api/orders', (req: AuthenticatedRequest, res) => {
    try {
      const result = warungStore.createOrder(req.user ?? null, req.body);
      if (!result.deduplicated) {
        broadcastState('order:created', { orderId: result.order.id, queueCode: result.order.queue_code });
      }
      res.status(201).json(result);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal membuat pesanan.';
      res.status(400).json({ error: msg });
    }
  });

  app.post('/api/orders/sync', (req: AuthenticatedRequest, res) => {
    try {
      const pendingList = Array.isArray(req.body?.orders) ? req.body.orders : [];
      const synced = [];
      for (const item of pendingList) {
        try {
          const result = warungStore.createOrder(req.user ?? null, item);
          synced.push({ client_request_id: item.client_request_id, ok: true, order: result.order });
        } catch (err) {
          synced.push({
            client_request_id: item.client_request_id,
            ok: false,
            error: err instanceof Error ? err.message : 'Gagal sinkronisasi',
          });
        }
      }
      broadcastState('orders:synced', { count: synced.length });
      res.json({ synced });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal sinkronisasi pesanan offline.' });
    }
  });

  app.patch('/api/orders/:id/status', requireRole(['admin', 'kasir', 'dapur']), (req: AuthenticatedRequest, res) => {
    try {
      const order = warungStore.updateOrderStatus(req.user!, String(req.params.id), req.body?.status);
      broadcastState('order:updated', { orderId: order.id, queueCode: order.queue_code, status: order.status });
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui status antrean.' });
    }
  });

  app.post('/api/queue/call-next', requireRole(['admin', 'kasir']), (req: AuthenticatedRequest, res) => {
    try {
      const order = warungStore.callNextQueue(req.user!);
      broadcastState('queue:called', { orderId: order.id, queueCode: order.queue_code });
      res.json({ order });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Tidak ada antrean berikutnya.' });
    }
  });

  // PAYMENTS
  app.post('/api/payments', requireRole(['admin', 'kasir']), (req: AuthenticatedRequest, res) => {
    try {
      const result = warungStore.processPayment(req.user!, req.body);
      broadcastState('payment:completed', { orderId: result.order.id, paymentId: result.payment.id });
      res.status(201).json(result);
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memproses pembayaran.' });
    }
  });

  // CATEGORIES (Admin only)
  app.post('/api/categories', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const category = warungStore.createCategory(req.user!, req.body);
      broadcastState('catalog:updated');
      res.status(201).json({ category });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menambah kategori.' });
    }
  });

  app.patch('/api/categories/:id', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const category = warungStore.updateCategory(req.user!, String(req.params.id), req.body);
      broadcastState('catalog:updated');
      res.json({ category });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal mengubah kategori.' });
    }
  });

  app.delete('/api/categories/:id', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      warungStore.deleteCategory(req.user!, String(req.params.id));
      broadcastState('catalog:updated');
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menghapus kategori.' });
    }
  });

  // PRODUCTS (Admin only)
  app.post('/api/products', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const product = warungStore.createProduct(req.user!, req.body);
      broadcastState('catalog:updated');
      res.status(201).json({ product });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menambah menu.' });
    }
  });

  app.patch('/api/products/:id', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const product = warungStore.updateProduct(req.user!, String(req.params.id), req.body);
      broadcastState('catalog:updated');
      res.json({ product });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal mengubah menu.' });
    }
  });

  app.delete('/api/products/:id', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      warungStore.deleteProduct(req.user!, String(req.params.id));
      broadcastState('catalog:updated');
      res.json({ ok: true });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menghapus menu.' });
    }
  });

  // MODIFIERS (Admin only)
  app.post('/api/modifiers', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const modifier = warungStore.upsertModifier(req.user!, req.body);
      broadcastState('catalog:updated');
      res.status(201).json({ modifier });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan tambahan menu.' });
    }
  });

  // STOCK ADJUSTMENTS (Admin & Kasir)
  app.post('/api/stock/adjust', requireRole(['admin', 'kasir']), (req: AuthenticatedRequest, res) => {
    try {
      const product = warungStore.adjustStock(req.user!, req.body);
      broadcastState('stock:updated', { productId: product.id });
      res.json({ product });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui stok.' });
    }
  });

  // SETTINGS (Admin only)
  app.patch('/api/settings', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const settings = warungStore.updateSettings(req.user!, req.body);
      broadcastState('settings:updated');
      res.json({ settings });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal menyimpan pengaturan.' });
    }
  });

  // USERS & AUDIT LOGS (Admin only)
  app.get('/api/users', requireRole(['admin']), (_req, res) => {
    res.json({ users: warungStore.listUsers() });
  });

  app.post('/api/users', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const user = warungStore.createUser(req.user!, req.body);
      res.status(201).json({ user });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal membuat pengguna.' });
    }
  });

  app.patch('/api/users/:id', requireRole(['admin']), (req: AuthenticatedRequest, res) => {
    try {
      const user = warungStore.updateUser(req.user!, String(req.params.id), req.body);
      res.json({ user });
    } catch (err) {
      res.status(400).json({ error: err instanceof Error ? err.message : 'Gagal memperbarui pengguna.' });
    }
  });

  app.get('/api/audit-logs', requireRole(['admin']), (_req, res) => {
    res.json({ logs: warungStore.listAuditLogs() });
  });

  // VITE / STATIC SERVING
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const disableHmr = process.env.DISABLE_HMR === 'true' || Boolean(process.env.K_SERVICE);
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        ws: { server },
        hmr: disableHmr ? false : true,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Antrian Warung berjalan di http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Gagal memulai server Antrian Warung:', err);
  process.exit(1);
});
