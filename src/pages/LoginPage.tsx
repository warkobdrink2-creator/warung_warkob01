import React, { useState } from 'react';
import { ArrowRight, KeyRound, Lock, Mail } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import type { UserRole } from '../types/warung';

interface LoginPageProps {
  onNavigate: (path: string) => void;
}

const DEMO_ACCOUNTS: { role: UserRole; label: string; email: string; pass: string; desc: string }[] = [
  { role: 'admin', label: 'Admin', email: 'admin@warung.id', pass: 'admin123', desc: 'Akses penuh menu, stok, laporan & pengguna' },
  { role: 'kasir', label: 'Kasir', email: 'kasir@warung.id', pass: 'kasir123', desc: 'POS pesanan, panggil antrean & pembayaran' },
  { role: 'dapur', label: 'Dapur', email: 'dapur@warung.id', pass: 'dapur123', desc: 'Layar pesanan masuk & status masak' },
  { role: 'pelanggan', label: 'Pelanggan', email: 'pelanggan@warung.id', pass: 'pelanggan123', desc: 'Pesan menu & pantau antrean' },
];

export const LoginPage: React.FC<LoginPageProps> = ({ onNavigate }) => {
  const { login, snapshot } = useWarung();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const warungName = snapshot?.settings.warung_name || 'Antrian Warung';

  const handleRedirectByRole = (role: UserRole) => {
    if (role === 'admin' || role === 'kasir') onNavigate('/dashboard');
    else if (role === 'dapur') onNavigate('/dapur');
    else onNavigate('/');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login(email, password);
      handleRedirectByRole(profile.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal masuk ke akun Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleQuickLogin = async (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setError(null);
    setSubmitting(true);
    try {
      const profile = await login(demoEmail, demoPass);
      handleRedirectByRole(profile.role);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal login.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full mx-auto space-y-6">
        <div className="text-center">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="font-display text-2xl font-extrabold tracking-tight text-slate-900 cursor-pointer"
          >
            {warungName}
          </button>
          <p className="mt-1.5 text-sm text-slate-600">
            Masuk untuk mengelola operasional warung, kasir, dapur, atau pesanan Anda.
          </p>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 shadow-xs space-y-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="login-email" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Email Pengguna
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="nama@warung.id"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            <div>
              <label htmlFor="login-password" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="login-password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Masukkan password"
                  className="w-full rounded-lg border border-slate-300 bg-white pl-10 pr-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-lg bg-orange-600 px-4 py-3 text-sm font-semibold text-white hover:bg-orange-700 disabled:opacity-60 transition-colors cursor-pointer"
            >
              <span>{submitting ? 'Memproses...' : 'Masuk Sekarang'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="pt-5 border-t border-slate-200">
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-700 mb-3">
              <KeyRound className="w-3.5 h-3.5 text-orange-600" />
              <span>Akses Cepat Akun Demo (Uji Peran)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.role}
                  type="button"
                  disabled={submitting}
                  onClick={() => handleQuickLogin(acc.email, acc.pass)}
                  className="text-left rounded-lg border border-slate-200 bg-slate-50/70 p-2.5 hover:border-orange-300 hover:bg-orange-50/50 transition-colors cursor-pointer"
                >
                  <p className="text-xs font-bold text-slate-900">{acc.label}</p>
                  <p className="text-[11px] text-slate-500 line-clamp-1 mt-0.5">{acc.desc}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="text-center">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="text-xs font-medium text-slate-600 hover:text-slate-900 underline underline-offset-4 cursor-pointer"
          >
            Kembali ke Halaman Pesan Pelanggan
          </button>
        </div>
      </div>
    </div>
  );
};
