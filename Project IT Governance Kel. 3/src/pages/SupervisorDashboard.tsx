import { useEffect, useMemo, useState } from 'react';
import { Eye, Search } from 'lucide-react';
import { ReportDetailModal } from '../components/ReportDetailModal';
import { StatusBadge } from '../components/StatusBadge';
import { formatDate } from '../lib/format';
import { fetchDamageReports } from '../lib/simlabApi';
import type { DamageReport, ReportStatus } from '../types/simlab';

interface SupervisorDashboardProps {
  initialTab?: 'queue' | 'all';
}

const ALL_STATUSES: ('Semua' | ReportStatus)[] = [
  'Semua',
  'Menunggu Verifikasi',
  'Diverifikasi',
  'Tindak Lanjut',
  'Selesai',
  'Ditolak',
];

export function SupervisorDashboard({ initialTab = 'queue' }: SupervisorDashboardProps) {
  const [reports, setReports] = useState<DamageReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'Semua' | ReportStatus>(
    initialTab === 'queue' ? 'Menunggu Verifikasi' : 'Semua'
  );
  const [search, setSearch] = useState('');
  const [selectedReport, setSelectedReport] = useState<DamageReport | null>(null);

  useEffect(() => {
    setStatusFilter(initialTab === 'queue' ? 'Menunggu Verifikasi' : 'Semua');
  }, [initialTab]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);

    fetchDamageReports()
      .then((data) => {
        if (!mounted) return;
        setReports(data);
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
  }, []);

  const counts = useMemo(() => {
    return {
      total: reports.length,
      waiting: reports.filter((r) => r.status === 'Menunggu Verifikasi').length,
      verified: reports.filter((r) => r.status === 'Diverifikasi').length,
      followUp: reports.filter((r) => r.status === 'Tindak Lanjut').length,
      completed: reports.filter((r) => r.status === 'Selesai').length,
      rejected: reports.filter((r) => r.status === 'Ditolak').length,
    };
  }, [reports]);

  const filteredReports = useMemo(() => {
    const q = search.trim().toLowerCase();
    return reports.filter((r) => {
      if (statusFilter !== 'Semua' && r.status !== statusFilter) return false;
      if (!q) return true;
      return [
        r.report_code,
        r.reporter_name,
        r.instrument?.name,
        r.location?.name,
        r.pic_name,
        r.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [reports, statusFilter, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold text-[#0F2744]">
          Ringkasan Verifikasi & Tindak Lanjut QA
        </h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Tinjau kelengkapan laporan kerusakan, lakukan verifikasi atau penolakan, serta tetapkan
          PIC tindak lanjut.
        </p>
      </div>

      {/* Summary Metric Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Total Masuk</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-[#0F2744]">
            {counts.total}
          </p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50/40 p-4">
          <p className="text-xs font-medium text-amber-800">Menunggu Verifikasi</p>
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
        <div className="rounded-lg border border-slate-200 bg-white p-4">
          <p className="text-xs font-medium text-slate-500">Ditolak</p>
          <p className="mt-2 text-2xl font-bold font-mono tabular-nums text-red-700">
            {counts.rejected}
          </p>
        </div>
      </div>

      {/* Reports Table */}
      <div className="rounded-lg border border-slate-200 bg-white overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
            {ALL_STATUSES.map((status) => (
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

          <div className="relative w-full xl:w-72">
            <Search
              className="h-4 w-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari ID, pelapor, alat, PIC..."
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
              Tidak ada laporan pada kategori status "{statusFilter}".
            </p>
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
                  <th className="py-3 px-4">Nama Alat</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">Rusak</th>
                  <th className="py-3 px-4">PIC & Tenggat</th>
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
                    <td className="py-3 px-4 text-slate-800 whitespace-nowrap">
                      {report.reporter_name}
                    </td>
                    <td className="py-3 px-4 text-slate-700">{report.location?.name || '—'}</td>
                    <td className="py-3 px-4 font-medium text-slate-900">
                      {report.instrument?.name || '—'}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-slate-900">
                      {report.damaged_qty}
                    </td>
                    <td className="py-3 px-4 text-xs text-slate-600 whitespace-nowrap">
                      {report.pic_name ? (
                        <div>
                          <span className="font-medium text-slate-900">{report.pic_name}</span>
                          {report.follow_up_deadline && (
                            <span className="block text-slate-500 tabular-nums">
                              Tenggat: {formatDate(report.follow_up_deadline)}
                            </span>
                          )}
                        </div>
                      ) : (
                        '—'
                      )}
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
                        <span>Tinjau</span>
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
        canManage
        onClose={() => setSelectedReport(null)}
        onReopenReport={(rep) => setSelectedReport(rep)}
        onUpdated={(updated) => {
          setReports((prev) =>
            prev.map((r) => (String(r.id) === String(updated.id) ? updated : r))
          );
        }}
      />
    </div>
  );
}
