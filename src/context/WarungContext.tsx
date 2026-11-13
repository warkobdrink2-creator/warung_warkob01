import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  enqueuePendingOfflineOrder,
  loadPendingOfflineOrders,
  loadSnapshotCache,
  removeSyncedOfflineOrders,
  saveSnapshotCache,
} from '../lib/offlineStorage';
import type {
  InventoryTxType,
  OfflinePendingOrder,
  Order,
  PaymentMethod,
  Product,
  QueueStatus,
  UserProfile,
  WarungSettings,
  WarungStateSnapshot,
} from '../types/warung';

export type ConnectionState = 'online' | 'offline' | 'syncing';

export interface ToastItem {
  id: string;
  type: 'success' | 'warning' | 'error' | 'info';
  title: string;
  message?: string;
}

interface WarungContextValue {
  snapshot: WarungStateSnapshot | null;
  loading: boolean;
  user: UserProfile | null;
  token: string | null;
  connectionState: ConnectionState;
  pendingOfflineCount: number;
  toasts: ToastItem[];
  lastRealtimeEvent: { type: string; payload?: Record<string, unknown>; timestamp: string } | null;
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
  dismissToast: (id: string) => void;
  login: (email: string, password: string) => Promise<UserProfile>;
  logout: () => Promise<void>;
  refreshSnapshot: () => Promise<void>;
  apiFetch: <T>(url: string, options?: RequestInit) => Promise<T>;
  createOrder: (input: {
    customer_name: string;
    notes?: string;
    discount?: number;
    items: { product_id: string; quantity: number; modifier_ids?: string[]; notes?: string }[];
  }) => Promise<{ order?: Order; offlineQueued?: boolean; offlineRef?: string }>;
  updateOrderStatus: (orderId: string, status: QueueStatus) => Promise<Order>;
  callNextQueue: () => Promise<Order>;
  processPayment: (input: {
    order_id: string;
    method: PaymentMethod;
    amount_paid: number;
    discount?: number;
    reference_no?: string;
  }) => Promise<Order>;
  adjustStock: (input: {
    product_id: string;
    type: InventoryTxType;
    quantity: number;
    notes?: string;
  }) => Promise<Product>;
  updateSettings: (updates: Partial<WarungSettings>) => Promise<WarungSettings>;
}

const TOKEN_STORAGE_KEY = 'antrian_warung_auth_token_v1';
const USER_STORAGE_KEY = 'antrian_warung_auth_user_v1';

const WarungContext = createContext<WarungContextValue | null>(null);

export function WarungProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<WarungStateSnapshot | null>(() => loadSnapshotCache());
  const [loading, setLoading] = useState<boolean>(!loadSnapshotCache());
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_STORAGE_KEY));
  const [user, setUser] = useState<UserProfile | null>(() => {
    try {
      const raw = localStorage.getItem(USER_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as UserProfile) : null;
    } catch {
      return null;
    }
  });
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online',
  );
  const [pendingOfflineCount, setPendingOfflineCount] = useState<number>(
    () => loadPendingOfflineOrders().length,
  );
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [lastRealtimeEvent, setLastRealtimeEvent] = useState<{
    type: string;
    payload?: Record<string, unknown>;
    timestamp: string;
  } | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const syncingRef = useRef(false);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, 4200);
    },
    [],
  );

  const apiFetch = useCallback(
    async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
      const headers = new Headers(options.headers);
      if (!headers.has('Content-Type') && options.body) {
        headers.set('Content-Type', 'application/json');
      }
      if (token) {
        headers.set('Authorization', `Bearer ${token}`);
      }
      let response: Response;
      try {
        response = await fetch(url, { ...options, headers });
      } catch {
        throw new Error('Data belum dapat disimpan. Periksa koneksi internet lalu coba lagi.');
      }
      const data = await response.json().catch(() => ({}));
      if (response.status === 401) {
        localStorage.removeItem(TOKEN_STORAGE_KEY);
        localStorage.removeItem(USER_STORAGE_KEY);
        setToken(null);
        setUser(null);
        throw new Error(data.error || 'Session Anda telah berakhir. Silakan login kembali.');
      }
      if (!response.ok) {
        throw new Error(data.error || 'Terjadi kendala saat memproses permintaan.');
      }
      return data as T;
    },
    [token],
  );

  const refreshSnapshot = useCallback(async () => {
    try {
      const data = await apiFetch<WarungStateSnapshot>('/api/snapshot');
      setSnapshot(data);
      saveSnapshotCache(data);
      setLoading(false);
    } catch (err) {
      const cached = loadSnapshotCache();
      if (cached) {
        setSnapshot(cached);
        setLoading(false);
      } else {
        setLoading(false);
      }
      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        setConnectionState('offline');
      }
      console.error('[refreshSnapshot]', err);
    }
  }, [apiFetch]);

  // Verify existing session on mount
  useEffect(() => {
    if (!token) return;
    fetch('/api/auth/me', {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (!res.ok) {
          localStorage.removeItem(TOKEN_STORAGE_KEY);
          localStorage.removeItem(USER_STORAGE_KEY);
          setToken(null);
          setUser(null);
          return;
        }
        const data = await res.json();
        setUser(data.user);
        localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      })
      .catch(() => {
        // Keep cached user while offline
      });
  }, [token]);

  // Sync pending offline orders when online
  const syncPendingOrders = useCallback(async () => {
    const pending = loadPendingOfflineOrders();
    if (pending.length === 0 || syncingRef.current) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    syncingRef.current = true;
    setConnectionState('syncing');
    try {
      const result = await apiFetch<{
        synced: { client_request_id: string; ok: boolean; order?: Order; error?: string }[];
      }>('/api/orders/sync', {
        method: 'POST',
        body: JSON.stringify({ orders: pending }),
      });

      const doneIds = result.synced.map((s) => s.client_request_id);
      const remaining = removeSyncedOfflineOrders(doneIds);
      setPendingOfflineCount(remaining.length);

      const okOrders = result.synced.filter((s) => s.ok && s.order);
      if (okOrders.length > 0) {
        pushToast({
          type: 'success',
          title: 'Sinkronisasi offline selesai',
          message: `${okOrders.length} pesanan tertunda berhasil masuk antrean (${okOrders.map((o) => o.order!.queue_code).join(', ')}).`,
        });
      }
      await refreshSnapshot();
      setConnectionState('online');
    } catch {
      setConnectionState(typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online');
    } finally {
      syncingRef.current = false;
    }
  }, [apiFetch, pushToast, refreshSnapshot]);

  // Initial fetch & Online/Offline listeners
  useEffect(() => {
    refreshSnapshot();

    const handleOnline = () => {
      setConnectionState('online');
      syncPendingOrders();
      refreshSnapshot();
    };
    const handleOffline = () => {
      setConnectionState('offline');
      pushToast({
        type: 'warning',
        title: 'Koneksi terputus',
        message: 'Mode offline aktif. Pesanan baru akan disimpan sementara dan disinkronkan otomatis.',
      });
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, [pushToast, refreshSnapshot, syncPendingOrders]);

  // WebSocket Realtime Client
  useEffect(() => {
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (!active) return;
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/ws`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!active) return;
        setConnectionState((prev) => (prev === 'syncing' ? 'syncing' : 'online'));
        syncPendingOrders();
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data) as {
            type: string;
            payload?: Record<string, unknown>;
            snapshot?: WarungStateSnapshot;
            timestamp: string;
          };
          if (msg.snapshot) {
            setSnapshot(msg.snapshot);
            saveSnapshotCache(msg.snapshot);
            setLoading(false);
          }
          if (msg.type && msg.type !== 'init') {
            setLastRealtimeEvent({
              type: msg.type,
              payload: msg.payload,
              timestamp: msg.timestamp,
            });
          }
        } catch {
          // Ignore malformed ws message
        }
      };

      ws.onclose = () => {
        if (!active) return;
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          setConnectionState('offline');
        }
        reconnectTimer = setTimeout(connect, 2500);
      };
    };

    connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      wsRef.current?.close();
    };
  }, [syncPendingOrders]);

  const login = useCallback(
    async (email: string, password: string) => {
      const data = await apiFetch<{ user: UserProfile; token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem(TOKEN_STORAGE_KEY, data.token);
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);
      pushToast({
        type: 'success',
        title: `Selamat datang, ${data.user.full_name}`,
      });
      return data.user;
    },
    [apiFetch, pushToast],
  );

  const logout = useCallback(async () => {
    try {
      if (token) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      }
    } catch {
      // Ignore network errors during logout
    }
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
    setToken(null);
    setUser(null);
    pushToast({ type: 'info', title: 'Anda telah keluar dari sesi.' });
  }, [pushToast, token]);

  const checkLowStockNotifications = useCallback(
    (updatedSnapshot: WarungStateSnapshot | null) => {
      if (!updatedSnapshot) return;
      const low = updatedSnapshot.products.filter((p) => p.is_active && p.stock > 0 && p.stock <= p.min_stock);
      if (low.length > 0) {
        pushToast({
          type: 'warning',
          title: 'Stok hampir habis',
          message: `${low[0].name} tersisa ${low[0].stock} ${low[0].unit}.`,
        });
      }
    },
    [pushToast],
  );

  const createOrder: WarungContextValue['createOrder'] = useCallback(
    async (input) => {
      const clientReqId = `req-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const offlinePayload: OfflinePendingOrder = {
        client_request_id: clientReqId,
        customer_name: input.customer_name,
        notes: input.notes,
        items: input.items.map((item) => ({
          ...item,
          modifier_ids: item.modifier_ids ?? [],
        })),
        created_at: new Date().toISOString(),
      };

      if (typeof navigator !== 'undefined' && !navigator.onLine) {
        const nextList = enqueuePendingOfflineOrder(offlinePayload);
        setPendingOfflineCount(nextList.length);
        setConnectionState('offline');
        pushToast({
          type: 'warning',
          title: 'Disimpan di antrean offline',
          message: 'Pesanan belum tersimpan ke server dan akan otomatis dikirim saat internet kembali.',
        });
        return { offlineQueued: true, offlineRef: clientReqId };
      }

      try {
        const res = await apiFetch<{ order: Order }>('/api/orders', {
          method: 'POST',
          body: JSON.stringify({ ...input, client_request_id: clientReqId }),
        });
        pushToast({
          type: 'success',
          title: 'Pesanan berhasil dibuat',
          message: `Nomor antrean ${res.order.queue_code} telah masuk sistem.`,
        });
        await refreshSnapshot();
        return { order: res.order };
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('koneksi internet')) {
          const nextList = enqueuePendingOfflineOrder(offlinePayload);
          setPendingOfflineCount(nextList.length);
          setConnectionState('offline');
          pushToast({
            type: 'warning',
            title: 'Disimpan lokal (Offline)',
            message: 'Koneksi terputus. Pesanan akan disinkronkan saat koneksi kembali.',
          });
          return { offlineQueued: true, offlineRef: clientReqId };
        }
        throw err;
      }
    },
    [apiFetch, pushToast, refreshSnapshot],
  );

  const updateOrderStatus = useCallback(
    async (orderId: string, status: QueueStatus) => {
      const res = await apiFetch<{ order: Order }>(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      if (status === 'DIPANGGIL') {
        pushToast({ type: 'info', title: 'Antrean berhasil dipanggil', message: `Nomor ${res.order.queue_code}` });
      } else if (status === 'SIAP') {
        pushToast({ type: 'success', title: 'Pesanan siap', message: `Antrean ${res.order.queue_code} siap diambil.` });
      } else if (status === 'DIBATALKAN') {
        pushToast({ type: 'warning', title: 'Pesanan dibatalkan', message: `Antrean ${res.order.queue_code} dibatalkan.` });
      } else if (status === 'SELESAI') {
        pushToast({ type: 'success', title: 'Pesanan selesai', message: `Antrean ${res.order.queue_code} telah selesai.` });
      }
      await refreshSnapshot();
      if (status === 'SELESAI') {
        checkLowStockNotifications(snapshot);
      }
      return res.order;
    },
    [apiFetch, checkLowStockNotifications, pushToast, refreshSnapshot, snapshot],
  );

  const callNextQueue = useCallback(async () => {
    const res = await apiFetch<{ order: Order }>('/api/queue/call-next', { method: 'POST' });
    pushToast({
      type: 'info',
      title: 'Antrean berhasil dipanggil',
      message: `Nomor ${res.order.queue_code} — ${res.order.customer_name}`,
    });
    await refreshSnapshot();
    return res.order;
  }, [apiFetch, pushToast, refreshSnapshot]);

  const processPayment: WarungContextValue['processPayment'] = useCallback(
    async (input) => {
      const res = await apiFetch<{ order: Order }>('/api/payments', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      pushToast({
        type: 'success',
        title: 'Pembayaran berhasil',
        message: `Antrean ${res.order.queue_code} lunas (${input.method}).`,
      });
      await refreshSnapshot();
      return res.order;
    },
    [apiFetch, pushToast, refreshSnapshot],
  );

  const adjustStock: WarungContextValue['adjustStock'] = useCallback(
    async (input) => {
      const res = await apiFetch<{ product: Product }>('/api/stock/adjust', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      if (res.product.stock <= res.product.min_stock) {
        pushToast({
          type: 'warning',
          title: res.product.stock === 0 ? 'MENU HABIS' : 'Stok hampir habis',
          message: `${res.product.name} tersisa ${res.product.stock} ${res.product.unit}.`,
        });
      } else {
        pushToast({
          type: 'success',
          title: 'Stok diperbarui',
          message: `${res.product.name}: ${res.product.stock} ${res.product.unit}`,
        });
      }
      await refreshSnapshot();
      return res.product;
    },
    [apiFetch, pushToast, refreshSnapshot],
  );

  const updateSettings = useCallback(
    async (updates: Partial<WarungSettings>) => {
      const res = await apiFetch<{ settings: WarungSettings }>('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify(updates),
      });
      pushToast({ type: 'success', title: 'Pengaturan warung disimpan.' });
      await refreshSnapshot();
      return res.settings;
    },
    [apiFetch, pushToast, refreshSnapshot],
  );

  return (
    <WarungContext.Provider
      value={{
        snapshot,
        loading,
        user,
        token,
        connectionState,
        pendingOfflineCount,
        toasts,
        lastRealtimeEvent,
        pushToast,
        dismissToast,
        login,
        logout,
        refreshSnapshot,
        apiFetch,
        createOrder,
        updateOrderStatus,
        callNextQueue,
        processPayment,
        adjustStock,
        updateSettings,
      }}
    >
      {children}
    </WarungContext.Provider>
  );
}

export function useWarung(): WarungContextValue {
  const ctx = useContext(WarungContext);
  if (!ctx) throw new Error('useWarung harus digunakan di dalam WarungProvider');
  return ctx;
}
