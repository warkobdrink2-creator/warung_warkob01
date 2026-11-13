import React, { useCallback, useEffect, useState } from 'react';
import { AppShell } from './components/AppShell';
import { ToastContainer } from './components/ToastContainer';
import { useWarung, WarungProvider } from './context/WarungContext';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { DisplayTvPage } from './pages/DisplayTvPage';
import { KitchenPage } from './pages/KitchenPage';
import { LoginPage } from './pages/LoginPage';
import { MenuAdminPage } from './pages/MenuAdminPage';
import { OrderPosPage } from './pages/OrderPosPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { QueueCallerPage } from './pages/QueueCallerPage';
import { ReportsPage } from './pages/ReportsPage';
import { SettingsPage } from './pages/SettingsPage';
import { StockPage } from './pages/StockPage';
import { UsersAuditPage } from './pages/UsersAuditPage';
import type { UserRole } from './types/warung';

const ROUTE_TITLES: Record<string, string> = {
  '/': 'Pesan & Pantau Antrean',
  '/login': 'Masuk Akun',
  '/dashboard': 'Dashboard Operasional',
  '/pesanan': 'Kasir & Buat Pesanan',
  '/antrian': 'Panggil Antrean',
  '/display': 'Layar Display Antrean',
  '/dapur': 'Layar Pesanan Dapur',
  '/pembayaran': 'Pembayaran & Struk',
  '/menu': 'Kelola Menu & Tambahan',
  '/kategori': 'Kategori Menu',
  '/stok': 'Stok & Inventory',
  '/laporan': 'Laporan Penjualan',
  '/pengguna': 'Pengguna & Audit Log',
  '/pengaturan': 'Pengaturan Warung',
};

const ROUTE_ALLOWED_ROLES: Record<string, (UserRole | 'guest')[]> = {
  '/': ['guest', 'pelanggan', 'kasir', 'dapur', 'admin'],
  '/login': ['guest', 'pelanggan', 'kasir', 'dapur', 'admin'],
  '/display': ['guest', 'pelanggan', 'kasir', 'dapur', 'admin'],
  '/dashboard': ['admin', 'kasir'],
  '/pesanan': ['admin', 'kasir', 'pelanggan', 'guest'],
  '/antrian': ['admin', 'kasir'],
  '/dapur': ['admin', 'dapur'],
  '/pembayaran': ['admin', 'kasir'],
  '/menu': ['admin', 'kasir'],
  '/kategori': ['admin'],
  '/stok': ['admin', 'kasir'],
  '/laporan': ['admin', 'kasir'],
  '/pengguna': ['admin'],
  '/pengaturan': ['admin'],
};

function RouterContent() {
  const { user, pushToast } = useWarung();
  const [currentPath, setCurrentPath] = useState<string>(() => {
    const p = window.location.pathname || '/';
    return ROUTE_TITLES[p] ? p : '/';
  });

  const navigate = useCallback((path: string) => {
    const clean = ROUTE_TITLES[path] ? path : '/';
    if (window.location.pathname !== clean) {
      window.history.pushState({}, '', clean);
    }
    setCurrentPath(clean);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => {
      const p = window.location.pathname || '/';
      setCurrentPath(ROUTE_TITLES[p] ? p : '/');
    };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  // Role-based route guard
  const effectiveRole: UserRole | 'guest' = user?.role ?? 'guest';
  const allowedRoles = ROUTE_ALLOWED_ROLES[currentPath] ?? ['admin'];
  const isAuthorized = allowedRoles.includes(effectiveRole);

  useEffect(() => {
    if (!isAuthorized) {
      if (!user) {
        pushToast({
          type: 'info',
          title: 'Login diperlukan',
          message: 'Silakan masuk menggunakan akun staf yang sesuai.',
        });
        navigate('/login');
      } else {
        pushToast({
          type: 'warning',
          title: 'Akses dibatasi',
          message: `Halaman ini tidak tersedia untuk peran ${user.role}.`,
        });
        navigate(user.role === 'dapur' ? '/dapur' : user.role === 'pelanggan' ? '/' : '/dashboard');
      }
    }
  }, [isAuthorized, navigate, pushToast, user]);

  if (currentPath === '/login') {
    return <LoginPage onNavigate={navigate} />;
  }

  if (currentPath === '/display') {
    return <DisplayTvPage onNavigate={navigate} />;
  }

  if (!isAuthorized) {
    return null;
  }

  const pageTitle = ROUTE_TITLES[currentPath] ?? 'Antrian Warung';

  const renderPage = () => {
    switch (currentPath) {
      case '/':
        return <OrderPosPage mode={user?.role === 'kasir' || user?.role === 'admin' ? 'cashier' : 'customer'} onNavigate={navigate} />;
      case '/pesanan':
        return <OrderPosPage mode="cashier" onNavigate={navigate} />;
      case '/dashboard':
        return <DashboardPage onNavigate={navigate} />;
      case '/antrian':
        return <QueueCallerPage onNavigate={navigate} />;
      case '/dapur':
        return <KitchenPage />;
      case '/pembayaran':
        return <PaymentsPage />;
      case '/menu':
        return <MenuAdminPage />;
      case '/kategori':
        return <CategoriesPage />;
      case '/stok':
        return <StockPage />;
      case '/laporan':
        return <ReportsPage />;
      case '/pengguna':
        return <UsersAuditPage />;
      case '/pengaturan':
        return <SettingsPage />;
      default:
        return <OrderPosPage mode="customer" onNavigate={navigate} />;
    }
  };

  return (
    <AppShell currentPath={currentPath} onNavigate={navigate} pageTitle={pageTitle}>
      {renderPage()}
    </AppShell>
  );
}

export default function App() {
  return (
    <WarungProvider>
      <RouterContent />
      <ToastContainer />
    </WarungProvider>
  );
}
