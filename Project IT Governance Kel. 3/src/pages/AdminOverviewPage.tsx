import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Building2,
  ClipboardCheck,
  FileText,
  Package,
  Users,
} from 'lucide-react';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate, getInstrumentStock, getRoleLabel } from '../lib/format';
import {
  fetchAssignableProfiles,
  fetchDamageReports,
  fetchInstruments,
  fetchLocations,
  fetchPhysicalChecks,
} from '../lib/simlabApi';
import type {
  DamageReport,
  Instrument,
  LabLocation,
  PhysicalCheck,
  Profile,
} from '../types/simlab';

interface AdminOverviewPageProps {
  onNavigate: (path: string) => void;
}

export function AdminOverviewPage({ onNavigate }: AdminOverviewPageProps) {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [locations, setLocations] = useState<LabLocation[]>([]);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [checks, setChecks] = useState<PhysicalCheck[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    Promise.all([
      fetchAssignableProfiles(),
      fetchLocations(),
      fetchInstruments(),
      fetchDamageReports(),
      fetchPhysicalChecks(),
    ])
      .then(([profRows, locRows, instRows, repRows, checkRows]) => {
        if (!mounted) return;
        setProfiles(profRows);
        setLocations(locRows);
        setInstruments(instRows);
        setReports(repRows);
        setChecks(checkRows);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat ringkasan sistem.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const stats = useMemo(() => {
    const roleCounts = {
      analis: profiles.filter((p) => p.role === 'analis').length,
      supervisor: profiles.filter((p) => p.role === 'supervisor').length,
      tu: profiles.filter((p) => p.role === 'tu').length,
      admin: profiles.filter((p) => p.role === 'admin').length,
      active: profiles.filter((p) => p.is_active !== false).length,
    };

    const reportCounts = {
      total: reports.length,
      waiting: reports.filter((r) => r.status === 'Menunggu Verifikasi').length,
      verified: reports.filter((r) => r.status === 'Diverifikasi').length,
      rejected: reports.filter((r) => r.status === 'Ditolak').length,
      followUp: reports.filter((r) => r.status === 'Tindak Lanjut').length,
      completed: reports.filter((r) => r.status === 'Selesai').length,
    };

    const activeLocations = locations.filter((l) => l.is_active !== false).length;
    const activeInstruments = instruments.filter((i) => i.is_active !== false).length;
    const lowStockInstruments = instruments.filter((i) => {
      const stock = getInstrumentStock(i);
      const min = typeof i.minimum_stock === 'number' ? i.minimum_stock : 0;
      return i.is_active !== false && min > 0 && stock <= min;
    }).length;

    const unverifiedChecks = checks.filter(
      (c) => !c.verification_status || c.verification_status === 'Belum Diverifikasi'
    ).length;

    return {
      roleCounts,
      reportCounts,
      activeLocations,
      activeInstruments,
      lowStockInstruments,
      unverifiedChecks,
    };
  }, [profiles, locations, instruments, reports, checks]);

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-sm text-red-800">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#0F2744]">Ringkasan Sistem SIMLAB</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pusat pengelolaan data master, peran pengguna, stok alat, dan pemantauan aktivitas
            pelaporan laboratorium.
          </p>
        </div>
        <button
          type="button"
          onClick={() => onNavigate('/admin/ekspor')}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2.5 transition-colors whitespace-nowrap shrink-0"
        >
          <span>Pusat Ekspor Data</span>
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-white border border-slate-200 animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Primary System Metrics */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <button
              type="button"
              onClick={() => onNavigate('/admin/pengguna')}
              className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Total Pengguna</span>
                <Users className="h-4 w-4 text-teal-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {profiles.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {stats.roleCounts.active} akun aktif
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/admin/lokasi')}
              className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Lokasi Laboratorium</span>
                <Building2 className="h-4 w-4 text-teal-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {locations.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {stats.activeLocations} lokasi aktif
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/admin/alat')}
              className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Alat Gelas Terdaftar</span>
                <Package className="h-4 w-4 text-teal-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {instruments.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {stats.activeInstruments} aktif · {stats.lowStockInstruments} stok minimum
              </p>
            </button>

            <button
              type="button"
              onClick={() => onNavigate('/admin/pemeriksaan')}
              className="text-left rounded-lg border border-slate-200 bg-white p-5 hover:border-teal-400 transition-colors"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500">Pemeriksaan Semesteran</span>
                <ClipboardCheck className="h-4 w-4 text-teal-600" aria-hidden="true" />
              </div>
              <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
                {checks.length}
              </p>
              <p className="mt-1 text-xs text-slate-600">
                {stats.unverifiedChecks} belum diverifikasi
              </p>
            </button>
          </div>

          {/* Breakdown Cards: Role & Report Status */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0F2744]">Pengguna Berdasarkan Peran</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin/pengguna')}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Kelola Pengguna →
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {(['analis', 'supervisor', 'tu', 'admin'] as const).map((role) => (
                  <div
                    key={role}
                    className="rounded-lg border border-slate-200 bg-slate-50/70 px-4 py-3"
                  >
                    <p className="text-xs text-slate-500">{getRoleLabel(role)}</p>
                    <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#0F2744]">
                      {stats.roleCounts[role]}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0F2744]">Laporan Berdasarkan Status</h3>
                <button
                  type="button"
                  onClick={() => onNavigate('/admin/laporan')}
                  className="text-xs font-semibold text-teal-700 hover:text-teal-800"
                >
                  Kelola Laporan →
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 px-3.5 py-3">
                  <p className="text-xs text-amber-800">Menunggu Verifikasi</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-amber-700">
                    {stats.reportCounts.waiting}
                  </p>
                </div>
                <div className="rounded-lg border border-teal-200 bg-teal-50/40 px-3.5 py-3">
                  <p className="text-xs text-teal-800">Diverifikasi</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-teal-700">
                    {stats.reportCounts.verified}
                  </p>
                </div>
                <div className="rounded-lg border border-sky-200 bg-sky-50/40 px-3.5 py-3">
                  <p className="text-xs text-sky-800">Tindak Lanjut</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-sky-800">
                    {stats.reportCounts.followUp}
                  </p>
                </div>
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/40 px-3.5 py-3">
                  <p className="text-xs text-emerald-800">Selesai</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-emerald-700">
                    {stats.reportCounts.completed}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-red-50/40 px-3.5 py-3">
                  <p className="text-xs text-red-800">Ditolak</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-red-700">
                    {stats.reportCounts.rejected}
                  </p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3.5 py-3">
                  <p className="text-xs text-slate-600">Total Laporan</p>
                  <p className="mt-1 text-xl font-bold font-mono tabular-nums text-[#0F2744]">
                    {stats.reportCounts.total}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Latest Damage Reports */}
          <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between gap-2 bg-slate-50/70">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#0F2744]" aria-hidden="true" />
                <h3 className="text-sm font-semibold text-[#0F2744]">Laporan Terbaru</h3>
              </div>
              <button
                type="button"
                onClick={() => onNavigate('/admin/laporan')}
                className="text-xs font-semibold text-teal-700 hover:text-teal-800"
              >
                Lihat Semua
              </button>
            </div>

            {reports.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                Belum ada laporan kerusakan tercatat.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="py-3 px-4 whitespace-nowrap">ID Laporan</th>
                      <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                      <th className="py-3 px-4">Pelapor</th>
                      <th className="py-3 px-4">Lokasi</th>
                      <th className="py-3 px-4">Alat Gelas</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-sm">
                    {reports.slice(0, 6).map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F2744] whitespace-nowrap">
                          {r.report_code}
                        </td>
                        <td className="py-3 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                          {formatDate(r.created_at)}
                        </td>
                        <td className="py-3 px-4 text-slate-800">{r.reporter_name}</td>
                        <td className="py-3 px-4 text-slate-700">{r.location?.name || '—'}</td>
                        <td className="py-3 px-4 font-medium text-slate-900">
                          {r.instrument?.name || '—'}
                        </td>
                        <td className="py-3 px-4">
                          <StatusBadge status={r.status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
