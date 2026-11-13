import type { OfflinePendingOrder, WarungStateSnapshot } from '../types/warung';

const SNAPSHOT_CACHE_KEY = 'antrian_warung_snapshot_cache_v1';
const PENDING_QUEUE_KEY = 'antrian_warung_pending_orders_v1';

export function saveSnapshotCache(snapshot: WarungStateSnapshot): void {
  try {
    localStorage.setItem(SNAPSHOT_CACHE_KEY, JSON.stringify(snapshot));
  } catch {
    // Ignore storage quota errors
  }
}

export function loadSnapshotCache(): WarungStateSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as WarungStateSnapshot;
  } catch {
    return null;
  }
}

export function loadPendingOfflineOrders(): OfflinePendingOrder[] {
  try {
    const raw = localStorage.getItem(PENDING_QUEUE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function enqueuePendingOfflineOrder(order: OfflinePendingOrder): OfflinePendingOrder[] {
  const list = loadPendingOfflineOrders();
  if (!list.some((o) => o.client_request_id === order.client_request_id)) {
    list.push(order);
    try {
      localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(list));
    } catch {
      // Ignore storage quota errors
    }
  }
  return list;
}

export function removeSyncedOfflineOrders(syncedIds: string[]): OfflinePendingOrder[] {
  const remaining = loadPendingOfflineOrders().filter((o) => !syncedIds.includes(o.client_request_id));
  try {
    localStorage.setItem(PENDING_QUEUE_KEY, JSON.stringify(remaining));
  } catch {
    // Ignore
  }
  return remaining;
}
