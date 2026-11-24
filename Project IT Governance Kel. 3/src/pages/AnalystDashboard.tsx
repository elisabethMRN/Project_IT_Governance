import { useEffect, useMemo, useState } from 'react';
import { Eye, FilePlus2, Search } from 'lucide-react';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { StatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { formatDate } from '../lib/format';
import { fetchDamageReports } from '../lib/simlabApi';
import type { DamageReport, ReportStatus } from '../types/simlab';

interface AnalystDashboardProps {
  onCreateClick: () => void;
  initialReportToOpen?: DamageReport | null;
  onInitialReportHandled?: () => void;
}

const STATUS_OPTIONS: ('Semua' | ReportStatus)[] = [
  'Semua',
  'Menunggu Verifikasi',
  'Diverifikasi',
  'Ditolak',
  'Tindak Lanjut',
  'Selesai',
];

export function AnalystDashboard({
  onCreateClick,
  initialReportToOpen,
  onInitialReportHandled,
}: AnalystDashboardProps) {
  const { profile } = useAuth();
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'Semua' | ReportStatus>('Semua');
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  useEffect(() => {
    if (initialReportToOpen) {
      setSelectedReport(initialReportToOpen);
      onInitialReportHandled?.();
    }
  }, [initialReportToOpen, onInitialReportHandled]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchDamageReports()
      .then((data) => {
        if (!mounted) return;
        // Defense-in-depth client filter paired with Supabase RLS
        const ownReports = profile
          ? data.filter((r) => r.reporter_id === profile.id)
          : data;
        setReports(ownReports);
      })
      .catch((err) => {
        if (!mounted) return;
        setError(err instanceof Error ? err.message : 'Gagal memuat daftar laporan.');
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [profile]);

  const counts = useMemo(() => {
    return {
      total: reports.length,
      waiting: reports.filter((r) => r.status === 'Menunggu Verifikasi').length,
      verified: reports.filter((r) => r.status === 'Diverifikasi').length,
      rejected: reports.filter((r) => r.status === 'Ditolak').length,
      followUp: reports.filter((r) => r.status === 'Tindak Lanjut').length,
      completed: reports.filter((r) => r.status === 'Selesai').length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'Semua' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [r.report_code, r.instrument?.name, r.location?.name, r.description]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [reports, search, statusFilter]);

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-base font-semibold text-[#0F2744]">Ringkasan Laporan Saya</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Pantau status verifikasi dan riwayat aktivitas laporan kerusakan yang Anda kirimkan.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreateClick}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold px-4 py-2.5 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-600 focus-visible:ring-offset-2"
        >
          <FilePlus2 className="h-4 w-4 shrink-0" aria-hidden="true" />
          <span>Buat Laporan Kerusakan</span>
        </button>
      </div>

      {/* Summary Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Laporan</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
            {counts.total}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Menunggu Verifikasi</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-amber-700">
            {counts.waiting}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Diverifikasi</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-teal-700">
            {counts.verified}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Ditolak</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-700">
            {counts.rejected}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Tindak Lanjut</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-sky-800">
            {counts.followUp}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Selesai</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-emerald-700">
            {counts.completed}
          </p>
        </div>
      </div>

      {/* Filters & Report List */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  statusFilter === status
                    ? 'bg-white text-[#0F2744] shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {status}
              </button>
            ))}
          </div>

          <div className="relative w-full lg:w-72">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID, alat, atau lokasi..."
              className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 py-2 text-sm focus:border-teal-600 focus:outline-none focus:ring-1 focus:ring-teal-600"
            />
          </div>
        </div>

        {error ? (
          <div className="p-6 text-sm text-red-700 bg-red-50">{error}</div>
        ) : loading ? (
          <div className="p-6 space-y-3">
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
            <div className="h-10 bg-slate-100 rounded animate-pulse" />
          </div>
        ) : filteredReports.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-sm font-medium text-slate-700">
              {reports.length === 0
                ? 'Belum ada laporan kerusakan yang Anda kirimkan.'
                : 'Tidak ada laporan yang sesuai dengan filter saat ini.'}
            </p>
            {reports.length === 0 && (
              <button
                type="button"
                onClick={onCreateClick}
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-4 py-2"
              >
                <FilePlus2 className="h-4 w-4" aria-hidden="true" />
                <span>Buat Laporan Pertama</span>
              </button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
                  <th className="py-3 px-4 whitespace-nowrap">ID Laporan</th>
                  <th className="py-3 px-4 whitespace-nowrap">Tanggal</th>
                  <th className="py-3 px-4">Lokasi</th>
                  <th className="py-3 px-4">Nama Alat</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Jumlah Rusak</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-sm">
                {filteredReports.map((report) => (
                  <tr
                    key={report.id}
                    className="hover:bg-slate-50/80 transition-colors cursor-pointer"
                    onClick={() => setSelectedReport(report)}
                  >
                    <td className="py-3 px-4 font-mono text-xs font-semibold text-[#0F2744] whitespace-nowrap tabular-nums">
                      {report.report_code}
                    </td>
                    <td className="py-3 px-4 text-slate-600 whitespace-nowrap tabular-nums">
                      {formatDate(report.created_at)}
                    </td>
                    <td className="py-3 px-4 text-slate-800">{report.location?.name || '—'}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {report.instrument?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {report.damaged_qty}
                    </td>
                    <td className="py-3 px-4">
                      <StatusBadge status={report.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedReport(report);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-800 whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Detail</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ReportDetailModal
        report={selectedReport}
        canManage={false}
        onClose={() => setSelectedReport(null)}
        onUpdated={(updated) => {
          setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
          setSelectedReport(updated);
        }}
      />
    </div>
  );
}
