import React, { useState } from 'react';
import {
  BarChart3,
  BellRing,
  Boxes,
  ChefHat,
  CreditCard,
  FolderTree,
  LayoutDashboard,
  LogIn,
  LogOut,
  Menu as MenuIcon,
  Monitor,
  Settings,
  ShoppingBag,
  Users,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import type { UserRole } from '../types/warung';
import { PWAInstallButton } from './PWAInstallButton';

export interface NavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  roles: (UserRole | 'guest')[];
  mobilePrimary?: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { path: '/', label: 'Pesan Pelanggan', icon: ShoppingBag, roles: ['guest', 'pelanggan', 'kasir', 'admin'], mobilePrimary: true },
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'kasir'], mobilePrimary: true },
  { path: '/pesanan', label: 'Kasir POS', icon: ShoppingBag, roles: ['admin', 'kasir'], mobilePrimary: true },
  { path: '/antrian', label: 'Panggil Antrean', icon: BellRing, roles: ['admin', 'kasir'], mobilePrimary: true },
  { path: '/dapur', label: 'Layar Dapur', icon: ChefHat, roles: ['admin', 'dapur'], mobilePrimary: true },
  { path: '/pembayaran', label: 'Pembayaran', icon: CreditCard, roles: ['admin', 'kasir'] },
  { path: '/display', label: 'Layar TV', icon: Monitor, roles: ['guest', 'pelanggan', 'kasir', 'dapur', 'admin'] },
  { path: '/menu', label: 'Kelola Menu', icon: UtensilsCrossed, roles: ['admin', 'kasir'], mobilePrimary: true },
  { path: '/kategori', label: 'Kategori', icon: FolderTree, roles: ['admin'] },
  { path: '/stok', label: 'Stok Barang', icon: Boxes, roles: ['admin', 'kasir'], mobilePrimary: true },
  { path: '/laporan', label: 'Laporan', icon: BarChart3, roles: ['admin', 'kasir'], mobilePrimary: true },
  { path: '/pengguna', label: 'Pengguna & Log', icon: Users, roles: ['admin'] },
  { path: '/pengaturan', label: 'Pengaturan', icon: Settings, roles: ['admin'] },
];

interface AppShellProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  pageTitle: string;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({
  currentPath,
  onNavigate,
  pageTitle,
  children,
}) => {
  const { user, logout, snapshot, connectionState, pendingOfflineCount } = useWarung();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const effectiveRole: UserRole | 'guest' = user?.role ?? 'guest';
  const visibleNav = NAV_ITEMS.filter((item) => item.roles.includes(effectiveRole));

  // Mobile bottom tabs: up to 5 key destinations depending on role
  const mobileBottomTabs = (() => {
    if (effectiveRole === 'admin' || effectiveRole === 'kasir') {
      return [
        NAV_ITEMS.find((i) => i.path === '/dashboard')!,
        NAV_ITEMS.find((i) => i.path === '/pesanan')!,
        NAV_ITEMS.find((i) => i.path === '/antrian')!,
        NAV_ITEMS.find((i) => i.path === '/stok')!,
        NAV_ITEMS.find((i) => i.path === '/laporan')!,
      ];
    }
    if (effectiveRole === 'dapur') {
      return [
        NAV_ITEMS.find((i) => i.path === '/dapur')!,
        NAV_ITEMS.find((i) => i.path === '/display')!,
        NAV_ITEMS.find((i) => i.path === '/')!,
      ];
    }
    return [
      NAV_ITEMS.find((i) => i.path === '/')!,
      NAV_ITEMS.find((i) => i.path === '/display')!,
    ];
  })();

  const warungName = snapshot?.settings.warung_name || 'Antrian Warung';

  const connectionBadge = (() => {
    if (connectionState === 'offline') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-rose-700 whitespace-nowrap shrink-0">
          <span aria-hidden="true">🔴</span>
          <span>Offline{pendingOfflineCount > 0 ? ` (${pendingOfflineCount})` : ''}</span>
        </span>
      );
    }
    if (connectionState === 'syncing') {
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap shrink-0">
          <span aria-hidden="true">🟡</span>
          <span>Sinkronisasi</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap shrink-0">
        <span aria-hidden="true">🟢</span>
        <span>Online</span>
      </span>
    );
  })();

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 flex flex-col lg:flex-row">
      {/* Desktop Sidebar (240px) */}
      <aside className="no-print hidden lg:flex lg:flex-col lg:w-60 lg:fixed lg:inset-y-0 bg-white border-r border-slate-200 z-30">
        <div className="h-16 flex items-center px-5 border-b border-slate-200">
          <button
            type="button"
            onClick={() => onNavigate(effectiveRole === 'admin' || effectiveRole === 'kasir' ? '/dashboard' : '/')}
            className="text-left font-display text-lg font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 cursor-pointer"
          >
            {warungName}
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            const active = currentPath === item.path;
            return (
              <button
                key={item.path}
                type="button"
                onClick={() => onNavigate(item.path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  active
                    ? 'bg-orange-50 text-orange-700 font-semibold'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-orange-600' : 'text-slate-400'}`} />
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-200 space-y-3">
          {user ? (
            <div className="space-y-2.5">
              <div className="text-xs">
                <p className="font-semibold text-slate-900 truncate">{user.full_name}</p>
                <p className="text-slate-500 capitalize">{user.role}</p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  await logout();
                  onNavigate('/login');
                }}
                className="w-full flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigate('/login')}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 py-2.5 text-xs font-semibold text-white hover:bg-slate-800 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Masuk Staf / Pelanggan</span>
            </button>
          )}
        </div>
      </aside>

      {/* Mobile Drawer Menu */}
      {mobileMenuOpen && (
        <div className="no-print fixed inset-0 z-50 lg:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] bg-white h-full flex flex-col shadow-xl border-r border-slate-200 z-10">
            <div className="h-14 flex items-center justify-between px-4 border-b border-slate-200">
              <span className="font-display font-bold text-base text-slate-900">{warungName}</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center text-slate-500"
                aria-label="Tutup menu"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <nav className="flex-1 overflow-y-auto p-3 space-y-1">
              {visibleNav.map((item) => {
                const Icon = item.icon;
                const active = currentPath === item.path;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => {
                      onNavigate(item.path);
                      setMobileMenuOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 min-h-[44px] rounded-lg text-sm font-medium ${
                      active ? 'bg-orange-50 text-orange-700 font-semibold' : 'text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
            <div className="p-4 border-t border-slate-200">
              {user ? (
                <button
                  type="button"
                  onClick={async () => {
                    await logout();
                    setMobileMenuOpen(false);
                    onNavigate('/login');
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg border border-slate-200 text-sm font-semibold text-slate-700"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar ({user.role})</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    onNavigate('/login');
                  }}
                  className="w-full min-h-[44px] flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-sm font-semibold text-white"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Login Staf / Pelanggan</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 lg:pl-60 flex flex-col min-w-0">
        {/* Top Bar Contract: 3 clean zones */}
        <header className="no-print sticky top-0 z-20 h-14 lg:h-16 bg-white/95 backdrop-blur-md border-b border-slate-200 px-4 lg:px-8 flex items-center justify-between gap-4">
          {/* Zone 1: Mobile Menu Trigger + Page Title */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden min-h-[40px] min-w-[40px] -ml-1 flex items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
              aria-label="Buka navigasi"
            >
              <MenuIcon className="w-5 h-5" />
            </button>
            <h1 className="font-display text-base lg:text-lg font-bold text-slate-900 truncate">
              {pageTitle}
            </h1>
          </div>

          {/* Zone 2: Live Connection State */}
          <div className="flex items-center gap-4">
            {connectionBadge}
          </div>

          {/* Zone 3: Single Primary Action + PWA Install */}
          <div className="flex items-center gap-2 shrink-0">
            <PWAInstallButton compact />
            {user ? (
              <button
                type="button"
                onClick={() => onNavigate(user.role === 'dapur' ? '/dapur' : '/pesanan')}
                className="px-3.5 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {user.role === 'dapur' ? 'Layar Dapur' : 'Buat Pesanan'}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onNavigate('/login')}
                className="px-3.5 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                Login
              </button>
            )}
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-8 pb-24 lg:pb-10 max-w-7xl w-full mx-auto">
          {children}
        </main>
      </div>

      {/* Mobile Bottom Navigation (Compact 15% sticky cap compliant) */}
      <nav
        aria-label="Navigasi bawah mobile"
        className="no-print lg:hidden fixed bottom-0 left-0 right-0 z-30 h-16 bg-white/95 backdrop-blur-md border-t border-slate-200 grid"
        style={{ gridTemplateColumns: `repeat(${mobileBottomTabs.length}, minmax(0, 1fr))` }}
      >
        {mobileBottomTabs.map((item) => {
          const Icon = item.icon;
          const active = currentPath === item.path;
          return (
            <button
              key={item.path}
              type="button"
              onClick={() => onNavigate(item.path)}
              className={`flex flex-col items-center justify-center min-h-[44px] px-1 transition-colors ${
                active ? 'text-orange-600' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-medium mt-1 truncate max-w-full">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
};
