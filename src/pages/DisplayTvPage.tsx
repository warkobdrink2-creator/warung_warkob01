import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, Volume2, VolumeX } from 'lucide-react';
import { useWarung } from '../context/WarungContext';
import { getTodayJakarta } from '../lib/format';
import { playChime, speakQueueNumber } from '../lib/speech';

interface DisplayTvPageProps {
  onNavigate: (path: string) => void;
}

export const DisplayTvPage: React.FC<DisplayTvPageProps> = ({ onNavigate }) => {
  const { snapshot, lastRealtimeEvent, connectionState } = useWarung();
  const [clock, setClock] = useState(new Date());
  const [audioEnabled, setAudioEnabled] = useState(true);
  const lastSpokenRef = useRef<string | null>(null);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const todayStr = getTodayJakarta();
  const todayOrders = useMemo(
    () =>
      (snapshot?.orders ?? [])
        .filter((o) => o.queue_date === todayStr)
        .sort((a, b) => a.queue_number - b.queue_number),
    [snapshot?.orders, todayStr],
  );

  const currentCalling = useMemo(() => {
    const called = todayOrders.filter((o) => o.status === 'DIPANGGIL');
    if (called.length === 0) return null;
    return [...called].sort((a, b) => (b.called_at ?? '').localeCompare(a.called_at ?? ''))[0];
  }, [todayOrders]);

  const readyOrders = useMemo(
    () => todayOrders.filter((o) => o.status === 'SIAP'),
    [todayOrders],
  );

  const upcomingOrders = useMemo(
    () => todayOrders.filter((o) => o.status === 'MENUNGGU' || o.status === 'DIPROSES').slice(0, 8),
    [todayOrders],
  );

  // Trigger audio chime/speech when a queue call event arrives via WebSocket
  useEffect(() => {
    if (!audioEnabled || !lastRealtimeEvent) return;
    if (lastRealtimeEvent.type === 'queue:called' || (lastRealtimeEvent.type === 'order:updated' && lastRealtimeEvent.payload?.status === 'DIPANGGIL')) {
      const code = String(lastRealtimeEvent.payload?.queueCode ?? '');
      const eventKey = `${code}-${lastRealtimeEvent.timestamp}`;
      if (code && lastSpokenRef.current !== eventKey) {
        lastSpokenRef.current = eventKey;
        playChime();
        speakQueueNumber(code, 'silakan menuju kasir.');
      }
    }
  }, [audioEnabled, lastRealtimeEvent]);

  const timeString = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(clock);

  const dateString = new Intl.DateTimeFormat('id-ID', {
    timeZone: 'Asia/Jakarta',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(clock);

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col justify-between p-6 lg:p-10 select-none">
      {/* Top TV Header */}
      <header className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => onNavigate('/')}
            className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white hover:border-slate-700 cursor-pointer"
            title="Kembali ke aplikasi"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              {snapshot?.settings.warung_name || 'ANTRIAN WARUNG'}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400">
              {dateString} · {connectionState === 'online' ? 'Sinkronisasi Realtime Aktif' : 'Mode Offline'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => setAudioEnabled((a) => !a)}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs font-semibold text-slate-300 hover:text-white cursor-pointer"
          >
            {audioEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            <span>{audioEnabled ? 'Suara TV Aktif' : 'Suara TV Bisu'}</span>
          </button>

          <div className="text-right">
            <p className="font-mono text-3xl sm:text-4xl font-bold text-white tabular-nums tracking-tight">
              {timeString}
            </p>
          </div>
        </div>
      </header>

      {/* Main High-Contrast Split */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-6 py-8 items-stretch">
        {/* Giant Currently Called */}
        <section className="lg:col-span-7 rounded-3xl bg-slate-900 border border-slate-800 p-8 sm:p-12 flex flex-col items-center justify-center text-center">
          <p className="text-lg sm:text-xl font-bold tracking-wide text-orange-400">
            SEDANG DIPANGGIL
          </p>
          <p className="font-mono text-8xl sm:text-[10rem] leading-none font-extrabold text-white tabular-nums my-6 tracking-tight">
            {currentCalling ? currentCalling.queue_code : '—'}
          </p>
          {currentCalling ? (
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-slate-100">{currentCalling.customer_name}</p>
              <p className="text-base sm:text-lg text-slate-400">Silakan menuju loket kasir / pengambilan pesanan</p>
            </div>
          ) : (
            <p className="text-lg text-slate-400">Menunggu panggilan antrean berikutnya</p>
          )}
        </section>

        {/* Next & Ready Columns */}
        <section className="lg:col-span-5 flex flex-col gap-6">
          {/* Ready to Pickup */}
          <div className="rounded-3xl bg-slate-900 border border-slate-800 p-6">
            <h2 className="text-sm font-bold tracking-wide text-emerald-400 mb-4">
              PESANAN SIAP DIAMBIL
            </h2>
            {readyOrders.length === 0 ? (
              <p className="text-sm text-slate-500">Belum ada pesanan siap ambil.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {readyOrders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-2xl bg-emerald-950/60 border border-emerald-700/50 px-4 py-3 text-center"
                  >
                    <p className="font-mono text-2xl sm:text-3xl font-extrabold text-emerald-300 tabular-nums">
                      {o.queue_code}
                    </p>
                    <p className="text-xs text-emerald-200/80 truncate mt-0.5">{o.customer_name}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upcoming Queue */}
          <div className="flex-1 rounded-3xl bg-slate-900 border border-slate-800 p-6">
            <h2 className="text-sm font-bold tracking-wide text-slate-300 mb-4">
              BERIKUTNYA / SEDANG DISIAPKAN
            </h2>
            {upcomingOrders.length === 0 ? (
              <p className="text-sm text-slate-500">Tidak ada antrean menunggu.</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-2 gap-3">
                {upcomingOrders.map((o) => (
                  <div
                    key={o.id}
                    className="rounded-2xl bg-slate-800/80 border border-slate-700/60 px-4 py-3 flex items-center justify-between gap-2"
                  >
                    <span className="font-mono text-2xl font-bold text-white tabular-nums">
                      {o.queue_code}
                    </span>
                    <span className="text-xs font-medium text-slate-400 truncate">
                      {o.status === 'DIPROSES' ? 'Dimasak' : 'Menunggu'}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 pt-4 flex items-center justify-between text-xs sm:text-sm text-slate-400">
        <span>Terima kasih atas kesabaran Anda menunggu pesanan.</span>
        <span>Total Antrean Hari Ini: {todayOrders.length}</span>
      </footer>
    </div>
  );
};
