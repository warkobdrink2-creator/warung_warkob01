import type { PaymentStatus, QueueStatus } from '../types/warung';

export function formatRupiah(amount: number): string {
  const num = Math.round(Number(amount) || 0);
  const abs = Math.abs(num).toLocaleString('id-ID');
  return num < 0 ? `-Rp${abs}` : `Rp${abs}`;
}

export function formatDateTime(iso: string): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function formatTimeOnly(iso: string): string {
  if (!iso) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export function getTodayJakarta(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

export function getYesterdayJakarta(): string {
  return getTodayJakartaFromOffset(-1);
}

export function getTodayJakartaFromOffset(daysOffset: number): string {
  const date = new Date(Date.now() + daysOffset * 86400000);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export const QUEUE_STATUS_META: Record<
  QueueStatus,
  { label: string; bg: string; text: string; border: string }
> = {
  MENUNGGU: {
    label: 'Menunggu',
    bg: 'bg-slate-100',
    text: 'text-slate-700',
    border: 'border-slate-200',
  },
  DIPANGGIL: {
    label: 'Dipanggil',
    bg: 'bg-orange-50',
    text: 'text-orange-700',
    border: 'border-orange-200',
  },
  DIPROSES: {
    label: 'Diproses',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
  },
  SIAP: {
    label: 'Siap Ambil',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    border: 'border-emerald-200',
  },
  SELESAI: {
    label: 'Selesai',
    bg: 'bg-slate-100',
    text: 'text-slate-600',
    border: 'border-slate-200',
  },
  DIBATALKAN: {
    label: 'Dibatalkan',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
    border: 'border-rose-200',
  },
};

export const PAYMENT_STATUS_META: Record<
  PaymentStatus,
  { label: string; bg: string; text: string }
> = {
  'BELUM BAYAR': {
    label: 'Belum Bayar',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
  },
  'SUDAH BAYAR': {
    label: 'Sudah Bayar',
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
  },
  DIBATALKAN: {
    label: 'Dibatalkan',
    bg: 'bg-rose-50',
    text: 'text-rose-700',
  },
};

export function exportToCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const escapeCell = (val: string | number) => {
    const str = String(val ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  const csvContent = [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
